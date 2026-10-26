// График остатка долга «до/после» по месяцам

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Schedule } from "../../core/annuity";
import { formatMonths, formatRub } from "../../ui/format";

type Props = { principal: number; before: Schedule; after: Schedule };

// Ось Y в миллионах: 4,5 млн
const millions = (v: number) => v === 0 ? "0" : `${(v / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн`;

export function BalanceChart({ principal, before, after }: Props) {
  const months = Math.max(before.months, after.months);
  // Точка 0 — сумма кредита; дальше остаток после платежа каждого месяца
  const data = Array.from({ length: months + 1 }, (_, m) => ({
    month: m,
    before: m === 0 ? principal : before.rows[m - 1]?.balance ?? 0,
    after: m === 0 ? principal : after.rows[m - 1]?.balance ?? 0,
  }));
  // Подписи по оси X — каждые 5 лет (или каждый год для коротких кредитов)
  const stepMonths = months > 120 ? 60 : 12;
  const ticks = Array.from({ length: Math.floor(months / stepMonths) + 1 }, (_, k) => k * stepMonths);
  const yearly = data.filter((d) => d.month % 12 === 0);

  return (
    <section className="panel" aria-labelledby="balance-heading">
      <h3 id="balance-heading" className="panel-subtitle">
        Остаток долга
      </h3>
      <div className="chart">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="month"
              type="number"
              domain={[0, months]}
              ticks={ticks}
              tickFormatter={(m: number) => `${m / 12} ${m === 0 ? "" : "г."}`.trim()}
              stroke="var(--chart-axis)"
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={millions}
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
            <Legend verticalAlign="top" align="left" height={32} iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
            <Line
              name="Было"
              dataKey="before"
              stroke="var(--chart-before)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              name="Стало"
              dataKey="after"
              stroke="var(--chart-after)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="table-view">
        <summary>Показать таблицей</summary>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Год</th>
              <th>Было</th>
              <th>Стало</th>
            </tr>
          </thead>
          <tbody>
            {yearly.map((d) => (
              <tr key={d.month}>
                <th>{d.month / 12}</th>
                <td>{formatRub(d.before)}</td>
                <td>{formatRub(d.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
