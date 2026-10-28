// Сценарии «Что, если…?» и метрики «было → стало».
//
// Сценарий не содержит своего кода: это набор «эффектов», и каждый эффект —
// формула из конфига. Ядро знает фиксированный словарь эффектов (EFFECTS) и
// умеет применить их к графику и бюджету. Поэтому админ может собрать новый
// сценарий из параметров и формул, ничего не программируя.

import { buildSchedule, type EarlyMode, type Loan, type Schedule, type ScheduleEvents } from "./annuity";
import { checkFormula, evaluateFormula } from "./evaluate";
import { explained, inp, type Explained } from "./explain";
import { insuranceCosts, type InsuranceCosts, type InsuranceSettings } from "./purchase";

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
  | "extraOverpayment" // переплата по другому кредиту, ₽
  | "loan2Amount" // другой кредит: сумма, ₽ — ядро само построит его график
  | "loan2Rate" // другой кредит: ставка, %
  | "loan2Months" // другой кредит: срок, мес
  | "durationMonths"; // сколько длится сценарий, мес (для «подушки безопасности»)

export const EFFECTS: Record<EffectKey, string> = {
  earlyAmount: "Разовый досрочный платёж, ₽",
  earlyMonth: "Месяц досрочного платежа",
  extraMonthly: "Доплата к каждому платежу, ₽/мес",
  newRate: "Новая ставка, %",
  rateMonth: "Месяц смены ставки",
  extraIncome: "Дополнительный доход, ₽/мес",
  extraPayment: "Платёж по другому кредиту, ₽/мес",
  extraOverpayment: "Переплата по другому кредиту, ₽",
  loan2Amount: "Другой кредит: сумма, ₽",
  loan2Rate: "Другой кредит: ставка, %",
  loan2Months: "Другой кредит: срок, мес",
  durationMonths: "Сколько длится сценарий, мес",
};

export type ParamDef = {
  id: string; // имя переменной в формулах
  label: string;
  kind?: "number" | "toggle"; // toggle — галочка: в формулах 1 (включено) или 0
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
  overpayment: Explained; // переплата (проценты + страховка + другие кредиты сценария)
  budget: Explained; // свободный бюджет в месяц
  pdn: Explained; // показатель долговой нагрузки, %
  schedule: Schedule;
  interest: number; // проценты по ипотеке за весь срок
  otherOverpayment: number; // переплата по другим кредитам сценария
  otherPayment: number; // платёж по другим кредитам сценария, ₽/мес
  otherSchedule?: Schedule; // график другого кредита (например, на ремонт) — для графиков
  insurance?: InsuranceCosts; // страховка по годам — если её считаем
};

export type Extras = {
  extraIncome: number;
  extraPayment: number;
  extraMonthly: number;
  extraOverpayment: number;
  otherSchedule?: Schedule; // график другого кредита, если сценарий его задал
};

const NO_EXTRAS: Extras = { extraIncome: 0, extraPayment: 0, extraMonthly: 0, extraOverpayment: 0 };

