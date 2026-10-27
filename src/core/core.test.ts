import { describe, expect, it } from "vitest";
import { annuityPayment, buildSchedule, termForPayment, type Loan } from "./annuity";
import { checkFormula, evaluateFormula } from "./evaluate";
import {
  breakEvenDepositRate,
  cityVsVillage,
  coffee,
  depositVsEarly,
  extraForTarget,
  interestDeduction,
  propertyDeduction,
  realPaymentAt,
  realPayments,
} from "./features";
import { applyScenario, computeMetrics, pdnLevel } from "./scenarios";
import { comparePlan, expandPlan, type PlanItem } from "./plan";
import {
  effectiveRate,
  firstYearPremium,
  insuranceCosts,
  lifeInsuranceChoice,
  loanAmount,
  purchaseWarnings,
  upfront,
  type RateOption,
} from "./purchase";
import { buildMatrix, buildRoute, normalizeAnswers, optionBlockedBy, splitTemplate } from "./navigator";
import { defaultConfig } from "../config/store";
import { globalValues, validateConfig } from "../config/schema";

// Эталон: 3 млн ₽ под 3% на 20 лет — платёж ≈ 16 637,93 ₽
const rural: Loan = { principal: 3_000_000, ratePct: 3, months: 240 };
const household = { income: 120_000, expenses: 40_000 };

describe("аннуитет", () => {
  it("платёж на эталонном примере", () => {
    expect(annuityPayment(3_000_000, 3, 240)).toBeCloseTo(16637.93, 2);
  });

  it("нулевая ставка — просто S/n", () => {
    expect(annuityPayment(1_200_000, 0, 120)).toBe(10_000);
  });

  it("срок по платежу — обратная функция", () => {
    expect(termForPayment(3_000_000, 3, 16637.93)).toBeCloseTo(240, 3);
    expect(termForPayment(3_000_000, 3, 7000)).toBe(Infinity); // платёж меньше процентов
  });

  it("график гасит долг ровно за n месяцев, переплата = P·n − S", () => {
    const s = buildSchedule(rural);
    expect(s.months).toBe(240);
    expect(s.rows.at(-1)!.balance).toBeCloseTo(0, 2);
    expect(s.totalInterest).toBeCloseTo(16637.93 * 240 - 3_000_000, 0);
    // Проценты первого месяца = остаток · i
    expect(s.rows[0].interest).toBeCloseTo(3_000_000 * 0.0025, 6);
  });
});

describe("досрочный платёж", () => {
  const early = (mode: "term" | "payment") =>
    buildSchedule(rural, { earlyPayments: [{ month: 12, amount: 500_000, mode }] });
  const base = buildSchedule(rural);

  it("режим «уменьшить срок»: платёж прежний, срок короче", () => {
    const s = early("term");
    expect(s.payment).toBeCloseTo(base.payment, 6);
    expect(s.months).toBeLessThan(240);
    expect(s.totalInterest).toBeLessThan(base.totalInterest);
  });

  it("режим «уменьшить платёж»: срок прежний, платёж пересчитан", () => {
    const s = early("payment");
    expect(s.months).toBe(240);
    const balance12 = base.rows[11].balance - 500_000;
    expect(s.payment).toBeCloseTo(annuityPayment(balance12, 3, 228), 6);
  });

  it("уменьшение срока экономит больше, чем уменьшение платежа", () => {
    expect(early("term").totalInterest).toBeLessThan(early("payment").totalInterest);
  });

  it("досрочка больше остатка закрывает кредит", () => {
    const s = buildSchedule(rural, { earlyPayments: [{ month: 1, amount: 10_000_000, mode: "term" }] });
    expect(s.months).toBe(1);
  });
});

describe("смена ставки (потеря льготы)", () => {
  it("с месяца k платёж пересчитывается на оставшийся срок по новой ставке", () => {
    const base = buildSchedule(rural);
    const s = buildSchedule(rural, { rateChanges: [{ month: 25, ratePct: 18.7 }] });
    expect(s.months).toBe(240);
    expect(s.payment).toBeCloseTo(annuityPayment(base.rows[23].balance, 18.7, 216), 6);
    expect(s.totalInterest).toBeGreaterThan(base.totalInterest * 3);
  });
});

