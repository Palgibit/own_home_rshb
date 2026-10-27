// «Было → стало»: в центре внимания — платёж по ипотеке (крупная карточка),
// ниже — срок, переплата и свободный бюджет с бейджем долговой нагрузки (ПДН).
// Подробности (два режима досрочки, эффекты сценария) свёрнуты.
// Каждое число кликабельно — раскрывает формулу и подстановки.

import type { EarlyMode } from "../../core/annuity";
import type { Explained } from "../../core/explain";
import { EFFECTS, pdnLevel, type EffectKey, type Metrics, type ScenarioResult } from "../../core/scenarios";
import { useConfig } from "../../config/ConfigContext";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { formatBy, formatMonths, type Format } from "../../ui/format";

type Better = "lower" | "higher";

const SMALL_METRICS: { key: "months" | "overpayment" | "budget"; label: string; format: Format; better: Better }[] = [
  { key: "months", label: "Срок", format: "months", better: "lower" },
  { key: "overpayment", label: "Переплата", format: "rub", better: "lower" },
  { key: "budget", label: "Свободный бюджет", format: "rub", better: "higher" },
];

const PDN_TEXT = { green: "комфортно", yellow: "напряжённо", red: "опасно" } as const;

// Как показывать значение эффекта: месяцы, проценты или рубли
const EFFECT_FORMAT: Partial<Record<EffectKey, Format>> = {
  earlyMonth: "number",
  rateMonth: "number",
  newRate: "pct",
};

function Delta({ before, after, format, better }: { before: number; after: number; format: Format; better: Better }) {
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

function BeforeAfter({ before, after, format }: { before: Explained; after: Explained; format: Format }) {
  return (
    <div className="metric-values">
      <span className="metric-before">
        <ExplainableNumber value={before} format={format} />
      </span>
      <span className="metric-arrow" aria-label="стало">
        →
      </span>
      <span className="metric-after">
        <ExplainableNumber value={after} format={format} />
      </span>
    </div>
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
      <article className="metric-card metric-main">
        <h3 className="metric-label">Платёж по ипотеке в месяц</h3>
        <BeforeAfter before={before.payment} after={after.payment} format="rub" />
        <Delta before={before.payment.value} after={after.payment.value} format="rub" better="lower" />
        {effects.extraPayment && (
          <span className="metric-extra">
            + другой кредит <ExplainableNumber value={effects.extraPayment} /> в месяц
          </span>
        )}
      </article>

      <div className="metric-grid">
        {SMALL_METRICS.map((m) => (
          <article className="metric-card" key={m.key}>
            <h3 className="metric-label">{m.label}</h3>
            <BeforeAfter before={before[m.key]} after={after[m.key]} format={m.format} />
            <Delta before={before[m.key].value} after={after[m.key].value} format={m.format} better={m.better} />
            {m.key === "budget" && (
              <span className={`pdn-badge pdn-${level}`}>
                <span aria-hidden="true">●</span> Нагрузка <ExplainableNumber value={after.pdn} format="pct" /> —{" "}
                {PDN_TEXT[level]}
              </span>
            )}
          </article>
        ))}
      </div>

      {byMode && (
        <details className="table-view panel-details">
          <summary>Сравнить два режима досрочки</summary>
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
        </details>
      )}

      {Object.keys(effects).length > 0 && (
        <details className="table-view panel-details">
          <summary>Как сценарий меняет расчёт</summary>
          <div className="effects">
            {(Object.entries(effects) as [EffectKey, NonNullable<ScenarioResult["effects"][EffectKey]>][]).map(([key, e]) => (
              <span className="effect-item" key={key}>
                {EFFECTS[key]}: <ExplainableNumber value={e} format={EFFECT_FORMAT[key] ?? "rub"} />
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
