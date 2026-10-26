// Сценарии «Что, если…?» и метрики «было → стало».
//
// Сценарий не содержит своего кода: это набор «эффектов», и каждый эффект —
// формула из конфига. Ядро знает фиксированный словарь эффектов (EFFECTS) и
// умеет применить их к графику и бюджету. Поэтому админ может собрать новый
// сценарий из параметров и формул, ничего не программируя.

import { buildSchedule, type EarlyMode, type Loan, type Schedule, type ScheduleEvents } from "./annuity";
import { checkFormula, evaluateFormula } from "./evaluate";
import { explained, inp, type Explained } from "./explain";

export type Household = {
  income: number; // доход семьи в месяц
  expenses: number; // обязательные расходы в месяц (без платежей по кредитам)
};

// ── Словарь эффектов ─────────────────────────────────────────────

export type EffectKey =
  | "earlyAmount" // разовый досрочный платёж, ₽
  | "earlyMonth" // месяц досрочного платежа
  | "extraMonthly" // доплата к каждому платежу, ₽/мес
  | "newRate" // новая ставка, %
  | "rateMonth" // с какого месяца действует новая ставка
  | "extraIncome" // дополнительный доход, ₽/мес
  | "extraPayment" // платёж по другому кредиту, ₽/мес
  | "extraOverpayment"; // переплата по другому кредиту, ₽

export const EFFECTS: Record<EffectKey, string> = {
  earlyAmount: "Разовый досрочный платёж, ₽",
  earlyMonth: "Месяц досрочного платежа",
  extraMonthly: "Доплата к каждому платежу, ₽/мес",
  newRate: "Новая ставка, %",
  rateMonth: "Месяц смены ставки",
  extraIncome: "Дополнительный доход, ₽/мес",
  extraPayment: "Платёж по другому кредиту, ₽/мес",
  extraOverpayment: "Переплата по другому кредиту, ₽",
};

export type ParamDef = {
  id: string; // имя переменной в формулах
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  default: number;
  hint?: string;
};

export type LoanProgram = "rural" | "market"; // сельская ипотека / рыночная

export type ScenarioDef = {
  id: string;
  title: string;
  description: string;
  hint?: string;
  // Показывать сценарий только для этой программы (например, «потеря льготы» — только для сельской)
  onlyFor?: LoanProgram;
  params: ParamDef[];
  effects: Partial<Record<EffectKey, string>>;
};

// Переменные базового кредита, доступные в формулах сценариев
export const BASE_VARS: Record<string, string> = {
  S: "Сумма кредита, ₽",
  rate: "Ставка, % годовых",
  n: "Срок, мес",
  i: "Месячная ставка (rate/12/100)",
  P: "Платёж по ипотеке, ₽",
  income: "Доход семьи, ₽/мес",
  expenses: "Обязательные расходы, ₽/мес",
};

export function baseScope(loan: Loan, household: Household, payment: number): Record<string, number> {
  return {
    S: loan.principal,
    rate: loan.ratePct,
    n: loan.months,
    i: loan.ratePct / 12 / 100,
    P: payment,
    income: household.income,
    expenses: household.expenses,
  };
}

// ── Метрики ──────────────────────────────────────────────────────

export type Metrics = {
  payment: Explained; // платёж по ипотеке
  months: Explained; // срок
  overpayment: Explained; // переплата (ипотека + другие кредиты сценария)
  budget: Explained; // свободный бюджет в месяц
  pdn: Explained; // показатель долговой нагрузки, %
  schedule: Schedule;
};

export type Extras = {
  extraIncome: number;
  extraPayment: number;
  extraMonthly: number;
  extraOverpayment: number;
};

const NO_EXTRAS: Extras = { extraIncome: 0, extraPayment: 0, extraMonthly: 0, extraOverpayment: 0 };