describe("чашка кофе", () => {
  it("без доплаты ничего не меняется", () => {
    expect(coffee(rural, 0).monthsSaved.value).toBe(0);
  });

  it("срок с доплатой совпадает с формулой срока", () => {
    const r = coffee(rural, 3000);
    expect(r.newMonths).toBe(Math.ceil(termForPayment(3_000_000, 3, 16637.93 + 3000)));
    expect(r.monthsSaved.value).toBeGreaterThan(0);
    expect(r.interestSaved.value).toBeGreaterThan(0);
  });

  it("обратный вопрос: доплата = P(n_target) − P", () => {
    expect(extraForTarget(rural, 120).value).toBeCloseTo(annuityPayment(3_000_000, 3, 120) - 16637.93, 1);
    // Доплата из обратного вопроса действительно закрывает кредит за 120 месяцев
    const extra = extraForTarget(rural, 120).value;
    expect(buildSchedule(rural, { extraMonthly: extra }).months).toBe(120);
  });
});

describe("досрочка или вклад", () => {
  const input = { loan: rural, amount: 500_000, month: 12, horizon: 60, depositRatePct: 12, depositTaxPct: 13 };

  it("при сельской ипотеке под 3% выгоднее вклад", () => {
    const r = depositVsEarly(input);
    expect(r.winner).toBe("deposit");
    // Экономия от досрочки ≈ X·((1+i)^h − 1) — проценты, которые не начислятся на X
    expect(r.early.value).toBeCloseTo(500_000 * (Math.pow(1.0025, 60) - 1), -1);
    expect(r.deposit.value).toBeCloseTo(500_000 * (Math.pow(1.01, 60) - 1) * 0.87, 2);
  });

  it("после потери льготы вывод разворачивается: выгоднее досрочка", () => {
    const r = depositVsEarly({ ...input, events: { rateChanges: [{ month: 1, ratePct: 18.7 }] } });
    expect(r.winner).toBe("early");
  });

  it("при пороговой ставке вклада выгоды равны", () => {
    const r = depositVsEarly(input);
    const rate = breakEvenDepositRate(r, input.amount, input.depositTaxPct).value;
    // При 3% по кредиту порог около 3,4% (из-за налога на проценты вклада)
    expect(rate).toBeGreaterThan(3);
    expect(rate).toBeLessThan(input.depositRatePct);
    const even = depositVsEarly({ ...input, depositRatePct: rate });
    expect(even.difference).toBeLessThan(0.01);
  });
});

describe("метрики", () => {
  it("бюджет и ПДН", () => {
    const m = computeMetrics(rural, household);
    expect(m.budget.value).toBeCloseTo(120_000 - 40_000 - 16637.93, 1);
    expect(m.pdn.value).toBeCloseTo((16637.93 / 120_000) * 100, 2);
    expect(pdnLevel(m.pdn.value, 30, 50)).toBe("green");
    expect(pdnLevel(40, 30, 50)).toBe("yellow");
    expect(pdnLevel(55, 30, 50)).toBe("red");
  });
});

describe("формулы из конфига", () => {
  it("считает арифметику и функцию annuity", () => {
    expect(evaluateFormula("a * (1 - b / 100)", { a: 1000, b: 4 })).toBe(960);
    expect(evaluateFormula("annuity(S, 3, 240)", { S: 3_000_000 })).toBeCloseTo(16637.93, 2);
    expect(evaluateFormula("x > 5 ? 1 : 2", { x: 7 })).toBe(1);
  });

  it("не пропускает неизвестные переменные и ошибки синтаксиса", () => {
    expect(checkFormula("a + c", ["a"])).toMatchObject({ ok: false });
    expect(checkFormula("a +* 2", ["a"])).toMatchObject({ ok: false });
    expect(checkFormula("a + b", ["a", "b"])).toEqual({ ok: true, variables: ["a", "b"] });
  });

  it("не пропускает опасные конструкции", () => {
    for (const bad of ["a.constructor", "a = 1", "f(x) = x", "import(1)", "evaluate(\"1\")", "[1, 2]", "{a: 1}"]) {
      expect(checkFormula(bad, ["a", "x"]).ok, bad).toBe(false);
    }
  });
});

