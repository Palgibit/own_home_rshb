// Базовый кредит: программа, стоимость и взнос (→ сумма кредита), базовая ставка, срок,
// доход и расходы семьи. Скидки к ставке и страховка с расходами — в свёрнутых блоках.

import { useConfig } from "../../config/ConfigContext";
import { PROGRAM_RATE_PARAM, PROGRAMS, type LoanProgram } from "../../config/schema";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { NumberField } from "../../ui/NumberField";
import { formatNumber, formatPct, formatRub } from "../../ui/format";
import { CostsBlock } from "./CostsBlock";
import type { Purchase } from "./purchaseModel";
import { RateChecklist } from "./RateChecklist";
import type { BaseInput, PurchaseChoice } from "./types";

type Props = {
  value: BaseInput;
  onChange: (next: BaseInput) => void;
  choice: PurchaseChoice;
  onChoice: (next: PurchaseChoice) => void;
  purchase: Purchase;
};

export function BaseLoanForm({ value, onChange, choice, onChoice, purchase }: Props) {
  const { config, globals } = useConfig();
  const set = (patch: Partial<BaseInput>) => onChange({ ...value, ...patch });

  // При смене программы подставляем её ставку из конфига
  const setProgram = (program: LoanProgram) =>
    set({ program, ratePct: globals[PROGRAM_RATE_PARAM[program]] ?? value.ratePct });

  const rateHint = config.params.find((p) => p.id === PROGRAM_RATE_PARAM[value.program])?.hint;
  const { warnings } = purchase;

  return (
    <section className="panel" aria-labelledby="base-heading">
      <h2 id="base-heading" className="panel-title">
        Ваш кредит
      </h2>

      <div className="segmented" role="radiogroup" aria-label="Программа">
        {(Object.keys(PROGRAMS) as LoanProgram[]).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={value.program === p}
            className={`segmented-item${value.program === p ? " is-active" : ""}`}
            onClick={() => setProgram(p)}
          >
            {PROGRAMS[p]}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <NumberField
          label="Стоимость жилья"
          unit="₽"
          value={value.price}
          min={0}
          max={200_000_000}
          onChange={(price) => set({ price, downPayment: Math.min(value.downPayment, price) })}
        />
        <NumberField
          label="Первоначальный взнос"
          unit="₽"
          value={value.downPayment}
          min={0}
          max={value.price}
          // Минимум — без округления: 30,01%, а не 30%
          hint={`${formatPct(purchase.downPct)} от стоимости. Минимум по программе — ${formatNumber(purchase.minDownPct)}%.`}
          onChange={(downPayment) => set({ downPayment })}
        />
      </div>

      <p className="loan-amount">
        <span>Сумма кредита</span>
        <ExplainableNumber value={purchase.loanAmount} />
      </p>

      {warnings.downTooLow && (
        <p className="note note-warn">
          Взнос меньше минимума программы: нужно от {formatNumber(warnings.downTooLow.minPct)}%, это{" "}
          {formatRub(Math.ceil(warnings.downTooLow.minAmount))}.
        </p>
      )}
      {warnings.overLimit && (
        <p className="note note-warn">
          Кредит больше лимита сельской ипотеки — {formatRub(warnings.overLimit.limit)} на заёмщика. Увеличьте взнос
          или оформите второй кредит на супруга: на один объект можно взять два.
        </p>
      )}

      <div className="form-grid">
        <NumberField
          label="Базовая ставка"
          unit="%"
          value={value.ratePct}
          min={0}
          max={50}
          step={0.1}
          hint={rateHint}
          onChange={(ratePct) => set({ ratePct })}
        />
        <NumberField label="Срок" unit="лет" value={value.years} min={1} max={35} onChange={(years) => set({ years })} />
      </div>

      <RateChecklist program={value.program} basePct={value.ratePct} choice={choice} onChoice={onChoice} purchase={purchase} />

      <div className="form-grid">
        <NumberField
          label="Доход семьи"
          unit="₽/мес"
          value={value.income}
          min={0}
          max={10_000_000}
          onChange={(income) => set({ income })}
        />
        <NumberField
          label="Обязательные расходы"
          unit="₽/мес"
          value={value.expenses}
          min={0}
          max={10_000_000}
          hint="Еда, коммуналка, транспорт — без платежей по кредитам."
          onChange={(expenses) => set({ expenses })}
        />
      </div>

      <CostsBlock choice={choice} onChoice={onChoice} purchase={purchase} />
    </section>
  );
}
