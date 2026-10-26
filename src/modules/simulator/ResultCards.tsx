// «Было → стало» по метрикам: платёж, срок, переплата, свободный бюджет, ПДН.
// Каждое число кликабельно — раскрывает формулу и подстановки.

import type { EarlyMode } from "../../core/annuity";
import { EFFECTS, pdnLevel, type EffectKey, type Metrics, type ScenarioResult } from "../../core/scenarios";
import { useConfig } from "../../config/ConfigContext";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { formatBy, formatMonths, type Format } from "../../ui/format";

type MetricKey = "payment" | "months" | "overpayment" | "budget" | "pdn";

const METRICS: { key: MetricKey; label: string; format: Format; better: "lower" | "higher" }[] = [
  { key: "payment", label: "Платёж по ипотеке", format: "rub", better: "lower" },
  { key: "months", label: "Срок", format: "months", better: "lower" },
  { key: "overpayment", label: "Переплата", format: "rub", better: "lower" },
  { key: "budget", label: "Свободный бюджет", format: "rub", better: "higher" },
  { key: "pdn", label: "Долговая нагрузка", format: "pct", better: "lower" },
];

const PDN_TEXT = { green: "комфортно", yellow: "напряжённо", red: "опасно" } as const;

// Как показывать значение эффекта: месяцы, проценты или рубли
const EFFECT_FORMAT: Partial<Record<EffectKey, Format>> = {
  earlyMonth: "number",
  rateMonth: "number",
  newRate: "pct",
};

function Delta({ before, after, format, better }: { before: number; after: number; format: Format; better: "lower" | "higher" }) {
  const diff = after - before;
  const tiny = format === "pct" ? 0.05 : 0.5;
  if (!Number.isFinite(diff) || Math.abs(diff) < tiny) return <span className="delta">без изменений</span>;
  const good = better === "lower" ? diff < 0 : diff > 0;
  const abs = format === "months" ? formatMonths(Math.abs(diff)) : formatBy(format, Math.abs(diff));
  return (
    <span className={`delta ${good ? "delta-good" : "delta-bad"}`}>
      {diff > 0 ? "+" : "−"}
      {abs}
    </span>
  );
}

type Props = {
  result: ScenarioResult;
  earlyMode: EarlyMode;
};

export function ResultCards({ result, earlyMode }: Props) {
  const { globals } = useConfig();
  const { before, after, effects, alternative } = result;
  const level = pdnLevel(after.pdn.value, globals.pdnYellow ?? 30, globals.pdnRed ?? 50);

  // Для сравнения режимов досрочки: какой результат к какому режиму относится
  const byMode: Record<EarlyMode, Metrics> | null = alternative
    ? ({ [earlyMode]: after, [alternative.mode]: alternative.after } as Record<EarlyMode, Metrics>)
    : null;

  return (
    <div className="results">
      <div className="metric-grid">
        {METRICS.map((m) => (
          <article className="metric-card" key={m.key}>
            <h3 className="metric-label">{m.label}</h3>
            <div className="metric-values">
              <span className="metric-before">
                <ExplainableNumber value={before[m.key]} format={m.format} />
              </span>
              <span className="metric-arrow" aria-label="стало">
                →
              </span>
              <span className="metric-after">
                <ExplainableNumber value={after[m.key]} format={m.format} />
              </span>
            </div>
            <Delta before={before[m.key].value} after={after[m.key].value} format={m.format} better={m.better} />
            {m.key === "pdn" && (
              <span className={`pdn-badge pdn-${level}`}>
                <span aria-hidden="true">●</span> {PDN_TEXT[level]}
              </span>
            )}
            {m.key === "payment" && effects.extraPayment && (
              <span className="metric-extra">
                + другой кредит <ExplainableNumber value={effects.extraPayment} /> в месяц
              </span>
            )}
          </article>
        ))}
      </div>

      {byMode && (
        <div className="panel mode-compare">
          <h3 className="panel-subtitle">Два режима досрочки</h3>
          <table className="compare-table">
            <thead>
              <tr>
                <th />
                <th>Уменьшить срок</th>
                <th>Уменьшить платёж</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Платёж</th>
                <td><ExplainableNumber value={byMode.term.payment} /></td>
                <td><ExplainableNumber value={byMode.payment.payment} /></td>
              </tr>
              <tr>
                <th>Срок</th>
                <td><ExplainableNumber value={byMode.term.months} format="months" /></td>
                <td><ExplainableNumber value={byMode.payment.months} format="months" /></td>
              </tr>
              <tr>
                <th>Переплата</th>
                <td><ExplainableNumber value={byMode.term.overpayment} /></td>
                <td><ExplainableNumber value={byMode.payment.overpayment} /></td>
              </tr>
            </tbody>
          </table>
          <p className="note">
            Уменьшение срока экономит ещё{" "}
            <strong>{formatBy("rub", byMode.payment.overpayment.value - byMode.term.overpayment.value)}</strong>,
            уменьшение платежа освобождает{" "}
            <strong>{formatBy("rub", byMode.term.payment.value - byMode.payment.payment.value)}</strong> в месяц.
          </p>
        </div>
      )}

      {Object.keys(effects).length > 0 && (
        <div className="effects">
          <span className="effects-title">Как сценарий меняет расчёт:</span>
          {(Object.entries(effects) as [EffectKey, NonNullable<ScenarioResult["effects"][EffectKey]>][]).map(([key, e]) => (
            <span className="effect-item" key={key}>
              {EFFECTS[key]}: <ExplainableNumber value={e} format={EFFECT_FORMAT[key] ?? "rub"} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
