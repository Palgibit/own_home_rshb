// Форматирование чисел для интерфейса: рубли, проценты, сроки.

const rub = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export function formatRub(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${rub.format(Math.round(value))} ₽`;
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? num.format(value) : "—";
}

export function formatPct(value: number): string {
  return Number.isFinite(value) ? `${num.format(Math.round(value * 10) / 10)}%` : "—";
}

// Склонение: plural(5, ["год", "года", "лет"]) → «лет»
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b === 1) return forms[0];
  if (b >= 2 && b <= 4) return forms[1];
  return forms[2];
}

// 208 мес → «17 лет 4 мес»
export function formatMonths(months: number): string {
  if (!Number.isFinite(months)) return "—";
  const total = Math.round(months);
  const y = Math.floor(total / 12);
  const m = total % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} ${plural(y, ["год", "года", "лет"])}`);
  if (m || !y) parts.push(`${m} мес`);
  return parts.join(" ");
}

export type Format = "rub" | "pct" | "months" | "number";

export function formatBy(format: Format, value: number): string {
  switch (format) {
    case "rub":
      return formatRub(value);
    case "pct":
      return formatPct(value);
    case "months":
      return formatMonths(value);
    default:
      return formatNumber(value);
  }
}

// «2026-11-08» → «8 ноября 2026»
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(`${iso}T00:00:00Z`)).replace(/\s?г\.$/, "");
}

// 12 → «через 12 дней», 0 → «сегодня», −3 → «3 дня назад»
export function formatDaysLeft(days: number): string {
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  const n = Math.abs(days);
  const word = `${n} ${plural(n, ["день", "дня", "дней"])}`;
  return days > 0 ? `через ${word}` : `${word} назад`;
}
