// Собирает расчёт покупки из ввода пользователя и конфига: итоговая ставка,
// сумма кредита, страховка, «нужно сразу», «страховать жизнь или нет».
// Здесь нет своих формул — только вызовы core/purchase.ts с числами из конфига.

import type { Loan } from "../../core/annuity";
import type { Explained } from "../../core/explain";
import {
  effectiveRate,
  firstYearPremium,
  lifeInsuranceChoice,
  loanAmount,
  purchaseWarnings,
  upfront,
  type DealCost,
  type InsuranceSettings,
  type PurchaseWarnings,
  type RateAdjustment,
} from "../../core/purchase";
import { PROGRAM_DOWN_PARAM, type AppConfig } from "../../config/schema";
import type { BaseInput, PurchaseChoice } from "./types";

export type Purchase = {
  downPct: number; // взнос, % от стоимости
  minDownPct: number;
  rate: Explained; // итоговая ставка
  adjustments: RateAdjustment[];
  loanBase: number; // стоимость − взнос
  firstYearPremium: number;
  loanAmount: Explained; // сумма кредита (с премией, если она в кредите)
  warnings: PurchaseWarnings;
  insurance: InsuranceSettings;
  deals: DealCost[]; // отмеченные расходы на сделку
  upfront: Explained;
  insuranceNow: number; // страховка, которую платим в день сделки
  lifeChoice: ReturnType<typeof lifeInsuranceChoice>;
  loan: Loan; // кредит для графика: сумма, итоговая ставка, срок
};

export function choiceDefaults(config: AppConfig): PurchaseChoice {
  return {
    rateOptions: [],
    lifeInsurance: true,
    insuranceFinanced: false,
    dealCosts: config.dealCosts.filter((c) => c.default).map((c) => c.id),
  };
}

export function buildPurchase(
  base: BaseInput,
  choice: PurchaseChoice,
  config: AppConfig,
  globals: Record<string, number>,
): Purchase {
  const g = (id: string) => globals[id] ?? 0;
  const months = Math.max(1, Math.round(base.years * 12));
  const downPct = base.price > 0 ? (base.downPayment / base.price) * 100 : 0;
  const minDownPct = g(PROGRAM_DOWN_PARAM[base.program]);

  const rateCtx = {
    program: base.program,
    selected: choice.rateOptions,
    downPct,
    bigDownFromPct: g("bigDownFromPct"),
    bigDownDiscount: g("bigDownDiscount"),
    noLifeInsuranceRate: g("noLifeInsuranceRate"),
  };
  const { rate, adjustments } = effectiveRate(base.ratePct, config.rateOptions, {
    ...rateCtx,
    lifeInsurance: choice.lifeInsurance,
  });

  const rates = { propertyPct: g("propertyInsurancePct"), lifePct: choice.lifeInsurance ? g("lifeInsurancePct") : 0 };
  const loanBase = Math.max(base.price - base.downPayment, 0);
  const premium = firstYearPremium(loanBase, rates);
  const amount = loanAmount(base.price, base.downPayment, choice.insuranceFinanced ? premium : 0);
  const insuranceNow = choice.insuranceFinanced ? 0 : premium;
  const deals = config.dealCosts.filter((c) => choice.dealCosts.includes(c.id));

  // Для сравнения «страховать или нет» нужны обе ставки: с полисом жизни и без
  const rateWith = effectiveRate(base.ratePct, config.rateOptions, { ...rateCtx, lifeInsurance: true }).rate.value;
  const rateWithout = effectiveRate(base.ratePct, config.rateOptions, { ...rateCtx, lifeInsurance: false }).rate.value;

  return {
    downPct,
    minDownPct,
    rate,
    adjustments,
    loanBase,
    firstYearPremium: premium,
    loanAmount: amount,
    warnings: purchaseWarnings(base.price, base.downPayment, amount.value, {
      minDownPct,
      maxLoan: base.program === "rural" ? globals.ruralMaxLoan : undefined,
    }),
    insurance: { ...rates, loanBase, financedFirstYear: choice.insuranceFinanced },
    deals,
    upfront: upfront(base.downPayment, deals, insuranceNow),
    insuranceNow,
    lifeChoice: lifeInsuranceChoice({
      principal: loanBase,
      months,
      rateWithLife: rateWith,
      rateWithoutLife: rateWithout,
      lifePct: g("lifeInsurancePct"),
    }),
    loan: { principal: amount.value, ratePct: rate.value, months },
  };
}
