// «Платёж по годам» и «Платёж по месяцам»: из чего состоят платежи — погашение долга,
// проценты, досрочные платежи, страховка и другой кредит сценария (ремонт).
// Видно, что в первые годы платёж — в основном проценты.

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Metrics } from "../../core/scenarios";
import { formatMonths, formatRub } from "../../ui/format";
import { thousands } from "./BalanceChart";

const SERIES = [
  { key: "principal", name: "Погашение долга", color: "var(--chart-1)" },
  { key: "interest", name: "Проценты", color: "var(--chart-2)" },
  { key: "extra", name: "Досрочно", color: "var(--chart-4)" },
  { key: "insurance", name: "Страховка", color: "var(--chart-3)" },
  { key: "other", name: "Другой кредит", color: "var(--chart-5)" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];
type Row = { period: number } & Record<SeriesKey, number>;

// Помесячно. Страховка — годовая премия, разложенная по 12 месяцам этого года.
export function monthlyRows(metrics: Metrics): Row[] {
  const { schedule, otherSchedule, insurance } = metrics;
  const months = Math.max(schedule.months, otherSchedule?.months ?? 0);
  return Array.from({ length: months }, (_, k) => {
    const r = schedule.rows[k];
    const o = otherSchedule?.rows[k];
    return {
      period: k + 1,
      principal: r?.principal ?? 0,
      interest: r?.interest ?? 0,
      extra: r?.extra ?? 0,
      insurance: r ? (insurance?.byYear[Math.floor(k / 12)] ?? 0) / 12 : 0,
      other: o ? o.payment + o.extra : 0,
    };
  });
}

// По годам: суммы месяцев. Страховку берём целой премией года — её платят раз в год.
export function yearlyRows(metrics: Metrics): Row[] {
  const rows: Row[] = [];
  for (const m of monthlyRows(metrics)) {
    const y = Math.ceil(m.period / 12);
    rows[y - 1] ??= { period: y, principal: 0, interest: 0, extra: 0, other: 0, insurance: metrics.insurance?.byYear[y - 1] ?? 0 };
    for (const key of ["principal", "interest", "extra", "other"] as const) rows[y - 1][key] += m[key];
  }
  return rows;
}

const total = (r: Row) => SERIES.reduce((s, x) => s + r[x.key], 0);

type BarsProps = {
  data: Row[];
  monthly?: boolean;
  yMax?: number; // обрезать ось Y: разовые досрочки не должны сплющивать обычные платежи
};

function PaymentBars({ data, monthly, yMax }: BarsProps) {
  // Пустые серии (нет досрочек, нет страховки) не показываем ни в графике, ни в легенде
  const series = SERIES.filter((s) => data.some((d) => d[s.key] > 0.5));
  // По месяцам — подписи раз в год или раз в 5 лет
  const step = data.length > 120 ? 60 : 12;
  const ticks = monthly ? data.filter((d) => d.period % step === 0).map((d) => d.period) : undefined;

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap={monthly ? 0 : 2}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="period"
            stroke="var(--chart-axis)"
            tick={{ fontSize: 12 }}
            tickLine={false}
            ticks={ticks}
            interval={monthly ? 0 : "preserveStartEnd"}
            minTickGap={16}
            tickFormatter={(p: number) => (monthly ? `${p / 12} г.` : `${p}`)}
          />
          <YAxis
            tickFormatter={thousands}
            stroke="var(--chart-axis)"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={64}
            domain={yMax ? [0, yMax] : [0, "auto"]}
            allowDataOverflow={Boolean(yMax)}
          />
          <Tooltip
            formatter={(v: number, name: string) => [formatRub(v), name]}
            labelFormatter={(p: number) => (monthly ? `${p}-й месяц (${formatMonths(p)})` : `${p}-й год`)}
            cursor={{ fill: "var(--color-soft)" }}
            contentStyle={{ borderRadius: 12, borderColor: "var(--color-border)", fontSize: 13 }}
          />
          <Legend verticalAlign="top" align="left" iconType="square" wrapperStyle={{ fontSize: 13, paddingBottom: 8 }} />
          {series.map((s, k) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="p"
              fill={s.color}
              // По годам белая обводка даёт зазор между частями столбца; у 240 тонких столбцов её нет
              stroke={monthly ? undefined : "var(--color-surface)"}
              strokeWidth={monthly ? 0 : 1}
              radius={!monthly && k === series.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RowsTable({ data, first }: { data: Row[]; first: string }) {
  const series = SERIES.filter((s) => data.some((d) => d[s.key] > 0.5));
  return (
    <details className="table-view">
      <summary>Показать таблицей</summary>
      <div className="table-scroll table-tall">
        <table className="compare-table">
          <thead>
            <tr>
              <th>{first}</th>
              {series.map((s) => (
                <th key={s.key}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.period}>
                <th>{d.period}</th>
                {series.map((s) => (
                  <td key={s.key}>{formatRub(d[s.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function YearlyChart({ metrics }: { metrics: Metrics }) {
  const data = yearlyRows(metrics);
  return (
    <>
      <PaymentBars data={data} />
      <p className="field-hint">По оси X — год кредита.</p>
      <RowsTable data={data} first="Год" />
    </>
  );
}

const MAX_OVERFLOW_NOTES = 4;

export function MonthlyChart({ metrics }: { metrics: Metrics }) {
  const data = monthlyRows(metrics);
  // Масштаб по обычным месяцам: 1,2 × 95-й перцентиль сумм. Крупные разовые досрочки выходят за верх —
  // их перечисляем под графиком, иначе обычный платёж превратился бы в тонкую полоску у оси
  const sorted = data.map(total).sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  // Круглый верх оси: 43 тыс. → 45 тыс.
  const raw = p95 * 1.2;
  const step = raw > 0 ? 10 ** Math.floor(Math.log10(raw)) / 2 : 1;
  const cap = Math.ceil(raw / step) * step;
  const overflow = data.filter((d) => total(d) > cap);
  const yMax = overflow.length ? cap : undefined;

  return (
    <>
      <PaymentBars data={data} monthly yMax={yMax} />
      <p className="field-hint">
        По оси X — годы кредита, каждый столбец — один месяц. Наведите на столбец, чтобы увидеть, сколько из платежа
        ушло на проценты, а сколько — в счёт долга.
      </p>
      {overflow.length > 0 && (
        <p className="field-hint">
          Не помещаются в масштаб:{" "}
          {overflow
            .slice(0, MAX_OVERFLOW_NOTES)
            .map((d) => `${d.period}-й мес — ${formatRub(total(d))}`)
            .join(", ")}
          {overflow.length > MAX_OVERFLOW_NOTES && ` и ещё ${overflow.length - MAX_OVERFLOW_NOTES}`}. Подробно — в
          таблице.
        </p>
      )}
      <RowsTable data={data} first="Месяц" />
    </>
  );
}
