// Линейные графики по месяцам: остаток долга, ежемесячный платёж.
// Одна ось Y, одна шкала. Под графиком — та же информация таблицей по годам.

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Schedule } from "../../core/annuity";
import { formatMonths, formatRub } from "../../ui/format";

export type LineSeries = {
  name: string;
  color: string;
  dashed?: boolean;
  schedule: Schedule; // по нему — длина линии
  value?: (month: number) => number | undefined; // своё значение вместо valueAt (например, сумма двух графиков)
};

type Props = {
  series: LineSeries[];
  // Значение месяца m (0 — момент выдачи) по графику; undefined — линии уже нет
  valueAt: (schedule: Schedule, month: number) => number | undefined;
  yFormat: (v: number) => string;
  months?: number; // ширина оси X; по умолчанию — самый длинный график
  stepAfter?: boolean; // платёж меняется ступеньками — рисуем ступеньки, а не наклон
};

// Ось Y: 4,5 млн / 25 тыс.
export const millions = (v: number) =>
  v === 0 ? "0" : `${(v / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн`;
export const thousands = (v: number) => (v === 0 ? "0" : `${Math.round(v / 1000).toLocaleString("ru-RU")} тыс.`);

export function MonthlyLines({ series, valueAt, yFormat, months, stepAfter }: Props) {
  const total = months ?? Math.max(...series.map((s) => s.schedule.months));
  const data = Array.from({ length: total + 1 }, (_, m) => {
    const row: Record<string, number | undefined> = { month: m };
    series.forEach((s, k) => (row[`s${k}`] = s.value ? s.value(m) : valueAt(s.schedule, m)));
    return row;
  });
  // Подписи по оси X — каждые 5 лет (или каждый год для коротких кредитов)
  const stepMonths = total > 120 ? 60 : 12;
  const ticks = Array.from({ length: Math.floor(total / stepMonths) + 1 }, (_, k) => k * stepMonths);
  const yearly = data.filter((d) => (d.month as number) % 12 === 0);

  return (
    <>
      <div className="chart">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="month"
              type="number"
              domain={[0, total]}
              ticks={ticks}
              tickFormatter={(m: number) => `${m / 12} ${m === 0 ? "" : "г."}`.trim()}
              stroke="var(--chart-axis)"
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              domain={[0, "auto"]}
              tickFormatter={yFormat}
              stroke="var(--chart-axis)"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              formatter={(v: number, name: string) => [formatRub(v), name]}
              labelFormatter={(m: number) => (m === 0 ? "Сейчас" : `Через ${formatMonths(m)}`)}
              contentStyle={{ borderRadius: 12, borderColor: "var(--color-border)", fontSize: 13 }}
            />
            {series.length > 1 && (
              <Legend verticalAlign="top" align="left" iconType="plainline" wrapperStyle={{ fontSize: 13, paddingBottom: 8 }} />
            )}
            {series.map((s, k) => (
              <Line
                key={s.name}
                name={s.name}
                dataKey={`s${k}`}
                type={stepAfter ? "stepAfter" : "linear"}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "6 4" : undefined}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="table-view">
        <summary>Показать таблицей</summary>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Год</th>
              {series.map((s) => (
                <th key={s.name}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yearly.map((d) => (
              <tr key={d.month}>
                <th>{(d.month as number) / 12}</th>
                {series.map((s, k) => (
                  <td key={s.name}>{d[`s${k}`] === undefined ? "—" : formatRub(d[`s${k}`]!)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

// Остаток долга: в месяц 0 — сумма кредита, дальше — остаток после платежа; после погашения — 0
export function balanceAt(schedule: Schedule, month: number): number {
  if (month === 0) {
    const first = schedule.rows[0];
    return first ? first.balance + first.principal + first.extra : 0;
  }
  return schedule.rows[month - 1]?.balance ?? 0;
}

// Регулярный платёж месяца; после погашения линии нет
export function paymentAt(schedule: Schedule, month: number): number | undefined {
  return schedule.rows[Math.max(month, 1) - 1]?.payment;
}

type BalanceProps = {
  before: Schedule;
  after?: Schedule; // нет сценария — одна линия
  other?: Schedule; // другой кредит сценария (ремонт): рисуем общий долг и сам кредит
  beforeLabel: string;
  afterLabel: string;
};

// Остаток долга «до/после»: без изменений — охра пунктиром, с учётом сценария — зелёная линия.
// Если в сценарии есть другой кредит, «с учётом сценария» — общий долг (ипотека + другой кредит),
// а сам другой кредит — отдельной розовой линией: видно, сколько он добавляет и когда закроется.
export function BalanceChart({ before, after, other, beforeLabel, afterLabel }: BalanceProps) {
  const series: LineSeries[] = after
    ? [
        { name: beforeLabel, color: "var(--chart-before)", dashed: true, schedule: before },
        other
          ? {
              name: `${afterLabel}: общий долг`,
              color: "var(--chart-after)",
              schedule: after.months >= other.months ? after : other,
              value: (m: number) => balanceAt(after, m) + balanceAt(other, m),
            }
          : { name: afterLabel, color: "var(--chart-after)", schedule: after },
        // После погашения линия другого кредита обрывается, а не лежит на нуле
        ...(other
          ? [{ name: "Другой кредит", color: "var(--chart-5)", schedule: other, value: (m: number) => (m <= other.months ? balanceAt(other, m) : undefined) }]
          : []),
      ]
    : [{ name: beforeLabel, color: "var(--chart-after)", schedule: before }];
  return <MonthlyLines series={series} valueAt={balanceAt} yFormat={millions} />;
}
