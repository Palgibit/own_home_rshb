// Типы конфига и его проверка. Конфиг — единственное место, где живут ставки,
// лимиты, цены, сценарии, формулы и подсказки. Его редактирует админ.

import { checkFormula, FUNCTION_NAMES } from "../core/evaluate";
import { BASE_VARS, EFFECTS, type EffectKey, type LoanProgram, type ScenarioDef } from "../core/scenarios";
import { findConflict, templateParams, type Condition, type NavigatorDef } from "../core/navigator";
import type { GuestDemo } from "../data/guest";

export type { LoanProgram, ParamDef, ScenarioDef } from "../core/scenarios";
export type { NavigatorDef, StepDef } from "../core/navigator";

// Сервис экосистемы «Своё»: на него ведут шаги навигатора и модуль 3.
// Пустой href — ссылка-заглушка: сервис показывается без перехода.
export type ServiceDef = {
  id: string;
  title: string;
  description: string;
  href: string;
};

// Глобальный параметр: доступен во всех формулах по id
export type GlobalParam = {
  id: string;
  label: string;
  group: string;
  unit?: string;
  value: number;
  hint?: string;
};

// Описание встроенной формулы для поповера «откуда это число»
export type FormulaDoc = {
  id: string; // совпадает с Explained.formulaId
  title: string;
  formula: string; // как показать формулу человеку
  hint: string; // пояснение простым языком
};

// Стартовые значения симулятора: с чем он открывается у нового посетителя.
// Ставка берётся из глобальных параметров по программе (ruralRate / marketRate).
export type SimulatorDefaults = {
  program: LoanProgram;
  principal: number; // сумма кредита, ₽
  years: number; // срок, лет
  income: number; // доход семьи, ₽/мес
  expenses: number; // обязательные расходы, ₽/мес
  compareAmount: number; // «досрочка или вклад»: сумма, ₽
  compareMonth: number; // … через сколько месяцев появились деньги
  compareHorizonMonths: number; // … горизонт сравнения, мес
  coffeeExtra: number; // «чашка кофе»: доплата по умолчанию, ₽/мес
  coffeeMax: number; // … максимум ползунка, ₽/мес
  ownFunds: number; // «город или село»: свои средства, ₽
  familySize: number; // … человек в семье
};

// Справка, которую клиент заказывает в модуле 3
export type CertificateDef = {
  id: string;
  title: string;
  description: string;
  days: number; // через сколько дней будет готова
  byYear?: boolean; // нужно выбрать год (справка об уплаченных процентах)
};

// Вопрос-ответ в справке «Что такое налоговый вычет — коротко»
export type FaqItem = { q: string; a: string };

// Модуль 3 «Жизнь после ипотеки»: демо-кредит гостя, тексты и сервисы.
// Тексты могут содержать {параметр} — подставится значение глобального параметра.
export type AfterDef = {
  guestDemo: GuestDemo;
  reminderDays: number; // за сколько дней напоминать о страховке и подтверждениях
  earlyAmount: number; // сумма досрочки по умолчанию, ₽
  salary: number; // зарплата по умолчанию в калькуляторе вычета, ₽/мес
  taxFaq: FaqItem[]; // справка по вычету над калькулятором
  taxSteps: string[];
  certificates: CertificateDef[];
  insuranceHint: string;
  ruralHint: string;
  insuranceService: string; // id сервиса страхования из services
  settleServices: string[]; // сервисы раздела «Обустройство»
};

export type AppConfig = {
  version: 1;
  params: GlobalParam[];
  simulator: SimulatorDefaults;
  formulas: FormulaDoc[];
  scenarios: ScenarioDef[];
  services: ServiceDef[];
  navigator: NavigatorDef;
  after: AfterDef;
};

// Параметры, без которых модуль 3 не посчитает обязательства и вычет
const AFTER_PARAMS = ["employmentCheckMonths", "obligationYears", "registrationDays", "lossRate", "ndfl", "propertyLimit", "interestLimit"];

export const PROGRAMS: Record<LoanProgram, string> = {
  rural: "Сельская ипотека",
  market: "Рыночная ипотека",
};

// Ставка по программе — из глобальных параметров конфига
export const PROGRAM_RATE_PARAM: Record<LoanProgram, string> = {
  rural: "ruralRate",
  market: "marketRate",
};

