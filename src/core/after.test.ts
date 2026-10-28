// Тесты модуля 3: состояние кредита на дату, обязательства по сельской ипотеке,
// источники данных гостя и «банка».

import { describe, expect, it } from "vitest";
import { annuityPayment, buildSchedule } from "./annuity";
import { deductionYears } from "./features";
import {
  addMonths,
  daysBetween,
  earlyNow,
  insuranceRefund,
  interestByYear,
  loanMilestones,
  loanStatus,
  paymentDate,
  paymentsBy,
  ruralObligations,
} from "./loanStatus";
import { bankClients, bankSource } from "../data/bankMock";
import { demoSource } from "../data/guest";
import { defaultConfig } from "../config/store";

const contract = { principal: 3_000_000, ratePct: 3, months: 240, issueDate: "2024-01-31" };

describe("даты", () => {
  it("прибавление месяцев не перескакивает через короткий месяц", () => {
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2024-01-31", 2)).toBe("2024-03-31");
    expect(addMonths("2024-03-15", -3)).toBe("2023-12-15");
  });

  it("дни между датами", () => {
    expect(daysBetween("2026-10-27", "2026-11-08")).toBe(12);
    expect(daysBetween("2026-11-08", "2026-10-27")).toBe(-12);
  });

  it("платёж в день наступления даты считается внесённым", () => {
    expect(paymentsBy("2024-01-10", "2024-02-09", 240)).toBe(0);
    expect(paymentsBy("2024-01-10", "2024-02-10", 240)).toBe(1);
  });
});

