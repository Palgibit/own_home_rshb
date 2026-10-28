// Фичи симулятора поверх графика платежей:
// «досрочка или вклад», «чашка кофе», реальная стоимость платежа, налоговый вычет.

import { annuityPayment, buildSchedule, interestBetween, type Loan, type ScheduleEvents } from "./annuity";
import { explained, inp, type Explained } from "./explain";
import { purchaseWarnings, type PurchaseLimits, type PurchaseWarnings } from "./purchase";

// ── Фича 1. Досрочка или вклад ────────────────────────────────────
//
// Сравниваем две судьбы суммы X в месяце k на горизонте h месяцев:
//  • вклад: доход = X·((1 + d/12)^h − 1)·(1 − налог);
//  • досрочка (режим «уменьшить срок»): платежи те же, а процентов за эти
//    h месяцев начисляется меньше. Экономия = проценты без досрочки − с досрочкой.
// Платежи в обоих вариантах одинаковы, поэтому разница в процентах — честная
// цена досрочки. Горизонт обрезаем, если кредит с досрочкой закончится раньше.

export type DepositVsEarlyInput = {
  loan: Loan;
  amount: number; // X
  month: number; // k — когда появились деньги
  horizon: number; // h, мес
  depositRatePct: number; // d, % годовых
  depositTaxPct: number; // налог на проценты по вкладу, %
  events?: ScheduleEvents; // например, смена ставки при потере льготы
};

export type DepositVsEarly = {
  deposit: Explained; // доход по вкладу за горизонт
  early: Explained; // экономия на процентах за горизонт
  winner: "deposit" | "early";
  difference: number; // насколько победитель лучше, ₽
  horizon: number; // фактический горизонт
  fullTermSaving: number; // экономия на процентах за весь срок (справочно)
};

export function depositVsEarly(input: DepositVsEarlyInput): DepositVsEarly {
  const { loan, amount, month: k, depositRatePct, depositTaxPct, events = {} } = input;
  const base = buildSchedule(loan, events);
  const withEarly = buildSchedule(loan, {
    ...events,
    earlyPayments: [...(events.earlyPayments ?? []), { month: k, amount, mode: "term" }],
  });
  const h = Math.max(0, Math.min(input.horizon, withEarly.months - k));

  const earlyValue = interestBetween(base, k, k + h) - interestBetween(withEarly, k, k + h);
  const early = explained("earlySaving", earlyValue, {
    X: inp(amount, "Сумма, ₽"),
    k: inp(k, "Месяц платежа"),
    h: inp(h, "Горизонт, мес"),
    without: inp(interestBetween(base, k, k + h), "Проценты за горизонт без досрочки, ₽"),
    with: inp(interestBetween(withEarly, k, k + h), "Проценты за горизонт с досрочкой, ₽"),
  });

  const d = depositRatePct / 100;
  const depositValue = amount * (Math.pow(1 + d / 12, h) - 1) * (1 - depositTaxPct / 100);
  const deposit = explained("deposit", depositValue, {
    X: inp(amount, "Сумма, ₽"),
    d: inp(depositRatePct, "Ставка вклада, % годовых"),
    h: inp(h, "Горизонт, мес"),
    tax: inp(depositTaxPct, "Налог на проценты, %"),
  });

  const winner = depositValue > earlyValue ? "deposit" : "early";
  return {
    deposit,
    early,
    winner,
    difference: Math.abs(depositValue - earlyValue),
    horizon: h,
    fullTermSaving: base.totalInterest - withEarly.totalInterest,
  };
}