// Значения глобальных параметров: { ruralRate: 3, … }
export function globalValues(config: AppConfig): Record<string, number> {
  return Object.fromEntries(config.params.map((p) => [p.id, p.value]));
}

export function globalLabels(config: AppConfig): Record<string, string> {
  return Object.fromEntries(config.params.map((p) => [p.id, p.label]));
}

// Переменные, доступные в формулах сценария
export function scenarioVariables(scenario: ScenarioDef, config: AppConfig): string[] {
  return [...Object.keys(BASE_VARS), ...config.params.map((p) => p.id), ...scenario.params.map((p) => p.id)];
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SCENARIO_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Возвращает список ошибок; пустой список — конфиг корректен
export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];
  if (config?.version !== 1) return ["Неизвестная версия конфига"];
  if (![config.params, config.formulas, config.scenarios].every(Array.isArray)) {
    return ["Неверная структура конфига: нет params, formulas или scenarios"];
  }

  const reserved = new Set([...Object.keys(BASE_VARS), ...FUNCTION_NAMES]);
  const checkId = (id: string, where: string, seen: Set<string>) => {
    if (!IDENTIFIER.test(id)) errors.push(`${where}: имя «${id}» — только латиница, цифры и _`);
    else if (reserved.has(id)) errors.push(`${where}: имя «${id}» зарезервировано`);
    if (seen.has(id)) errors.push(`${where}: имя «${id}» повторяется`);
    seen.add(id);
  };

  const globalIds = new Set<string>();
  for (const p of config.params) {
    checkId(p.id, "Параметры", globalIds);
    if (!Number.isFinite(p.value)) errors.push(`Параметры, «${p.label}»: значение должно быть числом`);
  }

  const sim = config.simulator;
  if (!sim || typeof sim !== "object") {
    errors.push("Нет раздела simulator со стартовыми значениями симулятора");
  } else {
    if (!(sim.program in PROGRAMS)) errors.push(`Симулятор: неизвестная программа «${sim.program}»`);
    for (const [key, v] of Object.entries(sim)) {
      if (key !== "program" && !(Number.isFinite(v) && (v as number) >= 0)) {
        errors.push(`Симулятор: «${key}» должно быть неотрицательным числом`);
      }
    }
  }
  for (const id of Object.values(PROGRAM_RATE_PARAM)) {
    if (!globalIds.has(id)) errors.push(`Параметры: нет ставки программы «${id}»`);
  }

  const scenarioIds = new Set<string>();
  for (const s of config.scenarios) {
    if (scenarioIds.has(s.id)) errors.push(`Сценарий «${s.title}»: id «${s.id}» повторяется`);
    scenarioIds.add(s.id);
    // id сценария попадает в адрес: #/simulator?scenario=<id>
    if (!SCENARIO_ID.test(s.id ?? "")) errors.push(`Сценарий «${s.title}»: id «${s.id}» — только строчная латиница, цифры и дефис`);
    if (!s.title?.trim()) errors.push(`Сценарий «${s.id}»: нужно название`);
    if (s.onlyFor !== undefined && !(s.onlyFor in PROGRAMS)) {
      errors.push(`Сценарий «${s.title}»: неизвестная программа «${s.onlyFor}» в onlyFor`);
    }

    const own = new Set<string>(globalIds); // параметр сценария не должен затенять глобальный
    for (const p of s.params) {
      const where = `Сценарий «${s.title}», параметр «${p.label || p.id}»`;
      checkId(p.id, `Сценарий «${s.title}»`, own);
      if (!Number.isFinite(p.default)) errors.push(`${where}: значение по умолчанию должно быть числом`);
      // Ползунок в симуляторе строится по min/max: значение по умолчанию должно в них попадать
      if (p.min !== undefined && p.max !== undefined && p.min > p.max) errors.push(`${where}: минимум больше максимума`);
      else if ((p.min !== undefined && p.default < p.min) || (p.max !== undefined && p.default > p.max)) {
        errors.push(`${where}: значение по умолчанию вне диапазона от минимума до максимума`);
      }
      if (p.step !== undefined && !(p.step > 0)) errors.push(`${where}: шаг должен быть больше нуля`);
    }

    const vars = scenarioVariables(s, config);
    for (const [key, expr] of Object.entries(s.effects)) {
      if (!(key in EFFECTS)) {
        errors.push(`Сценарий «${s.title}»: неизвестный эффект «${key}»`);
        continue;
      }
      if (!expr?.trim()) continue;
      const check = checkFormula(expr, vars);
      if (!check.ok) errors.push(`Сценарий «${s.title}», «${EFFECTS[key as EffectKey]}»: ${check.error}`);
    }
  }

  errors.push(...validateNavigator(config, globalIds, scenarioIds));
  errors.push(...validateAfter(config, globalIds));
  return errors;
}

