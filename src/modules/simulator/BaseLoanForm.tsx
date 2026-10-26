// Базовый кредит: программа, сумма, ставка, срок, доход и расходы семьи

import { useConfig } from "../../config/ConfigContext";
import { PROGRAM_RATE_PARAM, PROGRAMS, type LoanProgram } from "../../config/schema";
import { NumberField } from "../../ui/NumberField";
import { formatRub } from "../../ui/format";
import type { BaseInput } from "./types";

type Props = {
  value: BaseInput;
  onChange: (next: BaseInput) => void;
};

export function BaseLoanForm({ value, onChange }: Props) {
  const { config, globals } = useConfig();
  const set = (patch: Partial<BaseInput>) => onChange({ ...value, ...patch });

  // При смене программы подставляем её ставку из конфига
  const setProgram = (program: LoanProgram) =>
    set({ program, ratePct: globals[PROGRAM_RATE_PARAM[program]] ?? value.ratePct });

  const ruralLimit = globals.ruralMaxLoan;
  const overLimit = value.program === "rural" && ruralLimit !== undefined && value.principal > ruralLimit;
  const rateHint = config.params.find((p) => p.id === PROGRAM_RATE_PARAM[value.program])?.hint;

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
          label="Сумма кредита"
          unit="₽"
          value={value.principal}
          min={0}
          max={100_000_000}
          onChange={(principal) => set({ principal })}
        />
        <NumberField
          label="Ставка"
          unit="%"
          value={value.ratePct}
          min={0}
          max={50}
          step={0.1}
          hint={rateHint}
          onChange={(ratePct) => set({ ratePct })}
        />
        <NumberField label="Срок" unit="лет" value={value.years} min={1} max={35} onChange={(years) => set({ years })} />
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

      {overLimit && (
        <p className="note note-warn">
          Лимит сельской ипотеки — {formatRub(ruralLimit)} на заёмщика. Супруги могут взять два кредита на один объект.
        </p>
      )}
    </section>
  );
}
