// Источник данных о кредите для модуля «Жизнь после ипотеки».
// Компоненты модуля работают только с LoanData и не знают, откуда она пришла:
// у гостя — демо-кредит или ручной ввод (guest.ts), у клиента — «банковский
// контур» (bankMock.ts). В настоящем приложении здесь был бы запрос к API банка.

import type { LoanContract } from "../core/loanStatus";
import type { LoanProgram } from "../core/scenarios";

export type SourceKind = "demo" | "manual" | "bank";

export type Owner = {
  id: string;
  name: string;
  contractNo: string; // номер кредитного договора
};

export type InsurancePolicy = {
  company: string;
  title: string; // что застраховано
  number: string;
  startDate: string;
  endDate: string;
  premium: number; // взнос за год, ₽
};

// Запись истории платежей — то, что банк знает, а гость ввести не может
export type PaymentRecord = { date: string; amount: number; kind: "regular" | "early" };

export type LoanData = {
  kind: SourceKind;
  owner?: Owner; // только у клиента банка
  program: LoanProgram;
  propertyTitle: string;
  propertyPrice: number; // стоимость жилья — для имущественного вычета
  loan: LoanContract;
  insurance?: InsurancePolicy; // только у клиента банка
  history?: PaymentRecord[]; // только у клиента банка
};

export interface DataSource {
  readonly kind: SourceKind;
  load(today: string): Promise<LoanData>;
}

// «Сегодня» по часам браузера — в локальном часовом поясе, а не в UTC
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
