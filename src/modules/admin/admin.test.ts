import { describe, expect, it } from "vitest";
import { annuityPayment } from "../../core/annuity";
import { validateConfig, type ScenarioDef } from "../../config/schema";
import { defaultConfig, importConfig, exportConfig } from "../../config/store";
import { previewFormula, previewScenario, testVariables } from "./preview";

const scenario = (id: string) => defaultConfig.scenarios.find((s) => s.id === id)!;

// Пример для жюри: админ добавляет сценарий без кода
const childBirth: ScenarioDef = {
  id: "child-birth",
  title: "Рождение ребёнка",
  description: "Направить материнский капитал в досрочное погашение.",
  params: [{ id: "child", label: "Какой по счёту ребёнок", min: 1, max: 5, step: 1, default: 1 }],
  // Сумма маткапитала — из глобальных параметров: на первого ребёнка одна, на второго и следующих — другая
  effects: { earlyAmount: "child == 1 ? matCapFirst : matCapSecond", earlyMonth: "12" },
};

describe("админка: предпросмотр формул", () => {
  it("формула считается на тестовом кредите и значениях по умолчанию", () => {
    const preview = previewFormula("annuity(Sr, rr, nr)", defaultConfig, scenario("repair-loan"));
    expect(preview.ok && preview.value).toBeCloseTo(annuityPayment(700000, 20, 60), 6);
  });

  it("тестовый кредит — стартовые значения симулятора", () => {
    const vars = Object.fromEntries(testVariables(defaultConfig, scenario("early-payment")).map((v) => [v.name, v.value]));
    expect(vars.S).toBe(defaultConfig.simulator.price - defaultConfig.simulator.downPayment);
    expect(vars.n).toBe(defaultConfig.simulator.years * 12);
    expect(vars.P).toBeCloseTo(annuityPayment(vars.S, vars.rate, vars.n), 6);
    expect(vars.X).toBe(500000);
  });

  it("неизвестная переменная и синтаксическая ошибка — понятная ошибка, без падения", () => {
    const s = scenario("early-payment");
    const unknown = previewFormula("X + bonus", defaultConfig, s);
    expect(!unknown.ok && unknown.error).toContain("bonus");
    const broken = previewFormula("X * (", defaultConfig, s);
    expect(!broken.ok && broken.error).toContain("Синтаксическая ошибка");
  });

  it("сценарий для сельской ипотеки считается по сельской ставке", () => {
    const preview = previewScenario(defaultConfig, scenario("lose-benefit"));
    if ("error" in preview) throw new Error(preview.error);
    expect(preview.test.loan.ratePct).toBe(3);
    expect(preview.result.after.payment.value).toBeGreaterThan(preview.result.before.payment.value);
  });
});

describe("админка: новый сценарий без кода", () => {
  it("«Рождение ребёнка» проходит проверку и сокращает срок", () => {
    const config = structuredClone(defaultConfig);
    config.scenarios.push(childBirth);
    expect(validateConfig(config)).toEqual([]);
    const preview = previewScenario(config, childBirth);
    if ("error" in preview) throw new Error(preview.error);
    expect(preview.result.after.months.value).toBeLessThan(preview.result.before.months.value);
  });

  it("нельзя сохранить: неизвестная переменная, плохой id, default вне диапазона", () => {
    const config = structuredClone(defaultConfig);
    config.scenarios.push({
      ...childBirth,
      id: "Рождение ребёнка",
      params: [{ ...childBirth.params[0], default: 10 }],
      effects: { earlyAmount: "matCapFirst + bonus" },
    });
    const errors = validateConfig(config).join("\n");
    expect(errors).toContain("bonus");
    expect(errors).toContain("строчная латиница");
    expect(errors).toContain("вне диапазона");
  });

  it("экспорт → импорт возвращает тот же конфиг", () => {
    const config = structuredClone(defaultConfig);
    config.scenarios.push(childBirth);
    const result = importConfig(exportConfig(config));
    expect("config" in result && result.config).toEqual(config);
  });

  it("импорт битого файла — ошибки, а не исключение", () => {
    expect(importConfig("{ не json")).toEqual({ errors: ["Файл не похож на JSON"] });
    expect("errors" in importConfig('{"version": 2}')).toBe(true);
  });
});
