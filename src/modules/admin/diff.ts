// «Что изменено»: список отличий между двумя конфигами — по-человечески, а не JSON-диффом.
// Сравниваем по id: параметры, сценарии, шаги навигатора, скидки, расходы, подсказки, сервисы.
// Используется трижды: «что поменяется при сохранении» (сохранённый → черновик),
// «отличия от умолчаний» на вкладке «Файл» и подсветка параметров на вкладке «Параметры».

import type { AppConfig, SimulatorDefaults } from "../../config/schema";

// Подписи стартовых значений симулятора: и для формы на вкладке «Параметры», и для списка изменений
export const SIM_LABELS: Record<Exclude<keyof SimulatorDefaults, "program" | "planExample">, [string, string?]> = {
  price: ["Стоимость жилья", "₽"],
  downPayment: ["Первоначальный взнос", "₽"],
  years: ["Срок", "лет"],
  income: ["Доход семьи", "₽/мес"],
  expenses: ["Обязательные расходы", "₽/мес"],
  compareAmount: ["«Досрочка или вклад»: сумма", "₽"],
  compareMonth: ["… через сколько месяцев", "мес"],
  compareHorizonMonths: ["… горизонт сравнения", "мес"],
  coffeeExtra: ["«Чашка кофе»: доплата", "₽/мес"],
  coffeeMax: ["… максимум ползунка", "₽/мес"],
  familySize: ["«Город или село»: человек в семье"],
};

export type ConfigChange = {
  section: string; // «Параметры», «Сценарии»…
  label: string; // что именно
  kind: "added" | "removed" | "changed";
  before?: string; // было — если есть что показать
  after?: string; // стало
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const num = (v: number, unit?: string) => `${v.toLocaleString("ru-RU")}${unit ? ` ${unit}` : ""}`;

// Списки с id: добавлено / удалено / изменено. describe — как показать элемент в строке «было/стало»
function diffById<T extends { id: string }>(
  section: string,
  a: T[] = [],
  b: T[] = [],
  title: (x: T) => string,
  describe: (x: T) => string = () => "",
): ConfigChange[] {
  const out: ConfigChange[] = [];
  const before = new Map(a.map((x) => [x.id, x]));
  const after = new Map(b.map((x) => [x.id, x]));
  for (const [id, x] of before) {
    const y = after.get(id);
    if (!y) out.push({ section, label: title(x), kind: "removed" });
    else if (!same(x, y)) {
      const d1 = describe(x);
      const d2 = describe(y);
      // Значение то же — значит, поменялись подпись, подсказка или формулы: просто «изменено»
      out.push(d1 === d2 ? { section, label: title(y), kind: "changed" } : { section, label: title(y), kind: "changed", before: d1, after: d2 });
    }
  }
  for (const [id, y] of after) if (!before.has(id)) out.push({ section, label: title(y), kind: "added" });
  return out;
}

export function diffConfig(a: AppConfig, b: AppConfig): ConfigChange[] {
  const out: ConfigChange[] = [];

  // Параметры: показываем значение, если поменялось оно; иначе — «подпись/подсказка изменены»
  out.push(
    ...diffById("Параметры", a.params, b.params, (p) => p.label || p.id, (p) => num(p.value, p.unit)),
  );

  // Стартовые значения симулятора — по ключам
  for (const key of new Set([...Object.keys(a.simulator ?? {}), ...Object.keys(b.simulator ?? {})])) {
    const x = (a.simulator as Record<string, unknown>)?.[key];
    const y = (b.simulator as Record<string, unknown>)?.[key];
    if (same(x, y)) continue;
    const show = (v: unknown) => (typeof v === "number" ? num(v) : typeof v === "string" ? v : undefined);
    out.push({ section: "Стартовые значения симулятора", label: SIM_LABELS[key as keyof typeof SIM_LABELS]?.[0] ?? key, kind: "changed", before: show(x), after: show(y) });
  }

  out.push(...diffById("Скидки и надбавки", a.rateOptions, b.rateOptions, (o) => o.label || o.id, (o) => `${o.deltaPct} п.п.`));
  out.push(...diffById("Расходы на сделку", a.dealCosts, b.dealCosts, (c) => c.label || c.id, (c) => num(c.amount, "₽")));
  out.push(...diffById("Сценарии", a.scenarios, b.scenarios, (s) => s.title || s.id));
  out.push(...diffById("Подсказки к формулам", a.formulas, b.formulas, (f) => f.title || f.id));
  out.push(...diffById("Сервисы", a.services, b.services, (s) => s.title || s.id));
  out.push(...diffById("Навигатор, шаги", a.navigator?.steps, b.navigator?.steps, (s) => s.title || s.id));
  for (const key of ["questions", "conflicts", "stages", "presets"] as const) {
    if (!same(a.navigator?.[key], b.navigator?.[key])) {
      out.push({ section: "Навигатор", label: NAV_PARTS[key], kind: "changed" });
    }
  }
  for (const key of new Set([...Object.keys(a.after ?? {}), ...Object.keys(b.after ?? {})])) {
    const x = (a.after as Record<string, unknown>)?.[key];
    const y = (b.after as Record<string, unknown>)?.[key];
    if (same(x, y)) continue;
    const show = (v: unknown) => (typeof v === "number" ? num(v) : undefined);
    out.push({ section: "После ипотеки", label: AFTER_PARTS[key] ?? key, kind: "changed", before: show(x), after: show(y) });
  }
  return out;
}

const NAV_PARTS = { questions: "Вопросы", conflicts: "Недопустимые сочетания", stages: "Этапы", presets: "Типовые сценарии" };

const AFTER_PARTS: Record<string, string> = {
  guestDemo: "Демо-кредит гостя",
  reminderDays: "Напоминать за, дней",
  earlyAmount: "Сумма досрочки по умолчанию",
  salary: "Зарплата в калькуляторе вычета",
  taxFaq: "Справка по вычету",
  taxSteps: "Шаги получения вычета",
  certificates: "Справки",
  insuranceHint: "Подсказка о страховании",
  ruralHint: "Подсказка о сельской ипотеке",
  insuranceService: "Сервис страхования",
  settleServices: "Сервисы обустройства",
  closingSteps: "Шаги после закрытия кредита",
};