describe("налоговый вычет", () => {
  it("ограничен лимитами", () => {
    expect(propertyDeduction(5_000_000, 13, 2_000_000).value).toBe(260_000);
    expect(propertyDeduction(1_000_000, 13, 2_000_000).value).toBe(130_000);
    expect(interestDeduction(4_000_000, 13, 3_000_000).value).toBe(390_000);
  });
});

describe("реальная стоимость платежа", () => {
  it("через год платёж весит P/(1+π)", () => {
    const r = realPayments(10_000, 10, 3);
    expect(r[0].real).toBe(10_000);
    expect(r[1].real).toBeCloseTo(10_000 / 1.1, 6);
  });
});

describe("конфиг по умолчанию", () => {
  it("проходит валидацию", () => {
    expect(validateConfig(defaultConfig)).toEqual([]);
  });

  it("ловит ошибку в формуле сценария", () => {
    const broken = structuredClone(defaultConfig);
    broken.scenarios[0].effects.earlyAmount = "X + unknownVar";
    expect(validateConfig(broken).join()).toContain("unknownVar");
  });

  const run = (id: string, earlyMode: "term" | "payment" = "term") => {
    const scenario = defaultConfig.scenarios.find((s) => s.id === id)!;
    const params = Object.fromEntries(scenario.params.map((p) => [p.id, p.default]));
    return applyScenario({ scenario, loan: rural, household, params, globals: globalValues(defaultConfig), earlyMode });
  };

  it("досрочка: есть альтернативный режим для сравнения", () => {
    const r = run("early-payment");
    expect(r.after.months.value).toBeLessThan(240);
    expect(r.alternative?.mode).toBe("payment");
    expect(r.alternative!.after.payment.value).toBeLessThan(r.before.payment.value);
  });

  it("ремонт: второй платёж уменьшает бюджет и повышает ПДН", () => {
    const r = run("repair-loan");
    const repair = annuityPayment(700_000, 20, 60);
    expect(r.effects.extraPayment!.value).toBeCloseTo(repair, 6);
    expect(r.before.budget.value - r.after.budget.value).toBeCloseTo(repair, 6);
    expect(r.after.pdn.value).toBeGreaterThan(r.before.pdn.value);
  });

  it("аренда: чистый доход = аренда·(1 − налог) − расходы − простой", () => {
    const r = run("rent-out");
    expect(r.effects.extraIncome!.value).toBeCloseTo(35_000 * 0.96 - 4_000 - 35_000 * 0.08, 6);
    expect(r.effects.extraIncome!.inputs.rent.label).toBe("Арендная плата");
  });

  it("потеря льготы: платёж и переплата растут", () => {
    const r = run("lose-benefit");
    expect(r.after.payment.value).toBeGreaterThan(r.before.payment.value);
    expect(r.after.overpayment.value).toBeGreaterThan(r.before.overpayment.value);
  });
});

describe("реальный платёж и город/село", () => {
  it("realPaymentAt совпадает с графиком realPayments", () => {
    expect(realPaymentAt(10_000, 10, 2).value).toBeCloseTo(realPayments(10_000, 10, 3)[2].real, 6);
  });

  const input = {
    ownFunds: 2_200_000,
    income: 150_000,
    expenses: 60_000,
    familySize: 3,
    months: 240,
    city: { pricePerM2: 180_000, downPct: 20, ratePct: 18.7 },
    village: { price: 7_000_000, area: 110, downPct: 30.01, ratePct: 3, maxLoan: 6_000_000 },
  };

  it("за ту же цену в селе больше метров и меньше платёж", () => {
    const { city, village } = cityVsVillage(input);
    expect(city.area).toBeCloseTo(7_000_000 / 180_000, 6);
    expect(village.areaPerPerson.value).toBeCloseTo(110 / 3, 6);
    expect(village.loan.value).toBe(4_800_000);
    expect(village.payment.value).toBeCloseTo(annuityPayment(4_800_000, 3, 240), 6);
    expect(village.payment.value).toBeLessThan(city.payment.value);
    expect(village.shortfall).toBe(0);
  });

  it("показывает нехватку на взнос и сверх лимита", () => {
    const poor = cityVsVillage({ ...input, ownFunds: 500_000 }).village;
    expect(poor.loan.value).toBe(6_000_000); // упёрлись в лимит
    expect(poor.shortfall).toBeCloseTo(7_000_000 * 0.3001 - 500_000, 6);
  });
});

