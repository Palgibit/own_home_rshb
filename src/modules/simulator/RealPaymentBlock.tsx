// Фича 4. Реальная стоимость платежа: платёж по договору не меняется,
// а деньги дешевеют. Показываем, сколько он «весит» в сегодняшних рублях.

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { realPaymentAt, realPayments } from "../../core/features";
import { useConfig } from "../../config/ConfigContext";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { formatPct, formatRub, plural } from "../../ui/format";

const thousands = (v: number) => v === 0 ? "0" : `${Math.round(v / 1000).toLocaleString("ru-RU")} тыс.`;

export function RealPaymentBlock({ payment, years }: { payment: number; years: number }) {
  const { config, globals } = useConfig();
  const inflation = globals.inflation ?? 0;
  const data = realPayments(payment, inflation, years);
  // Пример для текста: через 10 лет (или середина срока для коротких кредитов)
  const t = Math.min(10, Math.max(1, Math.floor(years / 2)));
  const at = realPaymentAt(payment, inflation, t);
  const hint = config.params.find((p) => p.id === "inflation")?.hint;

  return (
    <section className="feature" id="real" aria-labelledby="real-heading">
      <div className="feature-head">
        <p className="eyebrow">Время работает на вас</p>
        <h2 id="real-heading">Сколько на самом деле стоит платёж</h2>
        <p className="feature-lead">
          Через {t} {plural(t, ["год", "года", "лет"])} платёж {formatRub(payment)} будет весить как{" "}
          <strong>
            <ExplainableNumber value={at} />
          </strong>{" "}
          сегодня.
        </p>
      </div>

      <div className="panel">
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="year"
                stroke="var(--chart-axis)"
                tick={{ fontSize: 12 }}
                tickLine={false}
                tickFormatter={(y: number) => `${y} г.`}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                domain={[0, "auto"]}
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
                contentStyle={{ borderRadius: 12, borderColor: "var(--color-border)", fontSize: 13 }}
              />
              <Legend verticalAlign="top" align="left" height={32} iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
              <Line name="По договору" dataKey="nominal" stroke="var(--chart-before)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              <Line name="В сегодняшних рублях" dataKey="real" stroke="var(--chart-after)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="field-hint">
          Инфляция {formatPct(inflation)} в год. {hint}
        </p>
      </div>
    </section>
  );
}
