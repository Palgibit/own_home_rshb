import type { LoanProgram } from "../../config/schema";

// Базовый кредит, который вводит пользователь
export type BaseInput = {
  program: LoanProgram;
  price: number; // стоимость жилья, ₽
  downPayment: number; // первоначальный взнос, ₽
  ratePct: number; // базовая ставка, % годовых (до скидок и надбавок)
  years: number; // срок, лет
  income: number; // доход семьи, ₽/мес
  expenses: number; // обязательные расходы, ₽/мес
};

// Галочки: скидки и надбавки к ставке, страховка, расходы на сделку
export type PurchaseChoice = {
  rateOptions: string[]; // id отмеченных скидок
  lifeInsurance: boolean; // страховать жизнь
  insuranceFinanced: boolean; // страховка первого года — в кредит
  dealCosts: string[]; // id отмеченных расходов на сделку
};
