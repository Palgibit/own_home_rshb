// Аннуитетный кредит: платёж, срок и помесячный график с событиями
// (досрочные платежи, ежемесячная доплата, смена ставки).
// Чистые функции, без React и браузерных API.

export type Loan = {
  principal: number; // S — сумма кредита (или текущий остаток), ₽
  ratePct: number; // годовая ставка, %
  months: number; // n — срок (или оставшийся срок), мес
};

// Месячная ставка: i = rate / 12 / 100
export function monthlyRate(ratePct: number): number {
  return ratePct / 12 / 100;
}

// Аннуитетный платёж: P = S·i / (1 − (1+i)^(−n)).
// При нулевой ставке формула вырождается в S / n.
export function annuityPayment(principal: number, ratePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const i = monthlyRate(ratePct);
  if (i === 0) return principal / months;
  return (principal * i) / (1 - Math.pow(1 + i, -months));
}

// Срок при заданном платеже: n = −ln(1 − S·i/P) / ln(1+i).
// Если платёж не покрывает даже проценты (S·i ≥ P), кредит не гасится — Infinity.
export function termForPayment(principal: number, ratePct: number, payment: number): number {
  if (principal <= 0) return 0;
  const i = monthlyRate(ratePct);
  if (i === 0) return principal / payment;
  const x = 1 - (principal * i) / payment;
  if (x <= 0) return Infinity;
  return -Math.log(x) / Math.log(1 + i);
}

export type EarlyMode = "term" | "payment"; // уменьшить срок / уменьшить платёж

export type ScheduleEvents = {
  // Разовые досрочные платежи: вносятся после регулярного платежа месяца `month`.
  earlyPayments?: { month: number; amount: number; mode: EarlyMode }[];
  // Доплата к каждому платежу — уменьшает срок.
  extraMonthly?: number;
  // Смена ставки с месяца `month` (включительно): платёж пересчитывается на оставшийся срок.
  rateChanges?: { month: number; ratePct: number }[];
};

export type ScheduleRow = {
  month: number;
  ratePct: number;
  payment: number; // регулярный платёж этого месяца (последний может быть меньше)
  interest: number; // проценты = остаток · i
  principal: number; // тело = платёж − проценты
  extra: number; // досрочно внесено в этом месяце
  balance: number; // остаток после платежа
};

export type Schedule = {
  rows: ScheduleRow[];
  payment: number; // действующий платёж в конце графика (после всех пересчётов)
  months: number; // фактический срок
  totalInterest: number; // переплата
  totalPaid: number;
  // Последний пересчёт платежа — для объяснения «откуда платёж»
  lastRecalc: { balance: number; ratePct: number; months: number };
};

const MAX_MONTHS = 1200; // защита от бесконечного цикла (100 лет)
const EPS = 0.005; // остаток меньше полкопейки считаем погашенным

export function buildSchedule(loan: Loan, events: ScheduleEvents = {}): Schedule {
  let balance = loan.principal;
  let ratePct = loan.ratePct;
  let payment = annuityPayment(balance, ratePct, loan.months);
  let lastRecalc = { balance, ratePct, months: loan.months };
  const rows: ScheduleRow[] = [];
  let totalInterest = 0;
  let totalPaid = 0;

  for (let m = 1; balance > EPS && m <= MAX_MONTHS; m++) {
    // Оставшийся срок по договору на начало месяца m
    const remaining = Math.max(loan.months - m + 1, 1);

    // Смена ставки: банк пересчитывает платёж на оставшийся срок
    const change = events.rateChanges?.find((c) => c.month === m);
    if (change) {
      ratePct = change.ratePct;
      payment = annuityPayment(balance, ratePct, remaining);
      lastRecalc = { balance, ratePct, months: remaining };
    }

    const interest = balance * monthlyRate(ratePct);
    // В последний месяц платим ровно остаток с процентами
    const regular = Math.min(payment, balance + interest);
    const principalPart = regular - interest;
    balance -= principalPart;

    let extra = Math.min(events.extraMonthly ?? 0, balance);
    balance -= extra;

    for (const e of events.earlyPayments ?? []) {
      if (e.month !== m) continue;
      const amount = Math.min(e.amount, balance);
      balance -= amount;
      extra += amount;
      // Режим «уменьшить платёж»: срок прежний, платёж пересчитывается.
      // Режим «уменьшить срок»: платёж прежний, кредит закончится раньше.
      if (e.mode === "payment" && remaining > 1) {
        payment = annuityPayment(balance, ratePct, remaining - 1);
        lastRecalc = { balance, ratePct, months: remaining - 1 };
      }
    }

    totalInterest += interest;
    totalPaid += regular + extra;
    rows.push({ month: m, ratePct, payment: regular, interest, principal: principalPart, extra, balance: Math.max(balance, 0) });
  }

  return { rows, payment, months: rows.length, totalInterest, totalPaid, lastRecalc };
}

// Проценты, начисленные в месяцах (from; to]
export function interestBetween(schedule: Schedule, from: number, to: number): number {
  return schedule.rows.slice(from, to).reduce((sum, r) => sum + r.interest, 0);
}
