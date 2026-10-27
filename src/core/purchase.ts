// Покупка жилья: сумма кредита из стоимости и взноса, итоговая ставка со скидками
// и надбавками, страховка по годам и деньги, которые нужны сразу.
// Чистые функции, без React и конфига: все числа приходят аргументами.

import { buildSchedule, type Schedule } from "./annuity";
import { explained, inp, type Explained } from "./explain";
import type { LoanProgram } from "./scenarios";

// ── Сумма кредита ────────────────────────────────────────────────

// Кредит = стоимость − взнос (+ страховка первого года, если её включили в кредит)
export function loanAmount(price: number, downPayment: number, financedInsurance = 0): Explained {
  const base = Math.max(price - downPayment, 0);
  return explained("loanAmount", base + financedInsurance, {
    price: inp(price, "Стоимость жилья, ₽"),
    down: inp(downPayment, "Первоначальный взнос, ₽"),
    insurance: inp(financedInsurance, "Страховка первого года в кредите, ₽"),
  });
}

export type PurchaseLimits = {
  minDownPct: number; // минимальный взнос программы, % от стоимости
  maxLoan?: number; // лимит кредита (у сельской ипотеки), ₽
};

export type PurchaseWarnings = {
  downTooLow?: { minPct: number; minAmount: number }; // взнос меньше минимума программы
  overLimit?: { limit: number }; // кредит больше лимита
};

export function purchaseWarnings(price: number, downPayment: number, loan: number, limits: PurchaseLimits): PurchaseWarnings {
  const warnings: PurchaseWarnings = {};
  const minAmount = (price * limits.minDownPct) / 100;
  // Копейка допуска: 30,01% от 8,6 млн — дробное число рублей
  if (downPayment + 0.01 < minAmount) warnings.downTooLow = { minPct: limits.minDownPct, minAmount };
  if (limits.maxLoan !== undefined && loan > limits.maxLoan) warnings.overLimit = { limit: limits.maxLoan };
  return warnings;
}

// ── Ставка: скидки и надбавки ────────────────────────────────────

export type RateOption = {
  id: string;
  label: string;
  deltaPct: number; // поправка к ставке, п.п.: −0,3 — скидка, +1 — надбавка
  programs?: LoanProgram[]; // для каких программ действует; пусто — для всех
  group?: string; // варианты одной группы взаимоисключающие
  hint?: string;
};

export type RateContext = {
  program: LoanProgram;
  selected: string[]; // id отмеченных вариантов
  downPct: number; // взнос, % от стоимости
  lifeInsurance: boolean; // страхует ли клиент жизнь
  bigDownFromPct: number; // скидка за большой взнос — от этого процента
  bigDownDiscount: number; // … её размер, п.п.
  noLifeInsuranceRate: number; // надбавка при отказе от страхования жизни, п.п.
};

export type RateAdjustment = { id: string; label: string; deltaPct: number };

// Применима ли поправка к программе
export function optionApplies(option: RateOption, program: LoanProgram): boolean {
  return !option.programs?.length || option.programs.includes(program);
}

// Итоговая ставка = базовая + сумма применимых поправок, но не ниже нуля.
// Сельская ипотека: ставка фиксирована программой, поэтому скидки банка к ней не применяются
// (у таких вариантов в конфиге programs: ["market"]), а надбавка за отказ от страхования жизни — действует.
export function effectiveRate(
  basePct: number,
  options: RateOption[],
  ctx: RateContext,
): { rate: Explained; adjustments: RateAdjustment[] } {
  const adjustments: RateAdjustment[] = [];
  const usedGroups = new Set<string>();
  for (const o of options) {
    if (!ctx.selected.includes(o.id) || !optionApplies(o, ctx.program)) continue;
    // Из группы берём только первый отмеченный вариант
    if (o.group) {
      if (usedGroups.has(o.group)) continue;
      usedGroups.add(o.group);
    }
    adjustments.push({ id: o.id, label: o.label, deltaPct: o.deltaPct });
  }
  // Скидка за большой взнос начисляется сама, только по рыночной ипотеке
  if (ctx.program === "market" && ctx.bigDownDiscount > 0 && ctx.downPct >= ctx.bigDownFromPct) {
    adjustments.push({ id: "bigDown", label: `Взнос от ${ctx.bigDownFromPct}%`, deltaPct: -ctx.bigDownDiscount });
  }
  if (!ctx.lifeInsurance && ctx.noLifeInsuranceRate !== 0) {
    adjustments.push({ id: "noLife", label: "Без страхования жизни", deltaPct: ctx.noLifeInsuranceRate });
  }

  const value = Math.max(basePct + adjustments.reduce((s, a) => s + a.deltaPct, 0), 0);
  const inputs = Object.fromEntries([
    ["base", inp(basePct, "Базовая ставка, %")],
    ...adjustments.map((a) => [a.id, inp(a.deltaPct, `${a.label}, п.п.`)]),
  ]);
  return { rate: explained("effectiveRate", value, inputs), adjustments };
}

