import type { LoanProgram } from "../../config/schema";

// Базовый кредит, который вводит пользователь
export type BaseInput = {
  program: LoanProgram;
  principal: number; // S, ₽
  ratePct: number; // ставка, % годовых
  years: number; // срок, лет
  income: number; // доход семьи, ₽/мес
  expenses: number; // обязательные расходы, ₽/мес
};
