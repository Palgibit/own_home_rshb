// Безопасный вычислитель формул из конфига (их пишет админ).
// Формула разбирается mathjs в дерево, и мы пропускаем только «белый список»:
// числа, переменные из разрешённого набора, арифметику, сравнения, тернарник
// и несколько функций. Никакого eval, доступа к свойствам и присваиваний.

import { parse, type MathNode } from "mathjs";
import { annuityPayment } from "./annuity";

// Функции, доступные в формулах. annuity(S, rate, n) — платёж по второму кредиту и т.п.
const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  annuity: annuityPayment,
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  ln: Math.log,
  exp: Math.exp,
  sqrt: Math.sqrt,
};

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

const ALLOWED_NODES = new Set([
  "ConstantNode",
  "SymbolNode",
  "OperatorNode",
  "ParenthesisNode",
  "FunctionNode",
  "ConditionalNode",
]);

export type FormulaCheck =
  | { ok: true; variables: string[] }
  | { ok: false; error: string };

// Проверка формулы: синтаксис, допустимые конструкции, известные переменные.
export function checkFormula(expression: string, allowedVars: Iterable<string>): FormulaCheck {
  const allowed = new Set(allowedVars);
  let tree: MathNode;
  try {
    tree = parse(expression);
  } catch (e) {
    return { ok: false, error: `Синтаксическая ошибка: ${(e as Error).message}` };
  }

  const used = new Set<string>();
  const problems: string[] = [];
  tree.traverse((node, _path, parent) => {
    if (!ALLOWED_NODES.has(node.type)) {
      problems.push(`недопустимая конструкция (${node.type})`);
      return;
    }
    if (node.type === "FunctionNode") {
      const name = (node as unknown as { fn: { name?: string } }).fn.name ?? "";
      if (!(name in FUNCTIONS)) problems.push(`неизвестная функция «${name}»`);
    }
    if (node.type === "SymbolNode") {
      // Имя функции в FunctionNode тоже SymbolNode — его уже проверили выше
      if (parent?.type === "FunctionNode" && (parent as unknown as { fn: MathNode }).fn === node) return;
      const name = (node as unknown as { name: string }).name;
      if (!allowed.has(name)) problems.push(`неизвестная переменная «${name}»`);
      else used.add(name);
    }
  });

  if (problems.length) return { ok: false, error: [...new Set(problems)].join("; ") };
  return { ok: true, variables: [...used] };
}

// Вычислить формулу. Бросает ошибку, если формула не прошла проверку или результат не число.
export function evaluateFormula(expression: string, scope: Record<string, number>): number {
  const check = checkFormula(expression, Object.keys(scope));
  if (!check.ok) throw new Error(check.error);
  const result = parse(expression).compile().evaluate({ ...FUNCTIONS, ...scope });
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Формула вернула не число");
  }
  return result;
}
