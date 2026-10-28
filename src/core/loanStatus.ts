// Модуль 3. Состояние действующего кредита на сегодня: остаток, следующий платёж,
// уплаченные проценты, обязательства по сельской ипотеке.
// Всё считается тем же графиком платежей, что и в симуляторе (core/annuity).
// Даты — строки ISO «ГГГГ-ММ-ДД»; «сегодня» передаётся параметром, поэтому
// функции чистые и проверяются тестами на любой день.

import { annuityPayment, buildSchedule, type EarlyMode, type Loan, type Schedule, type ScheduleRow } from "./annuity";
import { explained, inp, type Explained } from "./explain";
import { computeMetrics, type Metrics } from "./scenarios";

// ── Даты ─────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function toUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// +n месяцев; если такого дня нет (31 → февраль), берём последний день месяца
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return fromUtc(first.getTime());
}

export function addDays(iso: string, n: number): string {
  return fromUtc(toUtc(iso) + n * DAY_MS);
}

// Сколько дней от a до b (отрицательно, если b раньше a)
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

// Платёж №m приходится на тот же день месяца через m месяцев после выдачи
export function paymentDate(issueDate: string, m: number): string {
  return addMonths(issueDate, m);
}

// Сколько платежей по графику уже наступило к дате (строки ISO сравниваются как даты)
export function paymentsBy(issueDate: string, date: string, maxMonths: number): number {
  let m = 0;
  while (m < maxMonths && paymentDate(issueDate, m + 1) <= date) m++;
  return m;
}

// ── Состояние кредита ────────────────────────────────────────────

export type LoanContract = {
  principal: number; // сумма по договору, ₽
  ratePct: number; // ставка по договору, % годовых
  months: number; // срок по договору, мес
  issueDate: string; // дата выдачи
  // Уже внесённые досрочные платежи: дата и режим (срок/платёж)
  earlyPayments?: { date: string; amount: number; mode: EarlyMode }[];
};

export type DatedRow = ScheduleRow & { date: string };

export type LoanStatus = {
  schedule: Schedule; // весь график с учётом прошлых досрочек
  paid: number; // сколько платежей уже внесено
  balance: Explained; // остаток долга на сегодня
  interestPaid: Explained; // проценты, уплаченные с начала кредита
  progress: Explained; // погашено долга, %
  next: { row: DatedRow; amount: Explained } | null; // следующий платёж
  upcoming: DatedRow[]; // ближайшие платежи
  endDate: string; // дата последнего платежа по графику
  // Остаток как «новый кредит»: на нём считаются досрочка и фичи симулятора
  remaining: Loan;
  interestTotal: number; // проценты за весь срок по графику
};

export function loanStatus(contract: LoanContract, today: string, upcomingCount = 6): LoanStatus {
  // Дату досрочки переводим в номер месяца: деньги идут в погашение
  // после последнего наступившего платежа (не раньше первого)
  const schedule = buildSchedule(contract, {
    earlyPayments: (contract.earlyPayments ?? []).map((e) => ({
      month: Math.max(1, paymentsBy(contract.issueDate, e.date, contract.months)),
      amount: e.amount,
      mode: e.mode,
    })),
  });

  const dated: DatedRow[] = schedule.rows.map((r) => ({ ...r, date: paymentDate(contract.issueDate, r.month) }));
  const paid = Math.min(paymentsBy(contract.issueDate, today, contract.months), schedule.months);
  const done = dated.slice(0, paid);

  const regularPrincipal = done.reduce((s, r) => s + r.principal, 0);
  const earlyTotal = done.reduce((s, r) => s + r.extra, 0);
  const balanceValue = paid > 0 ? dated[paid - 1].balance : contract.principal;
  const interestPaidValue = done.reduce((s, r) => s + r.interest, 0);

  // Остаток = сумма кредита − долг, погашенный регулярными и досрочными платежами
  const balance = explained("loanBalance", balanceValue, {
    S: inp(contract.principal, "Сумма кредита, ₽"),
    regular: inp(regularPrincipal, "Погашено в регулярных платежах, ₽"),
    early: inp(earlyTotal, "Погашено досрочно, ₽"),
  });

  const interestPaid = explained("interestPaid", interestPaidValue, {
    paid: inp(paid, "Внесено платежей"),
    interest: inp(interestPaidValue, "Проценты в этих платежах, ₽"),
  });

  const progress = explained("loanProgress", ((contract.principal - balanceValue) / contract.principal) * 100, {
    repaid: inp(contract.principal - balanceValue, "Погашено долга, ₽"),
    S: inp(contract.principal, "Сумма кредита, ₽"),
  });

  const nextRow = dated[paid];
  const next = nextRow
    ? {
        row: nextRow,
        // Платёж = проценты за месяц (остаток · i) + часть долга
        amount: explained("nextPayment", nextRow.payment, {
          interest: inp(nextRow.interest, "Проценты за месяц, ₽"),
          principal: inp(nextRow.principal, "Погашение долга, ₽"),
          rate: inp(nextRow.ratePct, "Ставка, % годовых"),
        }),
      }
    : null;

  return {
    schedule,
    paid,
    balance,
    interestPaid,
    progress,
    next,
    upcoming: dated.slice(paid, paid + upcomingCount),
    endDate: dated[dated.length - 1]?.date ?? contract.issueDate,
    remaining: {
      principal: balanceValue,
      ratePct: contract.ratePct,
      // Фактический остаток срока: после досрочек «в срок» он короче договорного
      months: Math.max(1, schedule.months - paid),
    },
    interestTotal: schedule.totalInterest,
  };
}