export function computeMetrics(
  loan: Loan,
  household: Household,
  events: ScheduleEvents = {},
  extras: Extras = NO_EXTRAS,
  insuranceSettings?: InsuranceSettings,
): Metrics {
  const schedule = buildSchedule(loan, events);
  // Страховка считается по фактическому графику: досрочка уменьшает остаток — дешевеет и полис
  const insurance = insuranceSettings ? insuranceCosts(schedule, insuranceSettings) : undefined;
  const insuranceTotal = insurance?.total ?? 0;
  // В бюджет — среднемесячная премия первого года, который оплачивается из своего кармана
  // (если премию первого года включили в кредит, это второй год)
  const insuranceMonthly = (insurance?.outOfPocketYearly ?? 0) / 12;
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

  // Переплата = проценты по графику (= P·n − S, если событий нет) + страховка + другие кредиты
  const overpayment = explained("overpayment", schedule.totalInterest + insuranceTotal + extras.extraOverpayment, {
    interest: inp(schedule.totalInterest, "Проценты по ипотеке, ₽"),
    insurance: inp(insuranceTotal, "Страховка за весь срок, ₽"),
    other: inp(extras.extraOverpayment, "Переплата по другим кредитам, ₽"),
  });

  const totalIncome = household.income + extras.extraIncome;
  // Свободный бюджет = доходы − расходы − все платежи (включая добровольную доплату) − страховка в месяц
  const budgetValue =
    totalIncome - household.expenses - P - extras.extraPayment - extras.extraMonthly - insuranceMonthly;
  const budget = explained("budget", budgetValue, {
    income: inp(household.income, "Доход семьи, ₽/мес"),
    extraIncome: inp(extras.extraIncome, "Дополнительный доход, ₽/мес"),
    expenses: inp(household.expenses, "Обязательные расходы, ₽/мес"),
    P: inp(P, "Платёж по ипотеке, ₽/мес"),
    extraPayment: inp(extras.extraPayment, "Платежи по другим кредитам, ₽/мес"),
    extraMonthly: inp(extras.extraMonthly, "Добровольная доплата, ₽/мес"),
    insurance: inp(insuranceMonthly, "Страховка в среднем, ₽/мес"),
  });

  // ПДН — по обязательным платежам, как в банке: без добровольной доплаты и без страховки
  const pdnValue = totalIncome > 0 ? ((P + extras.extraPayment) / totalIncome) * 100 : Infinity;
  const pdn = explained("pdn", pdnValue, {
    payments: inp(P + extras.extraPayment, "Обязательные платежи, ₽/мес"),
    income: inp(totalIncome, "Доход с учётом доп. дохода, ₽/мес"),
  });

  return {
    payment,
    months,
    overpayment,
    budget,
    pdn,
    schedule,
    interest: schedule.totalInterest,
    otherOverpayment: extras.extraOverpayment,
    otherPayment: extras.extraPayment,
    otherSchedule: extras.otherSchedule,
    insurance,
  };
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

// ── Выводы по сценарию ───────────────────────────────────────────
// Общие для всех сценариев правила, а не код под конкретный сценарий:
// срабатывают по тому, какие эффекты задал админ.

export type ScenarioInsights = {
  coverage?: Explained; // доход сценария покрывает X% платежа (есть extraIncome > 0)
  payback?: Explained; // через сколько месяцев окупятся расходы (сменилась ставка и есть разовые расходы)
  cushion?: Explained; // подушка на время сценария (бюджет ушёл в минус и задана длительность)
};

export function scenarioInsights(r: ScenarioResult): ScenarioInsights {
  const out: ScenarioInsights = {};
  const P = r.before.payment.value;

  const income = r.effects.extraIncome?.value ?? 0;
  if (income > 0 && P > 0) {
    out.coverage = explained("rentCoverage", (income / P) * 100, {
      income: inp(income, "Доход сценария, ₽/мес"),
      P: inp(P, "Платёж по ипотеке, ₽/мес"),
    });
  }

  // Окупаемость = расходы / снижение платежа
  const cost = r.effects.extraOverpayment?.value ?? 0;
  const saving = P - r.after.payment.value;
  if (r.effects.newRate && cost > 0 && saving > 0.5) {
    out.payback = explained("payback", Math.ceil(cost / saving), {
      cost: inp(cost, "Расходы, ₽"),
      before: inp(P, "Платёж до, ₽/мес"),
      after: inp(r.after.payment.value, "Платёж после, ₽/мес"),
    });
  }

  // Подушка = нехватка в месяц · длительность
  const lack = -r.after.budget.value;
  const months = r.effects.durationMonths?.value ?? 0;
  if (lack > 0 && months > 0) {
    out.cushion = explained("cushion", lack * months, {
      lack: inp(lack, "Не хватает в месяц, ₽"),
      months: inp(months, "Сколько месяцев"),
    });
  }
  return out;
}

export type ScenarioInput = {
  scenario: ScenarioDef;
  loan: Loan;
  household: Household;
  params: Record<string, number>; // значения параметров сценария
  globals: Record<string, number>; // глобальные параметры конфига (ставки, лимиты…)
  globalLabels?: Record<string, string>; // их подписи — для объяснений
  earlyMode?: EarlyMode;
  insurance?: InsuranceSettings; // страховка: учитывается и в «было», и в «стало»
};

export function applyScenario({
  scenario,
  loan,
  household,
  params,
  globals,
  globalLabels = {},
  earlyMode = "term",
  insurance,
}: ScenarioInput): ScenarioResult {
  const before = computeMetrics(loan, household, {}, NO_EXTRAS, insurance);
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
  value("durationMonths"); // в расчёт не входит: интерфейс считает по нему «подушку»

  // Другой кредит (ремонт и т.п.): строим его собственный график той же функцией, что и ипотеку.
  // Его платёж идёт в бюджет и ПДН, его проценты — в переплату.
  const loan2Amount = value("loan2Amount");
  if (loan2Amount && loan2Amount > 0) {
    const other = buildSchedule({
      principal: loan2Amount,
      ratePct: value("loan2Rate") ?? 0,
      months: Math.max(1, Math.round(value("loan2Months") ?? 12)),
    });
    extras.extraPayment += other.payment;
    extras.extraOverpayment += other.totalInterest;
    extras.otherSchedule = other;
  }

  const eventsFor = (mode: EarlyMode): ScheduleEvents => ({
    earlyPayments: earlyAmount
      ? [{ amount: earlyAmount, month: Math.max(1, Math.round(earlyMonth ?? 1)), mode }]
      : [],
    rateChanges: newRate !== undefined ? [{ ratePct: newRate, month: Math.max(1, Math.round(rateMonth ?? 1)) }] : [],
    extraMonthly: extras.extraMonthly,
  });

  const after = computeMetrics(loan, household, eventsFor(earlyMode), extras, insurance);
  const result: ScenarioResult = { before, after, effects };
  if (earlyAmount) {
    const other: EarlyMode = earlyMode === "term" ? "payment" : "term";
    result.alternative = { mode: other, after: computeMetrics(loan, household, eventsFor(other), extras, insurance) };
  }
  return result;
}