describe("навигатор", () => {
  const nav = defaultConfig.navigator;
  const preset = (id: string) => nav.presets.find((p) => p.id === id)!.answers;
  const routeIds = (answers: Record<string, string>) => buildRoute(nav, answers).map((r) => r.step.id);

  it("сельская ипотека недоступна для вторички, участка без стройки и вне сферы АПК", () => {
    const base = { goal: "buy", object: "house", sector: "yes" };
    expect(optionBlockedBy(nav, base, "financing", "rural")).toBeUndefined();
    expect(optionBlockedBy(nav, { ...base, object: "secondary" }, "financing", "rural")).toBeDefined();
    expect(optionBlockedBy(nav, { ...base, object: "land" }, "financing", "rural")).toBeDefined();
    expect(optionBlockedBy(nav, { ...base, sector: "no" }, "financing", "rural")).toBeDefined();
  });

  it("поздний ответ подстраивается под ранний", () => {
    const { answers, adjusted } = normalizeAnswers(nav, { ...preset("rural-house"), object: "secondary" });
    expect(answers.financing).toBe("market");
    expect(adjusted).toHaveLength(1);
    expect(adjusted[0]).toMatchObject({ questionId: "financing", from: "rural", to: "market" });
  });

  it("скрытые вопросы не влияют на маршрут ремонта", () => {
    const withHidden = { ...preset("repair"), sector: "yes", financing: "rural" };
    expect(routeIds(withHidden)).toEqual(routeIds(preset("repair")));
    expect(routeIds(withHidden)).not.toContain("rural-obligations");
    expect(routeIds(withHidden)).toContain("repair-finance");
  });

  it("маршрут меняется по сценарию", () => {
    const ruralBuild = routeIds(preset("rural-construction"));
    const marketBuild = routeIds(preset("construction"));
    const newbuild = routeIds(preset("newbuild"));
    expect(ruralBuild).toEqual(expect.arrayContaining(["rural-place", "rural-obligations", "tranches", "land-check"]));
    expect(marketBuild).not.toContain("rural-obligations");
    expect(newbuild).toEqual(expect.arrayContaining(["developer-check", "acceptance"]));
    expect(newbuild).not.toContain("land-check");
  });

  it("особая рекомендация для сельской стройки — со сроком стройки и ссылкой на потерю льготы", () => {
    const step = buildRoute(nav, preset("rural-construction")).find((r) => r.step.id === "build-house")!;
    expect(step.special).toBe(true);
    expect(step.text).toContain("{buildDeadlineMonths}");
    expect(step.calcLink?.to).toBe("/simulator?scenario=lose-benefit");
  });

  it("шаги идут по порядку этапов", () => {
    const order = nav.stages.map((s) => s.id);
    const stages = buildRoute(nav, preset("rural-construction")).map((r) => order.indexOf(r.step.stage));
    expect(stages).toEqual([...stages].sort((a, b) => a - b));
  });

  it("матрица: столбец сценария совпадает с его маршрутом", () => {
    const matrix = buildMatrix(nav);
    const col = nav.presets.findIndex((p) => p.id === "rural-construction");
    const shown = matrix.flatMap((g) => g.rows).filter((r) => r.cells[col].cell !== "none").map((r) => r.step.id);
    expect(new Set(shown)).toEqual(new Set(routeIds(preset("rural-construction"))));
  });

  it("подстановка параметров в текст", () => {
    expect(splitTemplate("за {buildDeadlineMonths} мес")).toEqual([
      { text: "за " },
      { param: "buildDeadlineMonths" },
      { text: " мес" },
    ]);
  });

  it("валидация ловит битые ссылки навигатора", () => {
    const broken = structuredClone(defaultConfig);
    broken.navigator.steps[0].showIf = { financing: ["family"] };
    broken.navigator.steps[1].recommendation = "Ставка {noSuchParam}";
    broken.navigator.presets.push({ id: "bad", title: "Плохой", answers: { goal: "buy", object: "secondary", sector: "yes", financing: "rural" } });
    const text = validateConfig(broken).join("\n");
    expect(text).toContain("family");
    expect(text).toContain("noSuchParam");
    expect(text).toContain("Плохой");
  });
});