// ── Страховка ────────────────────────────────────────────────────

export type InsuranceRates = {
  propertyPct: number; // страхование объекта, % от остатка долга в год
  lifePct: number; // страхование жизни, % от остатка в год (0 — не страхуем)
};

export type InsuranceSettings = InsuranceRates & {
  loanBase: number; // стоимость − взнос: на неё считается премия первого года
  financedFirstYear: boolean; // премия первого года включена в сумму кредита
};

export type InsuranceCosts = {
  byYear: number[]; // премия каждого года
  firstYear: number;
  total: number; // за весь срок
  outOfPocketYearly: number; // первая премия, которую платят из своего кармана (2-й год, если первый в кредите)
  explain: Explained;
};

// Премия года y = доля × остаток долга на начало года.
// Первый год — от (стоимость − взнос): если премию включить в кредит, она сама увеличит долг,
// поэтому берём сумму до её включения. Досрочка уменьшает остаток — дешевеет и страховка.
export function firstYearPremium(loanBase: number, rates: InsuranceRates): number {
  return ((rates.propertyPct + rates.lifePct) / 100) * loanBase;
}

export function insuranceCosts(schedule: Schedule, settings: InsuranceSettings): InsuranceCosts {
  const share = (settings.propertyPct + settings.lifePct) / 100;
  const byYear: number[] = [];
  const years = Math.ceil(schedule.months / 12);
  for (let y = 1; y <= years; y++) {
    const startBalance = y === 1 ? settings.loanBase : schedule.rows[12 * (y - 1) - 1]?.balance ?? 0;
    if (startBalance <= 0.005) break;
    byYear.push(share * startBalance);
  }
  const firstYear = byYear[0] ?? 0;
  const total = byYear.reduce((s, v) => s + v, 0);
  const outOfPocketYearly = settings.financedFirstYear ? byYear[1] ?? 0 : firstYear;
  const explain = explained("insurance", total, {
    property: inp(settings.propertyPct, "Страхование объекта, % от остатка в год"),
    life: inp(settings.lifePct, "Страхование жизни, % от остатка в год"),
    base: inp(settings.loanBase, "Остаток на начало первого года, ₽"),
    first: inp(firstYear, "Премия первого года, ₽"),
    years: inp(byYear.length, "Лет страхования"),
  });
  return { byYear, firstYear, total, outOfPocketYearly, explain };
}

// «Страховать жизнь или нет?»: цена полиса жизни за весь срок против лишних процентов
// из-за надбавки к ставке. Оба графика строятся на одной сумме (стоимость − взнос):
// так сравнение не зависит от того, включена ли страховка в кредит.
export function lifeInsuranceChoice(input: {
  principal: number;
  months: number;
  rateWithLife: number;
  rateWithoutLife: number;
  lifePct: number;
}): { policy: Explained; extraInterest: Explained; winner: "insure" | "skip"; difference: number } {
  const withLife = buildSchedule({ principal: input.principal, ratePct: input.rateWithLife, months: input.months });
  const withoutLife = buildSchedule({ principal: input.principal, ratePct: input.rateWithoutLife, months: input.months });
  const premiums = insuranceCosts(withLife, {
    propertyPct: 0,
    lifePct: input.lifePct,
    loanBase: input.principal,
    financedFirstYear: false,
  }).total;
  const extra = withoutLife.totalInterest - withLife.totalInterest;
  const policy = explained("insurance", premiums, {
    life: inp(input.lifePct, "Страхование жизни, % от остатка в год"),
    base: inp(input.principal, "Сумма кредита, ₽"),
  });
  const extraInterest = explained("extraInterest", extra, {
    without: inp(withoutLife.totalInterest, `Проценты под ${input.rateWithoutLife}%, ₽`),
    with: inp(withLife.totalInterest, `Проценты под ${input.rateWithLife}%, ₽`),
  });
  return { policy, extraInterest, winner: premiums <= extra ? "insure" : "skip", difference: Math.abs(extra - premiums) };
}

// ── Нужно сразу ──────────────────────────────────────────────────

export type DealCost = { id: string; label: string; amount: number; hint?: string; default: boolean };

// Нужно сразу = взнос + отмеченные расходы на сделку + страховка первого года (если она не в кредите)
export function upfront(downPayment: number, dealCosts: { label: string; amount: number }[], insuranceNow: number): Explained {
  const deals = dealCosts.reduce((s, c) => s + c.amount, 0);
  return explained("upfront", downPayment + deals + insuranceNow, {
    down: inp(downPayment, "Первоначальный взнос, ₽"),
    ...Object.fromEntries(dealCosts.map((c, k) => [`deal${k}`, inp(c.amount, `${c.label}, ₽`)])),
    insurance: inp(insuranceNow, "Страховка первого года, ₽"),
  });
}
