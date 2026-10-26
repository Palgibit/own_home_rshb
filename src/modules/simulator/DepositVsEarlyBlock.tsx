// Фича 1. «Досрочка или вклад?» + «Потеря льготы».
// При сельской ипотеке под 3% вклад обычно выгоднее досрочки.
// Если льготу потерять (ставка вырастет до lossRate), вывод разворачивается —
// поэтому для сельской ипотеки показываем обе колонки рядом.

import { useState } from "react";
import type { Loan } from "../../core/annuity";
import { depositVsEarly, type DepositVsEarly } from "../../core/features";
import { useConfig } from "../../config/ConfigContext";
import type { LoanProgram } from "../../config/schema";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { NumberField } from "../../ui/NumberField";
import { formatMonths, formatPct, formatRub } from "../../ui/format";

type Props = {
  loan: Loan;
  program: LoanProgram;
  onOpenScenario: (id: string) => void;
};

function Verdict({ title, r }: { title: string; r: DepositVsEarly }) {
  return (
    <article className="verdict-card">
      <h4 className="verdict-title">{title}</h4>
      <dl className="verdict-rows">
        <div>
          <dt>Доход по вкладу</dt>
          <dd>
            +<ExplainableNumber value={r.deposit} />
          </dd>
        </div>
        <div>
          <dt>Экономия на процентах от досрочки</dt>
          <dd>
            <ExplainableNumber value={r.early} />
          </dd>
        </div>
      </dl>
      <p className={`verdict-plaque verdict-${r.winner}`}>
        {r.winner === "deposit" ? "Выгоднее вклад" : "Выгоднее досрочка"} на {formatRub(r.difference)}
      </p>
    </article>
  );
}

export function DepositVsEarlyBlock({ loan, program, onOpenScenario }: Props) {
  const { config, globals } = useConfig();
  const sim = config.simulator;
  const [amount, setAmount] = useState(sim.compareAmount);
  const [month, setMonth] = useState(sim.compareMonth);
  const [horizon, setHorizon] = useState(sim.compareHorizonMonths);

  const depositRatePct = globals.depositRate ?? 0;
  const depositTaxPct = globals.depositTax ?? 0;
  const lossRate = globals.lossRate ?? loan.ratePct;
  const common = { loan, amount, month, horizon, depositRatePct, depositTaxPct };

  const now = depositVsEarly(common);
  // Потеря льготы: с того же месяца ставка становится lossRate
  const lost =
    program === "rural" ? depositVsEarly({ ...common, events: { rateChanges: [{ month, ratePct: lossRate }] } }) : null;
  const flipped = lost && lost.winner !== now.winner;
  const depositHint = config.params.find((p) => p.id === "depositRate")?.hint;

  return (
    <section className="feature" id="deposit" aria-labelledby="deposit-heading">
      <div className="feature-head">
        <p className="eyebrow">Главный вопрос</p>
        <h2 id="deposit-heading">Досрочка или вклад?</h2>
        <p className="feature-lead">
          Обычно советуют гасить досрочно. Но если ставка по кредиту ниже ставки вклада, деньги выгоднее держать на
          вкладе. Сравним, что принесёт одна и та же сумма за одно и то же время.
        </p>
      </div>

      <div className="panel">
        <div className="form-grid form-grid-3">
          <NumberField label="Свободная сумма" unit="₽" value={amount} min={0} max={20_000_000} step={10_000} slider onChange={setAmount} />
          <NumberField label="Через сколько месяцев" unit="мес" value={month} min={1} max={Math.max(1, loan.months - 1)} slider onChange={setMonth} />
          <NumberField label="Горизонт сравнения" unit="мес" value={horizon} min={6} max={240} step={6} slider onChange={setHorizon} />
        </div>
        <p className="field-hint">
          Ставка вклада {formatPct(depositRatePct)}, налог на проценты {formatPct(depositTaxPct)}. {depositHint}
          {now.horizon < horizon && ` Кредит с досрочкой закончится раньше — сравниваем за ${formatMonths(now.horizon)}.`}
        </p>

        <div className={`verdict-grid${lost ? "" : " verdict-grid-single"}`}>
          <Verdict title={`Сейчас: ставка ${formatPct(loan.ratePct)}`} r={now} />
          {lost && <Verdict title={`Если потеряете льготу: ставка ${formatPct(lossRate)}`} r={lost} />}
        </div>

        {flipped && (
          <div className="note note-warn note-action">
            <p>
              <strong>Вывод разворачивается.</strong> При льготной ставке выгоднее{" "}
              {now.winner === "deposit" ? "вклад" : "досрочка"}, а после потери льготы —{" "}
              {lost!.winner === "deposit" ? "вклад" : "досрочка"}. Льгота сохраняется, пока вы работаете в нужной сфере,
              живёте в доме и вовремя подтверждаете занятость.
            </p>
            <button type="button" className="button button-secondary" onClick={() => onOpenScenario("lose-benefit")}>
              Что будет с платежом →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
