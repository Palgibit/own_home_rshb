// «Куда уйдут деньги»: полная цена покупки одной полосой — свои деньги (взнос и расходы),
// тело кредита, проценты, страховка. Для сценария — две полосы «было» и «стало»
// в одном масштабе: короче полоса — дешевле покупка.

import type { Metrics } from "../../core/scenarios";
import { formatRub } from "../../ui/format";

export type StackPart = { label: string; value: number; color: string };

// Составная горизонтальная полоса. width — доля ширины (для общего масштаба нескольких полос).
// Подпись каждой части — в легенде; при наведении — всплывающая подсказка.
export function StackBar({ label, parts, width = 1, legend = true }: { label: string; parts: StackPart[]; width?: number; legend?: boolean }) {
  const visible = parts.filter((p) => p.value > 0.5);
  const total = visible.reduce((s, p) => s + p.value, 0);
  return (
    <div className="stack">
      <div className="stack-bar" role="img" aria-label={`${label}: ${visible.map((p) => `${p.label} ${formatRub(p.value)}`).join(", ")}`} style={{ width: `${width * 100}%` }}>
        {visible.map((p) => (
          <span
            key={p.label}
            className="stack-part"
            title={`${p.label}: ${formatRub(p.value)}`}
            style={{ flexGrow: total > 0 ? p.value / total : 0, background: p.color }}
          />
        ))}
      </div>
      {legend && (
        <ul className="stack-legend">
          {visible.map((p) => (
            <li key={p.label}>
              <span className="swatch" style={{ background: p.color }} aria-hidden="true" />
              {p.label} <strong>{formatRub(p.value)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Части полной цены покупки. Тело кредита — стоимость − взнос: премия первого года,
// даже если она в кредите, учтена в «страховке», а не в теле.
function moneyParts(m: Metrics, ownMoney: number, loanBase: number): StackPart[] {
  return [
    { label: "Свои деньги сразу", value: ownMoney, color: "var(--chart-4)" },
    { label: "Тело кредита", value: loanBase, color: "var(--chart-1)" },
    { label: "Проценты", value: m.interest + m.otherOverpayment, color: "var(--chart-2)" },
    { label: "Страховка", value: m.insurance?.total ?? 0, color: "var(--chart-3)" },
  ];
}

type Props = {
  before: Metrics;
  after?: Metrics; // нет — показываем одну полосу
  ownMoney: number; // взнос + расходы на сделку; страховка — отдельной частью, даже если платим её сразу
  loanBase: number;
};

export function MoneyBar({ before, after, ownMoney, loanBase }: Props) {
  const rows = after
    ? [
        { name: "Без изменений", parts: moneyParts(before, ownMoney, loanBase) },
        { name: "С учётом сценария", parts: moneyParts(after, ownMoney, loanBase) },
      ]
    : [{ name: "Ваш кредит", parts: moneyParts(before, ownMoney, loanBase) }];
  const totals = rows.map((r) => r.parts.reduce((s, p) => s + p.value, 0));
  const max = Math.max(...totals, 1);
  const hasOther = (after ?? before).otherOverpayment > 0 || before.otherOverpayment > 0;

  return (
    <section className="panel" aria-labelledby="money-heading">
      <h3 id="money-heading" className="panel-subtitle">
        Куда уйдут деньги
      </h3>
      <p className="scenario-description">
        Полная цена покупки за весь срок: {formatRub(totals.at(-1)!)}
        {after && totals[1] !== totals[0] && (
          <>
            {" "}
            ({totals[1] < totals[0] ? "−" : "+"}
            {formatRub(Math.abs(totals[1] - totals[0]))} к варианту без изменений)
          </>
        )}
        .{hasOther && " Проценты включают переплату по другому кредиту сценария."}
      </p>
      <div className="money-rows">
        {rows.map((r, k) => (
          <div className="money-row" key={r.name}>
            {rows.length > 1 && (
              <span className="money-row-label">
                {r.name} <strong>{formatRub(totals[k])}</strong>
              </span>
            )}
            <StackBar label={r.name} parts={r.parts} width={totals[k] / max} legend={false} />
          </div>
        ))}
      </div>
      <table className="compare-table money-table">
        <thead>
          <tr>
            <th />
            {rows.map((r) => rows.length > 1 && <th key={r.name}>{r.name === "Без изменений" ? "Было" : "Стало"}</th>)}
            {rows.length === 1 && <th>Сумма</th>}
          </tr>
        </thead>
        <tbody>
          {rows[0].parts.map((p, i) => (
            <tr key={p.label}>
              <th>
                <span className="swatch" style={{ background: p.color }} aria-hidden="true" />
                {p.label}
              </th>
              {rows.map((r) => (
                <td key={r.name}>{formatRub(r.parts[i].value)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