// Проценты по календарным годам — нужны для вычета и справки об уплаченных процентах
export function interestByYear(status: LoanStatus, issueDate: string): { year: number; interest: number }[] {
  const byYear = new Map<number, number>();
  for (const r of status.schedule.rows.slice(0, status.paid)) {
    const year = Number(paymentDate(issueDate, r.month).slice(0, 4));
    byYear.set(year, (byYear.get(year) ?? 0) + r.interest);
  }
  return [...byYear].map(([year, interest]) => ({ year, interest }));
}

// ── Досрочка и изменение срока на остатке ────────────────────────

// Досрочка «сейчас» — вместе с ближайшим платежом (месяц 1 остатка), в двух режимах
export function earlyNow(remaining: Loan, amount: number): { before: Metrics; term: Metrics; payment: Metrics } {
  const none = { income: 0, expenses: 0 }; // бюджет здесь не нужен
  const at = (mode: EarlyMode) => computeMetrics(remaining, none, { earlyPayments: [{ month: 1, amount, mode }] });
  return { before: computeMetrics(remaining, none), term: at("term"), payment: at("payment") };
}

// Платёж на остаток долга — при другом сроке ({...remaining, months})
// или другой ставке ({...remaining, ratePct: lossRate} — потеря льготы)
export function remainingPayment(remaining: Loan): Explained {
  return explained("annuity", annuityPayment(remaining.principal, remaining.ratePct, remaining.months), {
    S: inp(remaining.principal, "Остаток долга, ₽"),
    rate: inp(remaining.ratePct, "Ставка, % годовых"),
    n: inp(remaining.months, "Срок, мес"),
  });
}

// ── Обязательства по сельской ипотеке ────────────────────────────
//
// В течение obligationYears лет после выдачи: подтверждать занятость каждые
// checkEveryMonths месяцев и жить в доме (регистрация в течение registrationDays дней,
// затем подтверждать ежегодно). Упрощение: отсчёт от даты выдачи кредита.

export type RuralRules = { checkEveryMonths: number; obligationYears: number; registrationDays: number };

export type RuralObligations = {
  checks: string[]; // все даты подтверждения занятости
  checksDone: number; // сколько дат уже прошло
  nextCheck: string | null;
  daysToCheck: number | null;
  lastCheck: string | null; // предыдущая дата подтверждения
  obligationsEnd: string;
  finished: boolean; // все обязательства позади
  registrationDeadline: string;
  nextRegistrationCheck: string | null; // ежегодное подтверждение регистрации
};

export function ruralObligations(issueDate: string, today: string, rules: RuralRules): RuralObligations {
  const totalMonths = Math.round(rules.obligationYears * 12);
  const every = Math.max(1, rules.checkEveryMonths);
  const checks = Array.from({ length: Math.floor(totalMonths / every) }, (_, k) => addMonths(issueDate, (k + 1) * every));
  // Дата подтверждения «сегодня» ещё не прошла — до вечера можно успеть
  const checksDone = checks.filter((d) => d < today).length;
  const nextCheck = checks[checksDone] ?? null;
  const registrationChecks = Array.from({ length: Math.floor(totalMonths / 12) }, (_, k) => addMonths(issueDate, (k + 1) * 12));
  const obligationsEnd = addMonths(issueDate, totalMonths);
  return {
    checks,
    checksDone,
    nextCheck,
    daysToCheck: nextCheck ? daysBetween(today, nextCheck) : null,
    lastCheck: checksDone > 0 ? checks[checksDone - 1] : null,
    obligationsEnd,
    finished: obligationsEnd < today,
    registrationDeadline: addDays(issueDate, rules.registrationDays),
    nextRegistrationCheck: registrationChecks.find((d) => d >= today) ?? null,
  };
}

