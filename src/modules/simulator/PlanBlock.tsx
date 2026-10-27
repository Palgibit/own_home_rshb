// План досрочных платежей: несколько разовых и регулярных платежей, у каждого свой режим.
// Ядро (comparePlan) считает четыре варианта: без досрочек, ваш план, весь план
// «сократить срок», весь план «уменьшить платёж». Здесь — ввод плана и графики.

import { useId, useMemo, useState } from "react";
import type { EarlyMode, Loan } from "../../core/annuity";
import { comparePlan, type PlanItem, type PlanKind, type PlanVariantId } from "../../core/plan";
import type { InsuranceSettings } from "../../core/purchase";
import type { Household } from "../../core/scenarios";
import { useConfig } from "../../config/ConfigContext";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { NumberField } from "../../ui/NumberField";
import { formatMonths, formatRub } from "../../ui/format";
import { balanceAt, millions, MonthlyLines, paymentAt, thousands, type LineSeries } from "./BalanceChart";

const KINDS: [PlanKind, string][] = [
  ["once", "Разовый"],
  ["monthly", "Каждый месяц"],
  ["yearly", "Каждый год"],
];
const MODES: [EarlyMode, string][] = [
  ["term", "Сократить срок"],
  ["payment", "Уменьшить платёж"],
];

// Цвет закреплён за вариантом во всех трёх графиках раздела
const VARIANTS: Record<PlanVariantId, { name: string; color: string; dashed?: boolean }> = {
  none: { name: "Без досрочек", color: "var(--chart-2)", dashed: true },
  term: { name: "Сократить срок", color: "var(--chart-1)" },
  payment: { name: "Уменьшить платёж", color: "var(--chart-3)" },
  yours: { name: "Ваш план", color: "var(--chart-4)" },
};

type Props = { loan: Loan; household: Household; insurance: InsuranceSettings };

