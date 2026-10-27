// «Платёж по годам»: сколько за год уходит на погашение долга, на проценты,
// на досрочные платежи и страховку. Видно, что в первые годы платёж — в основном проценты.

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Metrics } from "../../core/scenarios";
import { formatRub } from "../../ui/format";
import { thousands } from "./BalanceChart";

const SERIES = [
  { key: "principal", name: "Погашение долга", color: "var(--chart-1)" },
  { key: "interest", name: "Проценты", color: "var(--chart-2)" },
  { key: "extra", name: "Досрочно", color: "var(--chart-4)" },
  { key: "insurance", name: "Страховка", color: "var(--chart-3)" },
] as const;

type Row = { year: number; principal: number; interest: number; extra: number; insurance: number };

export function yearlyRows(metrics: Metrics): Row[] {
  const rows: Row[] = [];
  for (const r of metrics.schedule.rows) {
    const y = Math.ceil(r.month / 12);
    rows[y - 1] ??= { year: y, principal: 0, interest: 0, extra: 0, insurance: metrics.insurance?.byYear[y - 1] ?? 0 };
    rows[y - 1].principal += r.principal;
    rows[y - 1].interest += r.interest;
    rows[y - 1].extra += r.extra;
  }
  return rows;
}

export function YearlyChart({ metrics }: { metrics: Metrics }) {
  const data = yearlyRows(metrics);
  // Пустые серии (нет досрочек, нет страховки) не показываем ни в графике, ни в легенде
  const series = SERIES.filter((s) => data.some((d) => d[s.key] > 0.5));

  return (
    <>
      <div className="chart">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="year"
              stroke="var(--chart-axis)"
              tick={{ fontSize: 12 }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
              tickFormatter={(y: number) => `${y}`}
            />
            <YAxis
              tickFormatter={thousands}
              stroke="var(--chart-axis)"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              formatter={(v: number, name: string) => [formatRub(v), name]}
              labelFormatter={(y: number) => `${y}-й год`}
              cursor={{ fill: "var(--color-soft)" }}
              contentStyle={{ borderRadius: 12, borderColor: "var(--color-border)", fontSize: 13 }}
            />
            <Legend verticalAlign="top" align="left" iconType="square" wrapperStyle={{ fontSize: 13, paddingBottom: 8 }} />
            {series.map((s, k) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="year"
                fill={s.color}
                // Белая обводка даёт зазор 2 px между частями столбца
                stroke="var(--color-surface)"
                strokeWidth={1}
                radius={k === series.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="field-hint">По оси X — год кредита.</p>
      <details className="table-view">
        <summary>Показать таблицей</summary>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Год</th>
              {series.map((s) => (
                <th key={s.key}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.year}>
                <th>{d.year}</th>
                {series.map((s) => (
                  <td key={s.key}>{formatRub(d[s.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
