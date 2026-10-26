// «Объяснённое число»: значение + откуда оно взялось.
// Ядро заполняет formulaId и подставленные значения. Текст формулы и пояснение
// простым языком UI берёт из конфига по formulaId — так их может править админ,
// а ядро остаётся без зависимостей от конфига.

export type ExplainedInput = { value: number; label: string };

export type Explained<T = number> = {
  value: T;
  formulaId: string;
  inputs: Record<string, ExplainedInput>;
  // Для формул, заданных админом в сценарии: само выражение.
  // Для встроенных формул пусто — текст лежит в config.formulas.
  expression?: string;
};

export function explained<T>(
  formulaId: string,
  value: T,
  inputs: Record<string, ExplainedInput> = {},
  expression?: string,
): Explained<T> {
  return { value, formulaId, inputs, expression };
}

// Короткая запись входа: inp(1000, "Сумма кредита")
export function inp(value: number, label: string): ExplainedInput {
  return { value, label };
}