// ── Покупка: кредит, ставка, страховка ───────────────────────────

describe("сумма кредита", () => {
  it("кредит = стоимость − взнос", () => {
    const a = loanAmount(8_600_000, 2_600_000);
    expect(a.value).toBe(6_000_000);
    expect(a.formulaId).toBe("loanAmount");
  });

  it("страховка первого года в кредите увеличивает сумму", () => {
    const premium = firstYearPremium(6_000_000, { propertyPct: 0.15, lifePct: 0.4 });
    expect(premium).toBeCloseTo(33_000, 6);
    expect(loanAmount(8_600_000, 2_600_000, premium).value).toBeCloseTo(6_033_000, 6);
  });

  it("предупреждения: взнос ниже минимума и кредит выше лимита", () => {
    expect(purchaseWarnings(8_600_000, 2_600_000, 6_000_000, { minDownPct: 30.01, maxLoan: 6_000_000 })).toEqual({});
    const w = purchaseWarnings(8_600_000, 2_000_000, 6_600_000, { minDownPct: 30.01, maxLoan: 6_000_000 });
    expect(w.downTooLow?.minAmount).toBeCloseTo(2_580_860, 0);
    expect(w.overLimit?.limit).toBe(6_000_000);
  });
});

describe("итоговая ставка", () => {
  const options: RateOption[] = defaultConfig.rateOptions;
  const ctx = {
    program: "market" as const,
    selected: [] as string[],
    downPct: 30,
    lifeInsurance: true,
    bigDownFromPct: 50,
    bigDownDiscount: 0.3,
    noLifeInsuranceRate: 1,
  };

  it("без галочек — базовая", () => {
    expect(effectiveRate(18.7, options, ctx).rate.value).toBe(18.7);
  });

  it("сельская ипотека игнорирует зарплатную скидку, но надбавка за отказ от страховки действует", () => {
    const rural = { ...ctx, program: "rural" as const, selected: ["salary"] };
    expect(effectiveRate(3, options, rural).rate.value).toBe(3);
    expect(effectiveRate(3, options, { ...rural, lifeInsurance: false }).rate.value).toBeCloseTo(4, 10);
  });

  it("из группы берётся только одна скидка", () => {
    const r = effectiveRate(18.7, options, { ...ctx, selected: ["salary", "reliable"] });
    expect(r.adjustments.map((a) => a.id)).toEqual(["salary"]);
    expect(r.rate.value).toBeCloseTo(18.4, 10);
  });

  it("скидка за взнос от 50% срабатывает сама", () => {
    expect(effectiveRate(18.7, options, { ...ctx, downPct: 49.9 }).rate.value).toBe(18.7);
    expect(effectiveRate(18.7, options, { ...ctx, downPct: 50 }).rate.value).toBeCloseTo(18.4, 10);
  });

  it("ставка не уходит ниже нуля", () => {
    expect(effectiveRate(0.1, options, { ...ctx, selected: ["salary"] }).rate.value).toBe(0);
  });
});