// Ставка вклада, при которой вклад и досрочка дают одинаково.
// Экономия от досрочки E от ставки вклада не зависит, а доход по вкладу
// растёт вместе со ставкой. Приравниваем X·((1 + d/12)^h − 1)·(1 − налог) = E
// и выражаем d:  d = 12 · ((1 + E / (X·(1 − налог)))^(1/h) − 1).
// Выше этой ставки выгоднее вклад, ниже — досрочка.
export function breakEvenDepositRate(r: DepositVsEarly, amount: number, depositTaxPct: number): Explained {
  const E = r.early.value;
  const h = r.horizon;
  const kept = 1 - depositTaxPct / 100; // какая доля процентов остаётся после налога
  const value =
    h > 0 && amount > 0 && kept > 0 ? 12 * (Math.pow(1 + Math.max(0, E) / (amount * kept), 1 / h) - 1) * 100 : NaN;
  return explained("breakEvenDeposit", value, {
    E: inp(E, "Экономия от досрочки за горизонт, ₽"),
    X: inp(amount, "Сумма, ₽"),
    h: inp(h, "Горизонт, мес"),
    tax: inp(depositTaxPct, "Налог на проценты, %"),
  });
}

// ── Фича 3. Досрочка «чашкой кофе» ───────────────────────────────

export type CoffeeResult = {
  monthsSaved: Explained;
  interestSaved: Explained;
  newMonths: number;
};

// +extra ₽ к каждому платежу: насколько раньше закроем и сколько сэкономим
export function coffee(loan: Loan, extra: number): CoffeeResult {
  const base = buildSchedule(loan);
  const fast = buildSchedule(loan, { extraMonthly: extra });
  const inputs = {
    extra: inp(extra, "Доплата, ₽/мес"),
    base: inp(base.months, "Срок без доплаты, мес"),
    fast: inp(fast.months, "Срок с доплатой, мес"),
  };
  return {
    monthsSaved: explained("coffeeMonths", base.months - fast.months, inputs),
    interestSaved: explained("coffeeInterest", base.totalInterest - fast.totalInterest, {
      base: inp(base.totalInterest, "Переплата без доплаты, ₽"),
      fast: inp(fast.totalInterest, "Переплата с доплатой, ₽"),
    }),
    newMonths: fast.months,
  };
}

// Обратный вопрос: закрыть за targetMonths — сколько доплачивать в месяц.
// Доплата = P(n_target) − P(n)
export function extraForTarget(loan: Loan, targetMonths: number): Explained {
  const P = annuityPayment(loan.principal, loan.ratePct, loan.months);
  const Pt = annuityPayment(loan.principal, loan.ratePct, targetMonths);
  return explained("targetExtra", Math.max(0, Pt - P), {
    Pt: inp(Pt, `Платёж при сроке ${targetMonths} мес, ₽`),
    P: inp(P, "Текущий платёж, ₽"),
  });
}

// ── Фича 4. Реальная стоимость платежа ───────────────────────────
// Вес платежа в сегодняшних рублях: P / (1+π)^t, t — годы от сегодня

export function realPayments(payment: number, inflationPct: number, years: number) {
  const pi = inflationPct / 100;
  return Array.from({ length: Math.max(0, Math.ceil(years)) }, (_, t) => ({
    year: t + 1,
    nominal: payment,
    real: payment / Math.pow(1 + pi, t),
  }));
}

// ── Налоговый вычет ──────────────────────────────────────────────
// Имущественный: ставка НДФЛ × min(стоимость, лимит).
// По процентам: ставка НДФЛ × min(уплаченные проценты, лимит).
// Ставка и лимиты — из конфига: правила меняются, проверяйте на сайте ФНС.

export function propertyDeduction(cost: number, ndflPct: number, limit: number): Explained {
  return explained("deductionProperty", (Math.min(cost, limit) * ndflPct) / 100, {
    cost: inp(cost, "Стоимость жилья, ₽"),
    limit: inp(limit, "Лимит расходов, ₽"),
    ndfl: inp(ndflPct, "Ставка НДФЛ, %"),
  });
}

export function interestDeduction(interestPaid: number, ndflPct: number, limit: number): Explained {
  return explained("deductionInterest", (Math.min(interestPaid, limit) * ndflPct) / 100, {
    interest: inp(interestPaid, "Уплаченные проценты, ₽"),
    limit: inp(limit, "Лимит процентов, ₽"),
    ndfl: inp(ndflPct, "Ставка НДФЛ, %"),
  });
}

