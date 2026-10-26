// «Банковский контур»: имитация API банка с данными демо-клиентов.
// Данные лежат в bankClients.json и записаны на дату anchorDate. При загрузке
// все даты сдвигаются так, чтобы anchorDate стала «сегодня»: тогда таймеры
// и напоминания в демо всегда живые, в какой бы день его ни открыли.

import raw from "./bankClients.json";
import { addDays, daysBetween, loanStatus, paymentDate } from "../core/loanStatus";
import type { DataSource, LoanData, PaymentRecord } from "./DataSource";

type Client = Omit<LoanData, "kind" | "history">;

const anchorDate = raw.anchorDate;
// Через unknown: TypeScript выводит из JSON слишком широкие типы (string вместо "rural" | "market")
const clients = raw.clients as unknown as Client[];

const LATENCY_MS = 500; // «запрос к банку» занимает время — показываем загрузку

export type ClientSummary = { id: string; name: string; program: LoanData["program"]; propertyTitle: string };

export function bankClients(): ClientSummary[] {
  return clients.map((c) => ({ id: c.owner!.id, name: c.owner!.name, program: c.program, propertyTitle: c.propertyTitle }));
}

function shiftDates(c: Client, days: number): Client {
  const s = (iso: string) => addDays(iso, days);
  return {
    ...c,
    loan: {
      ...c.loan,
      issueDate: s(c.loan.issueDate),
      earlyPayments: c.loan.earlyPayments?.map((e) => ({ ...e, date: s(e.date) })),
    },
    insurance: c.insurance && { ...c.insurance, startDate: s(c.insurance.startDate), endDate: s(c.insurance.endDate) },
  };
}

// История платежей: в настоящем банке это записи из учётной системы,
// в демо — внесённые платежи по графику (все вовремя) плюс досрочки
function history(c: Client, today: string): PaymentRecord[] {
  const status = loanStatus(c.loan, today);
  const regular: PaymentRecord[] = status.schedule.rows
    .slice(0, status.paid)
    .map((r) => ({ date: paymentDate(c.loan.issueDate, r.month), amount: r.payment, kind: "regular" }));
  const early: PaymentRecord[] = (c.loan.earlyPayments ?? []).map((e) => ({ date: e.date, amount: e.amount, kind: "early" }));
  return [...regular, ...early].sort((a, b) => (a.date < b.date ? 1 : -1)); // новые сверху
}

export function bankSource(clientId: string): DataSource {
  return {
    kind: "bank",
    load: (today) =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          const found = clients.find((c) => c.owner?.id === clientId);
          if (!found) return reject(new Error("Клиент не найден"));
          const client = shiftDates(found, daysBetween(anchorDate, today));
          resolve({ ...client, kind: "bank", history: history(client, today) });
        }, LATENCY_MS);
      }),
  };
}