describe("страховка", () => {
  const loan: Loan = { principal: 6_000_000, ratePct: 3, months: 240 };
  const settings = { propertyPct: 0.15, lifePct: 0.4, loanBase: 6_000_000, financedFirstYear: false };

  it("премия убывает вместе с остатком долга", () => {
    const ins = insuranceCosts(buildSchedule(loan), settings);
    expect(ins.byYear).toHaveLength(20);
    expect(ins.firstYear).toBeCloseTo(33_000, 6);
    for (let y = 1; y < ins.byYear.length; y++) expect(ins.byYear[y]).toBeLessThan(ins.byYear[y - 1]);
  });

  it("досрочка уменьшает страховку", () => {
    const base = computeMetrics(loan, household, {}, undefined, settings);
    const early = computeMetrics(loan, household, { earlyPayments: [{ month: 12, amount: 1_000_000, mode: "term" }] }, undefined, settings);
    expect(early.insurance!.total).toBeLessThan(base.insurance!.total);
  });

  it("переплата включает страховку, ПДН — нет", () => {
    const without = computeMetrics(loan, household);
    const withIns = computeMetrics(loan, household, {}, undefined, settings);
    expect(withIns.overpayment.value).toBeCloseTo(without.overpayment.value + withIns.insurance!.total, 6);
    expect(withIns.pdn.value).toBeCloseTo(without.pdn.value, 10);
    expect(withIns.budget.value).toBeCloseTo(without.budget.value - 33_000 / 12, 6);
  });

  it("страховать жизнь: сравнение полиса и лишних процентов", () => {
    const r = lifeInsuranceChoice({ principal: 6_000_000, months: 240, rateWithLife: 3, rateWithoutLife: 4, lifePct: 0.4 });
    expect(r.policy.value).toBeGreaterThan(0);
    expect(r.extraInterest.value).toBeCloseTo(buildSchedule({ ...loan, ratePct: 4 }).totalInterest - buildSchedule(loan).totalInterest, 6);
    expect(r.difference).toBeCloseTo(Math.abs(r.extraInterest.value - r.policy.value), 6);
  });

  it("нужно сразу = взнос + расходы + страховка не в кредите", () => {
    expect(upfront(2_600_000, [{ label: "Оценка", amount: 6000 }], 33_000).value).toBe(2_639_000);
  });
});

describe("план досрочных платежей", () => {
  const loan: Loan = { principal: 6_000_000, ratePct: 3, months: 240 };

  it("регулярный ежемесячный платёж разворачивается до конца срока", () => {
    const events = expandPlan([{ kind: "monthly", fromMonth: 1, amount: 5000, mode: "term" }], 240);
    expect(events).toHaveLength(240);
    expect(expandPlan([{ kind: "yearly", fromMonth: 12, amount: 1, mode: "term" }], 240)).toHaveLength(20);
    expect(expandPlan([{ kind: "once", fromMonth: 300, amount: 1, mode: "term" }], 240)).toHaveLength(0);
  });

  it("разовый платёж в плане = досрочка в графике", () => {
    const plan = comparePlan(loan, household, [{ kind: "once", fromMonth: 12, amount: 500_000, mode: "term" }]);
    const direct = buildSchedule(loan, { earlyPayments: [{ month: 12, amount: 500_000, mode: "term" }] });
    expect(plan.yours.metrics.schedule.totalInterest).toBeCloseTo(direct.totalInterest, 6);
  });

  it("«весь план — срок» экономит больше, чем «весь план — платёж»", () => {
    const items: PlanItem[] = [
      { kind: "once", fromMonth: 12, amount: 500_000, mode: "payment" },
      { kind: "monthly", fromMonth: 1, amount: 5000, mode: "payment" },
    ];
    const plan = comparePlan(loan, household, items);
    expect(plan.term.saving.value).toBeGreaterThan(plan.payment.saving.value);
    expect(plan.payment.saving.value).toBeGreaterThan(0);
    expect(plan.term.metrics.months.value).toBeLessThan(240);
    // «Уменьшить платёж» держит срок почти прежним: последняя доплата может закрыть кредит на месяц раньше
    expect(plan.payment.metrics.months.value).toBeGreaterThanOrEqual(239);
    // В режиме «уменьшить платёж» платёж в конце меньше исходного
    expect(plan.payment.metrics.payment.value).toBeLessThan(plan.none.metrics.payment.value);
  });
});

describe("конфиг: ставка и расходы", () => {
  it("все formulaId ядра описаны в formulas", () => {
    const ids = new Set(defaultConfig.formulas.map((f) => f.id));
    for (const id of ["loanAmount", "effectiveRate", "insurance", "upfront", "planSaving", "extraInterest"]) expect(ids).toContain(id);
  });

  it("валидация ловит повторы id, плохие программы и отрицательные суммы", () => {
    const broken = structuredClone(defaultConfig);
    broken.rateOptions.push({ ...broken.rateOptions[0] });
    broken.rateOptions[1].programs = ["family" as never];
    broken.dealCosts[0].amount = -1;
    broken.simulator.downPayment = broken.simulator.price + 1;
    const text = validateConfig(broken).join("\n");
    expect(text).toContain("повторяется");
    expect(text).toContain("family");
    expect(text).toContain("неотрицательное");
    expect(text).toContain("взнос больше стоимости");
  });
});