// Модуль 3: числа неотрицательные, сервисы существуют, {параметры} в текстах известны
function validateAfter(config: AppConfig, globalIds: Set<string>): string[] {
  const a = config.after;
  if (!a || typeof a !== "object" || !a.guestDemo || ![a.taxFaq, a.taxSteps, a.certificates, a.settleServices].every(Array.isArray)) {
    return ["Нет раздела after (модуль «Жизнь после ипотеки») или в нём не хватает полей"];
  }
  const errors: string[] = [];
  for (const id of AFTER_PARAMS) if (!globalIds.has(id)) errors.push(`Параметры: нет «${id}» — он нужен модулю «Жизнь после ипотеки»`);

  const demo = a.guestDemo;
  if (!(demo.program in PROGRAMS)) errors.push(`После ипотеки, демо-кредит: неизвестная программа «${demo.program}»`);
  const numbers = {
    "демо-кредит, сумма": demo.principal,
    "демо-кредит, ставка": demo.ratePct,
    "демо-кредит, срок": demo.years,
    "демо-кредит, выдан месяцев назад": demo.monthsAgo,
    "демо-кредит, стоимость жилья": demo.propertyPrice,
    "напоминать за дней": a.reminderDays,
    "сумма досрочки": a.earlyAmount,
    "зарплата": a.salary,
  };
  for (const [name, v] of Object.entries(numbers)) {
    if (!(Number.isFinite(v) && v >= 0)) errors.push(`После ипотеки, ${name}: нужно неотрицательное число`);
  }
  if (demo.years <= 0 || demo.principal <= 0) errors.push("После ипотеки, демо-кредит: сумма и срок должны быть больше нуля");
  if (demo.monthsAgo >= demo.years * 12) errors.push("После ипотеки, демо-кредит: кредит уже был бы погашен — уменьшите «выдан месяцев назад»");

  const serviceIds = new Set(config.services.map((s) => s.id));
  for (const id of [a.insuranceService, ...a.settleServices]) {
    if (!serviceIds.has(id)) errors.push(`После ипотеки: нет сервиса «${id}»`);
  }

  const certIds = new Set<string>();
  for (const c of a.certificates) {
    if (certIds.has(c.id)) errors.push(`После ипотеки, справка «${c.title}»: id «${c.id}» повторяется`);
    certIds.add(c.id);
    if (!(Number.isFinite(c.days) && c.days >= 0)) errors.push(`После ипотеки, справка «${c.title}»: срок готовности — число дней`);
  }

  if (a.taxSteps.some((t) => !t?.trim())) errors.push("После ипотеки, налоговый вычет: пустой шаг — удалите пустую строку");
  a.taxFaq.forEach((f, i) => {
    if (!f?.q?.trim() || !f?.a?.trim()) errors.push(`После ипотеки, справка по вычету, вопрос №${i + 1}: нужны и вопрос, и ответ`);
  });
  for (const text of [...a.taxSteps, ...a.taxFaq.flatMap((f) => [f?.q, f?.a]), a.insuranceHint, a.ruralHint]) {
    for (const p of templateParams(text ?? "")) {
      if (!globalIds.has(p)) errors.push(`После ипотеки: в тексте неизвестный параметр {${p}}`);
    }
  }
  return errors;
}

