// Живой предпросмотр формул в админке. Формулы считаются на «тестовом кредите» —
// стартовых значениях симулятора из того же черновика конфига — и на значениях
// параметров сценария по умолчанию. Здесь нет своего расчёта: всё через ядро.

import type { Loan } from "../../core/annuity";
import { checkFormula, evaluateFormula, FUNCTION_NAMES } from "../../core/evaluate";
import { applyScenario, BASE_VARS, baseScope, computeMetrics, type Household, type ScenarioResult } from "../../core/scenarios";
import {
  globalLabels,
  globalValues,
  PROGRAM_RATE_PARAM,
  scenarioVariables,
  type AppConfig,
  type ScenarioDef,
} from "../../config/schema";

export type TestCase = { loan: Loan; household: Household };

// Тестовый кредит: стартовые значения симулятора; программа — та, для которой сценарий
export function testCase(config: AppConfig, scenario: ScenarioDef): TestCase {
  const sim = config.simulator;
  const program = scenario.onlyFor ?? sim.program;
  return {
    loan: {
      principal: sim.principal,
      ratePct: globalValues(config)[PROGRAM_RATE_PARAM[program]] ?? 0,
      months: Math.max(1, Math.round(sim.years * 12)),
    },
    household: { income: sim.income, expenses: sim.expenses },
  };
}

export type TestVariable = {
  name: string;
  label: string;
  value: number;
  source: "base" | "global" | "scenario";
};

// Все переменные, доступные в формулах сценария, с тестовыми значениями
export function testVariables(config: AppConfig, scenario: ScenarioDef): TestVariable[] {
  const { loan, household } = testCase(config, scenario);
  const base = baseScope(loan, household, computeMetrics(loan, household).payment.value);
  return [
    ...Object.entries(BASE_VARS).map(([name, label]) => ({ name, label, value: base[name], source: "base" as const })),
    ...config.params.map((p) => ({ name: p.id, label: p.label, value: p.value, source: "global" as const })),
    ...scenario.params.map((p) => ({ name: p.id, label: p.label, value: p.default, source: "scenario" as const })),
  ];
}

export type FormulaPreview = { ok: true; value: number } | { ok: false; error: string };

// Проверить и посчитать одну формулу. Порядок как в applyScenario:
// параметры сценария перекрывают базовые, базовые — глобальные.
export function previewFormula(expression: string, config: AppConfig, scenario: ScenarioDef): FormulaPreview {
  const check = checkFormula(expression, scenarioVariables(scenario, config));
  if (!check.ok) return check;
  const vars = testVariables(config, scenario);
  const scope: Record<string, number> = {};
  for (const source of ["global", "base", "scenario"] as const) {
    for (const v of vars) if (v.source === source) scope[v.name] = v.value;
  }
  try {
    return { ok: true, value: evaluateFormula(expression, scope) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Весь сценарий на тестовом кредите: «было → стало», как покажет симулятор
export function previewScenario(
  config: AppConfig,
  scenario: ScenarioDef,
): { result: ScenarioResult; test: TestCase } | { error: string } {
  const test = testCase(config, scenario);
  try {
    const result = applyScenario({
      scenario,
      ...test,
      params: Object.fromEntries(scenario.params.map((p) => [p.id, p.default])),
      globals: globalValues(config),
      globalLabels: globalLabels(config),
    });
    return { result, test };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// Подсказка по функциям для редактора формул
export const FUNCTION_HINTS: Record<string, string> = {
  annuity: "annuity(S, rate, n) — аннуитетный платёж: сумма, ставка в % годовых, срок в мес",
  min: "min(a, b) — меньшее",
  max: "max(a, b) — большее",
  abs: "abs(x) — модуль",
  round: "round(x) — округлить",
  floor: "floor(x) — округлить вниз",
  ceil: "ceil(x) — округлить вверх",
  ln: "ln(x) — натуральный логарифм",
  exp: "exp(x) — экспонента",
  sqrt: "sqrt(x) — квадратный корень",
};

// Если в ядро добавят функцию, а подсказку забудут — покажем хотя бы имя
export const FUNCTIONS_LIST = FUNCTION_NAMES.map((name) => ({ name, hint: FUNCTION_HINTS[name] ?? `${name}(…)` }));
