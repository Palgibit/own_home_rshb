// Досрочное погашение, изменение срока и платежа — на остатке долга.
// Всё через ядро модуля 1: computeMetrics (оба режима досрочки), а ниже —
// те же блоки «Досрочка или вклад» и «Чашка кофе», что и в симуляторе.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { earlyNow, remainingPayment, type LoanStatus } from "../../core/loanStatus";
import type { Metrics } from "../../core/scenarios";
import { useConfig } from "../../config/ConfigContext";
import type { LoanData } from "../../data/DataSource";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { NumberField } from "../../ui/NumberField";
import { formatMonths, formatRub } from "../../ui/format";
import { CoffeeBlock } from "../simulator/CoffeeBlock";
import { DepositVsEarlyBlock } from "../simulator/DepositVsEarlyBlock";

const MAX_TERM_YEARS = 30;

function Row({ title, m, base }: { title: string; m: Metrics; base: Metrics }) {
  const saving = base.overpayment.value - m.overpayment.value;
  return (
    <tr>
      <th>{title}</th>
      <td>
        <ExplainableNumber value={m.payment} />
      </td>
      <td>
        <ExplainableNumber value={m.months} format="months" />
      </td>
      <td>
        <ExplainableNumber value={m.overpayment} />
        {saving > 0.5 && <span className="delta delta-good">−{formatRub(saving)}</span>}
      </td>
    </tr>
  );
}

export function ChangeLoanBlock({ data, status }: { data: LoanData; status: LoanStatus }) {
  const { config } = useConfig();
  const navigate = useNavigate();
  const remaining = status.remaining;
  const [amount, setAmount] = useState(() => Math.min(config.after.earlyAmount, Math.round(remaining.principal)));
  const [years, setYears] = useState(() => Math.max(1, Math.round(remaining.months / 12)));

  if (!status.next) return null; // кредит погашен — менять нечего

  const r = earlyNow(remaining, amount);
  const termWins = r.term.overpayment.value <= r.payment.overpayment.value;
  const newPayment = remainingPayment({ ...remaining, months: years * 12 });
  const diff = newPayment.value - status.next.amount.value;

  return (
    <>
      <section className="feature" id="early" aria-labelledby="early-heading">
        <div className="feature-head">
          <p className="eyebrow">Досрочка, срок и платёж</p>
          <h2 id="early-heading">Досрочное погашение</h2>
          <p className="feature-lead">
            Считаем на остатке долга: {formatRub(remaining.principal)}, осталось {formatMonths(remaining.months)}. Деньги
            уйдут в погашение вместе с ближайшим платежом.
          </p>
        </div>

        <div className="feature-grid">
          <div className="panel">
            <NumberField
              label="Внести досрочно"
              unit="₽"
              value={amount}
              min={0}
              max={Math.max(1, Math.ceil(remaining.principal))}
              step={10_000}
              slider
              onChange={setAmount}
            />
            <div className="table-scroll">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Вариант</th>
                    <th>Платёж</th>
                    <th>Срок</th>
                    <th>Осталось процентов</th>
                  </tr>
                </thead>
                <tbody>
                  <Row title="Без досрочки" m={r.before} base={r.before} />
                  <Row title="Уменьшить срок" m={r.term} base={r.before} />
                  <Row title="Уменьшить платёж" m={r.payment} base={r.before} />
                </tbody>
              </table>
            </div>
            {amount > 0 && (
              <p className="note">
                {termWins
                  ? `Уменьшение срока сэкономит на ${formatRub(r.payment.overpayment.value - r.term.overpayment.value)} больше. Уменьшение платежа — если важнее облегчить бюджет каждый месяц.`
                  : "Уменьшение платежа здесь выгоднее."}
              </p>
            )}
          </div>

          <div className="panel">
            <NumberField
              label="Перенести остаток на срок"
              unit="лет"
              value={years}
              min={1}
              max={MAX_TERM_YEARS}
              slider
              onChange={setYears}
            />
            <p className="big-answer">
              Платёж станет <ExplainableNumber value={newPayment} />
            </p>
            <p className="field-hint">
              {Math.abs(diff) < 1
                ? "Это текущий срок — платёж не изменится."
                : diff > 0
                  ? `На ${formatRub(diff)} больше, зато кредит закроется раньше и процентов будет меньше.`
                  : `На ${formatRub(-diff)} меньше, но процентов за весь срок будет больше.`}{" "}
              Изменить срок можно по заявлению в банк — решение принимает банк.
            </p>
          </div>
        </div>
      </section>

      <DepositVsEarlyBlock
        loan={remaining}
        program={data.program}
        onOpenScenario={(id) => navigate(`/simulator?scenario=${id}`)}
      />
      <CoffeeBlock loan={remaining} />
    </>
  );
}