// ── Вехи кредита ─────────────────────────────────────────────────
//
// Ключевые даты по графику: выдача, первый вычет, перелом «долг в платеже больше
// процентов», половина долга, конец обязательств по сельской ипотеке, исчерпание
// лимита вычета по процентам, последний платёж. Всё — из того же графика платежей.

export type Milestone = {
  id: string;
  date: string;
  title: string;
  text: string;
  past: boolean; // дата уже наступила
};

export type MilestoneInput = {
  contract: LoanContract;
  status: LoanStatus;
  today: string;
  rural?: RuralRules; // только для сельской ипотеки
  interestLimit: number; // лимит вычета по процентам, ₽
};

export function loanMilestones({ contract, status, today, rural, interestLimit }: MilestoneInput): Milestone[] {
  const rows = status.schedule.rows;
  const at = (month: number) => paymentDate(contract.issueDate, month);
  const list: Omit<Milestone, "past">[] = [
    { id: "issue", date: contract.issueDate, title: "Кредит выдан", text: "Начало пути: первый платёж — через месяц." },
  ];

  // Вычет за год можно заявить со следующего года
  const issueYear = Number(contract.issueDate.slice(0, 4));
  list.push({
    id: "deduction",
    date: `${issueYear + 1}-01-01`,
    title: "Можно заявить первый вычет",
    text: `За ${issueYear} год: имущественный и по уплаченным процентам. Дальше — каждый год.`,
  });

  // Перелом: с этого месяца в платеже долг больше процентов. Если так с первого платежа — веху не показываем
  const crossover = rows.find((r) => r.principal > r.interest);
  if (crossover && crossover.month > 1) {
    list.push({
      id: "crossover",
      date: at(crossover.month),
      title: "Долг в платеже больше процентов",
      text: "До этого большая часть платежа уходила банку как проценты, дальше — в счёт долга.",
    });
  }

  const half = rows.find((r) => r.balance <= contract.principal / 2);
  if (half) list.push({ id: "half", date: at(half.month), title: "Погашена половина долга", text: "Дальше долг тает всё быстрее." });

  if (rural) {
    list.push({
      id: "rural",
      date: addMonths(contract.issueDate, Math.round(rural.obligationYears * 12)),
      title: "Обязательства по сельской ипотеке выполнены",
      text: "Больше не нужно подтверждать работу и регистрацию — льготная ставка остаётся.",
    });
  }

  // Лимит вычета по процентам: накопленные проценты достигли лимита
  let acc = 0;
  const limitRow = rows.find((r) => (acc += r.interest) >= interestLimit);
  if (limitRow) {
    list.push({
      id: "interest-limit",
      date: at(limitRow.month),
      title: "Лимит вычета по процентам исчерпан",
      text: "Проценты сверх лимита к вычету уже не принимают.",
    });
  }

  list.push({ id: "end", date: status.endDate, title: "Последний платёж", text: "Кредит закрыт: остаётся снять обременение." });

  return list.sort((a, b) => a.date.localeCompare(b.date)).map((m) => ({ ...m, past: m.date <= today }));
}

// ── Возврат части страховки при полном досрочном погашении ───────
//
// Если кредит закрыт досрочно, часть премии за неиспользованный срок полиса
// можно вернуть: премия · неиспользованные дни / дни полиса. Условно — точную
// сумму назовёт страховая (из неё могут вычесть расходы).

export function insuranceRefund(premium: number, startDate: string, endDate: string, closeDate: string): Explained {
  const total = Math.max(1, daysBetween(startDate, endDate));
  const unused = Math.min(total, Math.max(0, daysBetween(closeDate, endDate)));
  return explained("insuranceRefund", (premium * unused) / total, {
    premium: inp(premium, "Премия за год, ₽"),
    unused: inp(unused, "Неиспользованных дней полиса"),
    total: inp(total, "Дней в полисе"),
  });
}