// Сервисы и навигатор: ссылки между частями конфига должны сходиться —
// шаг ссылается на существующий этап, условие — на существующий вопрос и вариант,
// {параметр} в тексте — на глобальный параметр.
function validateNavigator(config: AppConfig, globalIds: Set<string>, scenarioIds: Set<string>): string[] {
  const errors: string[] = [];
  if (!Array.isArray(config.services)) return ["Нет раздела services"];
  const nav = config.navigator;
  if (!nav || ![nav.questions, nav.conflicts, nav.stages, nav.steps, nav.presets].every(Array.isArray)) {
    return ["Неверная структура навигатора: нужны questions, conflicts, stages, steps, presets"];
  }

  const serviceIds = new Set<string>();
  for (const s of config.services) {
    if (serviceIds.has(s.id)) errors.push(`Сервис «${s.title}»: id «${s.id}» повторяется`);
    serviceIds.add(s.id);
  }

  const checkText = (text: string | undefined, where: string) => {
    for (const p of templateParams(text ?? "")) {
      if (!globalIds.has(p)) errors.push(`${where}: в тексте неизвестный параметр {${p}}`);
    }
  };

  // Вопросы: условие показа может ссылаться только на вопросы выше
  const options = new Map<string, Set<string>>();
  const checkCondition = (cond: Condition | undefined, where: string) => {
    for (const [q, list] of Object.entries(cond ?? {})) {
      const known = options.get(q);
      if (!known) errors.push(`${where}: неизвестный вопрос «${q}» в условии`);
      else if (!Array.isArray(list)) errors.push(`${where}: условие на «${q}» должно быть списком`);
      else for (const o of list) if (!known.has(o)) errors.push(`${where}: у вопроса «${q}» нет варианта «${o}»`);
    }
  };
  for (const q of nav.questions) {
    const where = `Навигатор, вопрос «${q.title}»`;
    if (options.has(q.id)) errors.push(`${where}: id «${q.id}» повторяется`);
    checkCondition(q.showIf, where);
    checkText(q.hint, where);
    if (!q.options?.length) errors.push(`${where}: нет вариантов ответа`);
    const ids = new Set<string>();
    for (const o of q.options ?? []) {
      if (ids.has(o.id)) errors.push(`${where}: вариант «${o.id}» повторяется`);
      ids.add(o.id);
      checkText(o.hint, where);
    }
    options.set(q.id, ids);
  }

  nav.conflicts.forEach((c, i) => checkCondition(c.when, `Навигатор, конфликт №${i + 1}`));

  const stageIds = new Set<string>();
  for (const s of nav.stages) {
    if (stageIds.has(s.id)) errors.push(`Навигатор, этап «${s.title}»: id «${s.id}» повторяется`);
    stageIds.add(s.id);
  }

  const checkLink = (link: { to: string } | undefined, where: string) => {
    if (!link) return;
    if (!link.to?.startsWith("/")) errors.push(`${where}: ссылка в расчёт должна начинаться с «/»`);
    const scenario = /[?&]scenario=([^&]+)/.exec(link.to ?? "")?.[1];
    if (scenario && !scenarioIds.has(scenario)) errors.push(`${where}: нет сценария «${scenario}»`);
  };

  const stepIds = new Set<string>();
  for (const s of nav.steps) {
    const where = `Навигатор, шаг «${s.title}»`;
    if (!s.id?.trim()) errors.push(`${where}: нужен id`);
    if (!s.title?.trim()) errors.push(`Навигатор, шаг «${s.id}»: нужно название`);
    if (!s.recommendation?.trim()) errors.push(`${where}: нужна рекомендация`);
    if (stepIds.has(s.id)) errors.push(`${where}: id «${s.id}» повторяется`);
    stepIds.add(s.id);
    if (!stageIds.has(s.stage)) errors.push(`${where}: неизвестный этап «${s.stage}»`);
    checkCondition(s.showIf, where);
    checkText(s.recommendation, where);
    checkLink(s.calcLink, where);
    for (const v of s.variants ?? []) {
      checkCondition(v.when, where);
      checkText(v.text, where);
      checkLink(v.calcLink, where);
    }
    for (const id of s.services ?? []) if (!serviceIds.has(id)) errors.push(`${where}: нет сервиса «${id}»`);
  }

  if (!nav.presets.length) errors.push("Навигатор: нужен хотя бы один типовой сценарий — с него открывается маршрут");
  for (const p of nav.presets) {
    const where = `Навигатор, сценарий «${p.title}»`;
    for (const [q, o] of Object.entries(p.answers ?? {})) {
      if (!options.get(q)?.has(o)) errors.push(`${where}: недопустимый ответ «${q}: ${o}»`);
    }
    const conflict = findConflict(nav, p.answers ?? {});
    if (conflict) errors.push(`${where}: недопустимое сочетание — ${conflict.message}`);
  }
  return errors;
}