describe("состояние кредита", () => {
  it("до первого платежа остаток равен сумме кредита", () => {
    const s = loanStatus(contract, "2024-02-01");
    expect(s.paid).toBe(0);
    expect(s.balance.value).toBe(3_000_000);
    expect(s.next?.row.date).toBe("2024-02-29");
    expect(s.next?.amount.value).toBeCloseTo(annuityPayment(3_000_000, 3, 240), 2);
  });

  it("остаток и проценты совпадают с графиком", () => {
    const s = loanStatus(contract, "2026-10-27"); // 32 платежа: с февраля 2024 по сентябрь 2026 (31 октября ещё не наступило)
    const rows = buildSchedule(contract).rows;
    expect(s.paid).toBe(32);
    expect(s.balance.value).toBeCloseTo(rows[31].balance, 6);
    expect(s.interestPaid.value).toBeCloseTo(rows.slice(0, 32).reduce((a, r) => a + r.interest, 0), 6);
    expect(s.remaining.months).toBe(240 - 32);
    // На остатке платёж тот же, что и по договору
    expect(annuityPayment(s.remaining.principal, 3, s.remaining.months)).toBeCloseTo(s.next!.amount.value, 2);
  });

  it("прошлая досрочка в режиме «срок» уменьшает остаток и срок", () => {
    const withEarly = loanStatus({ ...contract, earlyPayments: [{ date: "2025-03-05", amount: 500_000, mode: "term" }] }, "2026-10-27");
    const without = loanStatus(contract, "2026-10-27");
    expect(without.balance.value - withEarly.balance.value).toBeGreaterThan(500_000);
    expect(withEarly.remaining.months).toBeLessThan(without.remaining.months);
    expect(withEarly.balance.inputs.early.value).toBe(500_000);
  });

  it("проценты по годам в сумме дают уплаченные проценты", () => {
    const s = loanStatus(contract, "2026-10-27");
    const years = interestByYear(s, contract.issueDate);
    expect(years.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(years.reduce((a, y) => a + y.interest, 0)).toBeCloseTo(s.interestPaid.value, 6);
  });

  it("досрочка сейчас: режим «срок» экономит больше, режим «платёж» снижает платёж", () => {
    const s = loanStatus(contract, "2026-10-27");
    const r = earlyNow(s.remaining, 300_000);
    expect(r.term.months.value).toBeLessThan(r.before.months.value);
    expect(r.payment.payment.value).toBeLessThan(r.before.payment.value);
    expect(r.term.overpayment.value).toBeLessThan(r.payment.overpayment.value);
  });
});

describe("обязательства по сельской ипотеке", () => {
  const rules = { checkEveryMonths: 6, obligationYears: 5, registrationDays: 180 };

  it("следующее подтверждение занятости и счётчик", () => {
    const o = ruralObligations("2024-05-08", "2026-10-27", rules);
    expect(o.checks).toHaveLength(10);
    expect(o.checksDone).toBe(4);
    expect(o.nextCheck).toBe("2026-11-08");
    expect(o.daysToCheck).toBe(12);
    expect(o.lastCheck).toBe("2026-05-08");
    expect(o.finished).toBe(false);
  });

  it("через 5 лет обязательства заканчиваются", () => {
    const o = ruralObligations("2020-01-15", "2026-10-27", rules);
    expect(o.finished).toBe(true);
    expect(o.nextCheck).toBeNull();
  });
});

describe("вычет", () => {
  it("лет до полного возврата — с округлением вверх", () => {
    // НДФЛ в год = 90 000 · 12 · 13% = 140 400 ₽; 260 000 / 140 400 → 2 года
    expect(deductionYears(260_000, 90_000, 13).value).toBe(2);
    expect(deductionYears(260_000, 0, 13).value).toBe(Infinity);
  });
});

describe("источники данных", () => {
  it("демо-кредит гостя выдан monthsAgo месяцев назад", async () => {
    const data = await demoSource(defaultConfig.after.guestDemo).load("2026-10-27");
    expect(data.kind).toBe("demo");
    expect(data.owner).toBeUndefined();
    expect(loanStatus(data.loan, "2026-10-27").paid).toBe(defaultConfig.after.guestDemo.monthsAgo);
  });

  it("банк сдвигает даты к «сегодня»: таймеры не устаревают", async () => {
    const id = bankClients()[0].id;
    const onAnchor = await bankSource(id).load("2026-10-27");
    const later = await bankSource(id).load("2027-03-01");
    expect(daysBetween(onAnchor.loan.issueDate, later.loan.issueDate)).toBe(daysBetween("2026-10-27", "2027-03-01"));
    expect(later.kind).toBe("bank");
    expect(later.owner?.name).toBeTruthy();
    expect(later.history?.length).toBeGreaterThan(0);
  });

  it("у демо-клиентов банка видны разные напоминания", async () => {
    const today = "2026-10-27";
    const [sokolova, lebedev] = await Promise.all(bankClients().slice(0, 2).map((c) => bankSource(c.id).load(today)));
    // Соколова: подтверждение занятости через 12 дней
    expect(ruralObligations(sokolova.loan.issueDate, today, { checkEveryMonths: 6, obligationYears: 5, registrationDays: 180 }).daysToCheck).toBe(12);
    // Лебедев: страховка заканчивается меньше чем через месяц
    expect(daysBetween(today, lebedev.insurance!.endDate)).toBeLessThan(defaultConfig.after.reminderDays);
  });
});

describe("вехи кредита и возврат страховки", () => {
  const market = { principal: 6_000_000, ratePct: 18.7, months: 240, issueDate: "2020-03-15" };

  it("рыночная ипотека: перелом «долг > проценты» позже половины срока, половина долга — ещё позже", () => {
    const status = loanStatus(market, "2026-10-28");
    const m = loanMilestones({ contract: market, status, today: "2026-10-28", interestLimit: 3_000_000 });
    const ids = m.map((x) => x.id);
    expect(ids[0]).toBe("issue");
    expect(ids.at(-1)).toBe("end");
    const crossover = m.find((x) => x.id === "crossover")!;
    const row = status.schedule.rows.find((r) => r.principal > r.interest)!;
    expect(crossover.date).toBe(paymentDate(market.issueDate, row.month));
    expect(status.schedule.rows[row.month - 2].principal).toBeLessThanOrEqual(status.schedule.rows[row.month - 2].interest);
    // Под 18,7% проценты за срок больше 3 млн — лимит вычета будет исчерпан
    expect(ids).toContain("interest-limit");
    expect(m.find((x) => x.id === "issue")!.past).toBe(true);
    expect(m.find((x) => x.id === "end")!.past).toBe(false);
  });

  it("сельская под 3%: долг больше процентов с первого платежа — вехи «перелом» нет, есть конец обязательств", () => {
    const status = loanStatus(contract, "2026-10-28");
    const m = loanMilestones({
      contract,
      status,
      today: "2026-10-28",
      rural: { checkEveryMonths: 6, obligationYears: 5, registrationDays: 180 },
      interestLimit: 3_000_000,
    });
    expect(m.some((x) => x.id === "crossover")).toBe(false);
    expect(m.find((x) => x.id === "rural")!.date).toBe("2029-01-31");
    expect(m.some((x) => x.id === "interest-limit")).toBe(false);
    const half = status.schedule.rows.find((r) => r.balance <= contract.principal / 2)!;
    expect(m.find((x) => x.id === "half")!.date).toBe(paymentDate(contract.issueDate, half.month));
  });

  it("возврат страховки пропорционален неиспользованным дням полиса", () => {
    expect(insuranceRefund(36_500, "2026-01-01", "2027-01-01", "2026-07-02").value).toBeCloseTo((36_500 * 183) / 365, 6);
    expect(insuranceRefund(36_500, "2026-01-01", "2027-01-01", "2027-02-01").value).toBe(0);
    expect(insuranceRefund(36_500, "2026-01-01", "2027-01-01", "2025-12-01").value).toBe(36_500);
  });
});
