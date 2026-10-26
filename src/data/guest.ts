// Гость публичного сайта: демо-кредит из конфига или кредит, введённый вручную.
// Ни владельца, ни страховки, ни истории платежей — их знает только банк.

import { addMonths } from "../core/loanStatus";
import type { LoanProgram } from "../core/scenarios";
import type { DataSource, LoanData } from "./DataSource";

// Кредит, который гость вводит руками
export type GuestLoanInput = {
  program: LoanProgram;
  principal: number;
  ratePct: number;
  years: number;
  issueDate: string;
  propertyPrice: number;
};

// Демо-кредит в конфиге задан как «выдан N месяцев назад», чтобы всегда выглядеть живым
export type GuestDemo = Omit<GuestLoanInput, "issueDate"> & { monthsAgo: number; propertyTitle: string };

export function demoInput(demo: GuestDemo, today: string): GuestLoanInput {
  return {
    program: demo.program,
    principal: demo.principal,
    ratePct: demo.ratePct,
    years: demo.years,
    propertyPrice: demo.propertyPrice,
    issueDate: addMonths(today, -demo.monthsAgo),
  };
}

function toLoanData(kind: "demo" | "manual", input: GuestLoanInput, propertyTitle: string): LoanData {
  return {
    kind,
    program: input.program,
    propertyTitle,
    propertyPrice: input.propertyPrice,
    loan: {
      principal: input.principal,
      ratePct: input.ratePct,
      months: Math.max(1, Math.round(input.years * 12)),
      issueDate: input.issueDate,
    },
  };
}

export function demoSource(demo: GuestDemo): DataSource {
  return {
    kind: "demo",
    load: async (today) => toLoanData("demo", demoInput(demo, today), demo.propertyTitle),
  };
}

export function manualSource(input: GuestLoanInput): DataSource {
  return {
    kind: "manual",
    load: async () => toLoanData("manual", input, "Ваше жильё"),
  };
}
