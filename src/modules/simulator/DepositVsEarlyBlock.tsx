// Фича 1. «Досрочка или вклад?» + «Потеря льготы».
// При сельской ипотеке под 3% вклад обычно выгоднее досрочки.
// Если льготу потерять (ставка вырастет до lossRate), вывод разворачивается —
// поэтому для сельской ипотеки показываем обе колонки рядом.
// Под каждым выводом — порог: при какой ставке вклада выгоды сравняются.

import { useState } from "react";
import type { Loan } from "../../core/annuity";
import { breakEvenDepositRate, depositVsEarly, type DepositVsEarly } from "../../core/features";
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

function Verdict({ title, r, amount, depositTaxPct }: { title: string; r: DepositVsEarly; amount: number; depositTaxPct: number }) {
  const threshold = breakEvenDepositRate(r, amount, depositTaxPct);
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
      {Number.isFinite(threshold.value) && (
        <p className="verdict-threshold">
          Вклад выгоднее, если его ставка выше <ExplainableNumber value={threshold} format="pct" />
        </p>
      )}
    </article>
  );
}

export function DepositVsEarlyBlock({ loan, program, onOpenScenario }: Props) {
  const { config, globals } = useConfig();
  const sim = config.simulator;
  const [amount, setAmount] = useState(sim.compareAmount);
  // Месяц от выдачи кредита, когда появились деньги. Чем позже — тем меньше
  // остаток долга, тем меньше процентов «съедает» досрочка и тем меньше экономия
  const [month, setMonth] = useState(sim.compareMonth);
  // Горизонт: сколько месяцев деньги лежат на вкладе и за сколько месяцев
  // считаем экономию на процентах. Сравнивать честно можно только за одинаковый срок
  const [horizon, setHorizon] = useState(sim.compareHorizonMonths);
  // Ставку вклада пользователь двигает сам: по умолчанию — условная из конфига
  const [depositRatePct, setDepositRatePct] = useState(globals.depositRate ?? 0);

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
        <div className="form-grid">
          <NumberField label="Свободная сумма" unit="₽" value={amount} min={0} max={20_000_000} step={10_000} slider onChange={setAmount} />
          <NumberField
            label="Ставка вклада"
            unit="%"
            value={depositRatePct}
            min={0}
            max={25}
            step={0.1}
            slider
            onChange={setDepositRatePct}
            hint={`${depositHint ?? ""} Налог на проценты — ${formatPct(depositTaxPct)}.`.trim()}
          />
          <NumberField
            label="Когда появятся деньги"
            unit="мес"
            value={month}
            min={1}
            max={Math.max(1, loan.months - 1)}
            slider
            onChange={setMonth}
            hint="Через сколько месяцев после выдачи кредита. Чем позже, тем меньше остаток долга и тем меньше экономит досрочка."
          />
          <NumberField
            label="Сравниваем за"
            unit="мес"
            value={horizon}
            min={6}
            max={240}
            step={6}
            slider
            onChange={setHorizon}
            hint="Столько деньги лежат на вкладе — и за столько же считаем экономию на процентах."
          />
        </div>
        {now.horizon < horizon && (
          <p className="field-hint">Кредит с досрочкой закончится раньше — сравниваем за {formatMonths(now.horizon)}.</p>
        )}

        <div className={`verdict-grid${lost ? "" : " verdict-grid-single"}`}>
          <Verdict title={`Сейчас: ставка ${formatPct(loan.ratePct)}`} r={now} amount={amount} depositTaxPct={depositTaxPct} />
          {lost && (
            <Verdict
              title={`Если потеряете льготу: ставка ${formatPct(lossRate)}`}
              r={lost}
              amount={amount}
              depositTaxPct={depositTaxPct}
            />
          )}
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