export function PlanBlock({ loan, household, insurance }: Props) {
  const { config } = useConfig();
  const [items, setItems] = useState<PlanItem[]>(() => structuredClone(config.simulator.planExample));
  const [chart, setChart] = useState<"balance" | "payment">("balance");

  const plan = useMemo(() => comparePlan(loan, household, items, insurance), [loan, household, items, insurance]);
  // «Ваш план» рисуем отдельной линией, только если в нём есть оба режима —
  // иначе он совпадает с одним из вариантов «весь план — …»
  const mixed = new Set(items.filter((i) => i.amount > 0).map((i) => i.mode)).size > 1;
  const shown: PlanVariantId[] = mixed ? ["none", "term", "payment", "yours"] : ["none", "term", "payment"];

  const setItem = (k: number, patch: Partial<PlanItem>) =>
    setItems((all) => all.map((it, i) => (i === k ? { ...it, ...patch } : it)));

  const series: LineSeries[] = shown.map((id) => ({ ...VARIANTS[id], schedule: plan[id].metrics.schedule }));
  const termExtra = plan.payment.metrics.overpayment.value - plan.term.metrics.overpayment.value;
  const tableIds: PlanVariantId[] = ["none", "yours", "term", "payment"];
  const maxOver = Math.max(...tableIds.map((id) => plan[id].metrics.overpayment.value), 1);
  const hasPlan = items.some((i) => i.amount > 0);
  // Платёж в режиме «уменьшить платёж» через год после первой досрочки.
  // Не «в конце срока»: при ежемесячных доплатах он к концу стремится к нулю, и это ничего не говорит
  const firstMonth = Math.min(...items.filter((i) => i.amount > 0).map((i) => Math.round(i.fromMonth)), loan.months);
  const laterMonth = Math.min(firstMonth + 12, plan.payment.metrics.schedule.months);
  const laterPayment = plan.payment.metrics.schedule.rows[laterMonth - 1]?.payment ?? 0;

  return (
    <section className="feature" id="plan" aria-labelledby="plan-heading">
      <div className="feature-head">
        <p className="eyebrow">Свой график</p>
        <h2 id="plan-heading">План досрочных платежей</h2>
        <p className="feature-lead">
          Добавьте разовые и регулярные досрочки — посчитаем, когда закроете кредит и сколько сэкономите. И сравним,
          что выгоднее: сокращать срок или уменьшать платёж.
        </p>
      </div>

      <div className="panel">
        <div className="plan-items">
          {items.map((it, k) => (
            <div className="plan-item" key={k}>
              <SelectField label="Тип" value={it.kind} options={KINDS} onChange={(kind) => setItem(k, { kind })} />
              <NumberField
                label={it.kind === "once" ? "В каком месяце" : "С какого месяца"}
                unit="мес"
                value={it.fromMonth}
                min={1}
                max={loan.months}
                onChange={(fromMonth) => setItem(k, { fromMonth })}
              />
              <NumberField
                label="Сумма"
                unit="₽"
                value={it.amount}
                min={0}
                max={100_000_000}
                onChange={(amount) => setItem(k, { amount })}
              />
              <SelectField label="Режим" value={it.mode} options={MODES} onChange={(mode) => setItem(k, { mode })} />
              <button
                type="button"
                className="plan-remove"
                aria-label={`Удалить платёж ${k + 1}`}
                title="Удалить платёж"
                onClick={() => setItems((all) => all.filter((_, i) => i !== k))}
              >
                <span aria-hidden="true">×</span>
                <span className="plan-remove-text"> Удалить</span>
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setItems((all) => [...all, { kind: "once", fromMonth: 24, amount: 300_000, mode: "term" }])}
            >
              + Платёж
            </button>
          </div>
        </div>

        {hasPlan ? (
          <>
            <p className="big-answer">
              С вашим планом кредит закроется за <strong>{formatMonths(plan.yours.metrics.months.value)}</strong>{" "}
              вместо {formatMonths(plan.none.metrics.months.value)}, экономия —{" "}
              <strong>
                <ExplainableNumber value={plan.yours.saving} />
              </strong>
              .
            </p>
            <p className="note">
              Если весь план направить на сокращение срока, он сэкономит ещё{" "}
              <strong>{formatRub(Math.max(termExtra, 0))}</strong> по сравнению с уменьшением платежа. А уменьшение
              платежа снизит его с {formatRub(plan.none.metrics.payment.value)} до{" "}
              <strong>{formatRub(laterPayment)}</strong> уже через {formatMonths(laterMonth)} после выдачи.
            </p>
          </>
        ) : (
          <p className="note">Добавьте хотя бы один платёж с суммой больше нуля.</p>
        )}

        <div className="segmented" role="radiogroup" aria-label="График">
          {(
            [
              ["balance", "Остаток долга"],
              ["payment", "Ежемесячный платёж"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={chart === id}
              className={`segmented-item${chart === id ? " is-active" : ""}`}
              onClick={() => setChart(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {chart === "balance" ? (
          <MonthlyLines series={series} valueAt={balanceAt} yFormat={millions} months={loan.months} />
        ) : (
          <>
            <MonthlyLines series={series} valueAt={paymentAt} yFormat={thousands} months={loan.months} stepAfter />
            <p className="field-hint">
              В режиме «уменьшить платёж» после каждой досрочки банк пересчитывает платёж — он падает ступеньками.
            </p>
          </>
        )}

        <div>
          <h3 className="panel-subtitle">Переплата по вариантам</h3>
          <div className="hbars">
            {tableIds.map((id) => (
              <div className="hbar-row" key={id}>
                <span className="hbar-label">{VARIANTS[id].name}</span>
                <span className="hbar-track">
                  <span
                    className="hbar-fill"
                    style={{ width: `${(plan[id].metrics.overpayment.value / maxOver) * 100}%`, background: VARIANTS[id].color }}
                  />
                </span>
                <span className="hbar-value">
                  <ExplainableNumber value={plan[id].metrics.overpayment} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <details className="table-view">
          <summary>Сравнить варианты таблицей</summary>
          <table className="compare-table">
            <thead>
              <tr>
                <th />
                {tableIds.map((id) => (
                  <th key={id}>{VARIANTS[id].name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Срок</th>
                {tableIds.map((id) => (
                  <td key={id}>{formatMonths(plan[id].metrics.months.value)}</td>
                ))}
              </tr>
              <tr>
                <th>Переплата</th>
                {tableIds.map((id) => (
                  <td key={id}>{formatRub(plan[id].metrics.overpayment.value)}</td>
                ))}
              </tr>
              <tr>
                <th>Платёж в конце</th>
                {tableIds.map((id) => (
                  <td key={id}>{formatRub(plan[id].metrics.payment.value)}</td>
                ))}
              </tr>
              <tr>
                <th>Внесено досрочно</th>
                {tableIds.map((id) => (
                  <td key={id}>{formatRub(plan[id].extraPaid)}</td>
                ))}
              </tr>
              <tr>
                <th>Экономия</th>
                {tableIds.map((id) => (
                  <td key={id}>{formatRub(plan[id].saving.value)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </details>
      </div>
    </section>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="field-box">
        <select id={id} className="field-input field-select" value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map(([v, text]) => (
            <option key={v} value={v}>
              {text}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