export function computeMetrics(
  loan: Loan,
  household: Household,
  events: ScheduleEvents = {},
  extras: Extras = NO_EXTRAS,
): Metrics {
  const schedule = buildSchedule(loan, events);
  const P = schedule.payment;
  const { lastRecalc } = schedule;

  const payment = explained("annuity", P, {
    S: inp(lastRecalc.balance, "Сумма (остаток) кредита, ₽"),
    rate: inp(lastRecalc.ratePct, "Ставка, % годовых"),
    n: inp(lastRecalc.months, "Срок, мес"),
  });

  const months = explained("term", schedule.months, {
    n: inp(loan.months, "Срок по договору, мес"),
    fact: inp(schedule.months, "Месяцев в графике с учётом событий"),
  });

  // Переплата = сумма процентов по графику (= P·n − S, если событий нет)
  const overpayment = explained("overpayment", schedule.totalInterest + extras.extraOverpayment, {
    interest: inp(schedule.totalInterest, "Проценты по ипотеке, ₽"),
    other: inp(extras.extraOverpayment, "Переплата по другим кредитам, ₽"),
  });

  const totalIncome = household.income + extras.extraIncome;
  // Свободный бюджет = доходы − расходы − все платежи (включая добровольную доплату)
  const budgetValue = totalIncome - household.expenses - P - extras.extraPayment - extras.extraMonthly;
  const budget = explained("budget", budgetValue, {
    income: inp(household.income, "Доход семьи, ₽/мес"),
    extraIncome: inp(extras.extraIncome, "Дополнительный доход, ₽/мес"),
    expenses: inp(household.expenses, "Обязательные расходы, ₽/мес"),
    P: inp(P, "Платёж по ипотеке, ₽/мес"),
    extraPayment: inp(extras.extraPayment, "Платежи по другим кредитам, ₽/мес"),
    extraMonthly: inp(extras.extraMonthly, "Добровольная доплата, ₽/мес"),
  });

  // ПДН считается по обязательным платежам; добровольная доплата в него не входит
  const pdnValue = totalIncome > 0 ? ((P + extras.extraPayment) / totalIncome) * 100 : Infinity;
  const pdn = explained("pdn", pdnValue, {
    payments: inp(P + extras.extraPayment, "Обязательные платежи, ₽/мес"),
    income: inp(totalIncome, "Доход с учётом доп. дохода, ₽/мес"),
  });

  return { payment, months, overpayment, budget, pdn, schedule };
}

export type PdnLevel = "green" | "yellow" | "red";

// Светофор ПДН: пороги из конфига (по умолчанию 30% и 50%)
export function pdnLevel(pdnPct: number, yellowFrom: number, redFrom: number): PdnLevel {
  if (pdnPct > redFrom) return "red";
  if (pdnPct >= yellowFrom) return "yellow";
  return "green";
}

// ── Применение сценария ──────────────────────────────────────────

export type ScenarioResult = {
  before: Metrics;
  after: Metrics;
  // Значения эффектов с объяснением: какая формула и какие подстановки
  effects: Partial<Record<EffectKey, Explained>>;
  // Если в сценарии есть досрочка — результат в другом режиме, для сравнения
  alternative?: { mode: EarlyMode; after: Metrics };
};

export type ScenarioInput = {
  scenario: ScenarioDef;
  loan: Loan;
  household: Household;
  params: Record<string, number>; // значения параметров сценария
  globals: Record<string, number>; // глобальные параметры конфига (ставки, лимиты…)
  globalLabels?: Record<string, string>; // их подписи — для объяснений
  earlyMode?: EarlyMode;
};

export function applyScenario({
  scenario,
  loan,
  household,
  params,
  globals,
  globalLabels = {},
  earlyMode = "term",
}: ScenarioInput): ScenarioResult {
  const before = computeMetrics(loan, household);
  // Порядок важен: параметры сценария перекрывают базовые и глобальные переменные
  const scope = { ...globals, ...baseScope(loan, household, before.payment.value), ...params };
  const labelOf = (name: string) =>
    scenario.params.find((p) => p.id === name)?.label ?? BASE_VARS[name] ?? globalLabels[name] ?? name;

  // Вычисляем каждый эффект и запоминаем, из чего он получился
  const effects: Partial<Record<EffectKey, Explained>> = {};
  const value = (key: EffectKey): number | undefined => {
    const expr = scenario.effects[key];
    if (!expr?.trim()) return undefined;
    const v = evaluateFormula(expr, scope);
    const check = checkFormula(expr, Object.keys(scope));
    const used = check.ok ? check.variables : [];
    const inputs = Object.fromEntries(used.map((name) => [name, inp(scope[name], labelOf(name))]));
    effects[key] = explained(`effect.${key}`, v, inputs, expr);
    return v;
  };

  const earlyAmount = value("earlyAmount");
  const earlyMonth = value("earlyMonth");
  const newRate = value("newRate");
  const rateMonth = value("rateMonth");
  const extras: Extras = {
    extraIncome: value("extraIncome") ?? 0,
    extraPayment: value("extraPayment") ?? 0,
    extraMonthly: value("extraMonthly") ?? 0,
    extraOverpayment: value("extraOverpayment") ?? 0,
  };

  const eventsFor = (mode: EarlyMode): ScheduleEvents => ({
    earlyPayments: earlyAmount
      ? [{ amount: earlyAmount, month: Math.max(1, Math.round(earlyMonth ?? 1)), mode }]
      : [],
    rateChanges: newRate !== undefined ? [{ ratePct: newRate, month: Math.max(1, Math.round(rateMonth ?? 1)) }] : [],
    extraMonthly: extras.extraMonthly,
  });

  const after = computeMetrics(loan, household, eventsFor(earlyMode), extras);
  const result: ScenarioResult = { before, after, effects };
  if (earlyAmount) {
    const other: EarlyMode = earlyMode === "term" ? "payment" : "term";
    result.alternative = { mode: other, after: computeMetrics(loan, household, eventsFor(other), extras) };
  }
  return result;
}