// Вычет возвращают не больше, чем НДФЛ, уплаченный за год, — остаток переносится.
// Лет до полного возврата = ⌈вычет / (зарплата · 12 · НДФЛ)⌉
export function deductionYears(refund: number, monthlySalary: number, ndflPct: number): Explained {
  const perYear = (monthlySalary * 12 * ndflPct) / 100;
  return explained("deductionYears", perYear > 0 ? Math.ceil(refund / perYear) : Infinity, {
    refund: inp(refund, "Сумма к возврату, ₽"),
    salary: inp(monthlySalary, "Зарплата до вычета налога, ₽/мес"),
    perYear: inp(perYear, "НДФЛ за год — максимум возврата в год, ₽"),
  });
}

// Вес одного платежа через t лет — с объяснением для поповера
export function realPaymentAt(payment: number, inflationPct: number, years: number): Explained {
  return explained("realPayment", payment / Math.pow(1 + inflationPct / 100, years), {
    P: inp(payment, "Платёж по договору, ₽"),
    pi: inp(inflationPct, "Инфляция, % в год"),
    t: inp(years, "Через сколько лет"),
  });
}

// ── Фича 2. Город или село: сравниватель двух вариантов ──────────
//
// Посетитель сам задаёт у каждого варианта цену, площадь, кредит, ставку,
// срок и содержание жилья в месяц. Взнос = цена − кредит. В бюджет входит
// содержание: в доме коммуналка и обслуживание обычно дороже, чем в квартире.
// Предупреждения — те же, что в симуляторе: взнос ниже минимума программы,
// кредит выше лимита.

export type HomeOptionInput = {
  price: number;
  area: number; // м²
  loan: number; // сумма кредита, ₽
  ratePct: number;
  months: number;
  upkeep: number; // содержание жилья, ₽/мес
  limits: PurchaseLimits; // минимальный взнос и лимит кредита программы
  income: number;
  expenses: number;
  familySize: number;
};

export type HomeOption = {
  downPayment: Explained;
  payment: Explained;
  overpayment: Explained;
  budget: Explained;
  areaPerPerson: Explained;
  warnings: PurchaseWarnings & { loanOverPrice?: boolean };
};

export function homeOption(o: HomeOptionInput): HomeOption {
  const loan = Math.max(0, Math.min(o.loan, o.price));
  const down = o.price - loan;
  const P = annuityPayment(loan, o.ratePct, o.months);
  const warnings: HomeOption["warnings"] = purchaseWarnings(o.price, down, loan, o.limits);
  if (o.loan > o.price) warnings.loanOverPrice = true;
  return {
    warnings,
    downPayment: explained("homeDown", down, {
      price: inp(o.price, "Цена, ₽"),
      loan: inp(loan, "Сумма кредита, ₽"),
    }),
    payment: explained("annuity", P, {
      S: inp(loan, "Сумма кредита, ₽"),
      rate: inp(o.ratePct, "Ставка, % годовых"),
      n: inp(o.months, "Срок, мес"),
    }),
    overpayment: explained("overpayment", P * o.months - loan, {
      P: inp(P, "Платёж, ₽/мес"),
      n: inp(o.months, "Срок, мес"),
      S: inp(loan, "Сумма кредита, ₽"),
    }),
    budget: explained("homeBudget", o.income - o.expenses - P - o.upkeep, {
      income: inp(o.income, "Доход семьи, ₽/мес"),
      expenses: inp(o.expenses, "Обязательные расходы, ₽/мес"),
      P: inp(P, "Платёж по ипотеке, ₽/мес"),
      upkeep: inp(o.upkeep, "Содержание жилья, ₽/мес"),
    }),
    areaPerPerson: explained("areaPerPerson", o.area / Math.max(1, o.familySize), {
      area: inp(o.area, "Площадь, м²"),
      people: inp(o.familySize, "Человек в семье"),
    }),
  };
}
