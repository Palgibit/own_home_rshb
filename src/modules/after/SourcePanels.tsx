// Откуда данные: у гостя — переключатель «демо / свой кредит» и форма ввода,
// у клиента — плашка «данные из банка» с кнопкой выхода.

import { useConfig } from "../../config/ConfigContext";
import { PROGRAMS, PROGRAM_RATE_PARAM, type LoanProgram } from "../../config/schema";
import type { LoanData } from "../../data/DataSource";
import type { GuestLoanInput } from "../../data/guest";
import { DateField } from "../../ui/DateField";
import { NumberField } from "../../ui/NumberField";
import { formatMonths, formatRub } from "../../ui/format";

export type GuestState = { source: "demo" | "manual"; input: GuestLoanInput };

type GuestProps = { value: GuestState; onChange: (next: GuestState) => void; today: string };

export function GuestSourcePanel({ value, onChange, today }: GuestProps) {
  const { config, globals } = useConfig();
  const demo = config.after.guestDemo;
  const input = value.input;
  const set = (patch: Partial<GuestLoanInput>) => onChange({ ...value, input: { ...input, ...patch } });

  return (
    <section className="panel after-source" aria-label="Данные о кредите">
      <div className="segmented" role="group" aria-label="Источник данных">
        {(["demo", "manual"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`segmented-item${value.source === s ? " is-active" : ""}`}
            aria-pressed={value.source === s}
            onClick={() => onChange({ ...value, source: s })}
          >
            {s === "demo" ? "Демо-кредит" : "Ввести свой кредит"}
          </button>
        ))}
      </div>

      {value.source === "demo" ? (
        <p className="scenario-description">
          Пример: {PROGRAMS[demo.program].toLowerCase()} на {formatRub(demo.principal)} на {formatMonths(demo.years * 12)},
          выдана {formatMonths(demo.monthsAgo)} назад. Введите свой кредит — или войдите в личный кабинет, и данные
          подставятся сами.
        </p>
      ) : (
        <>
          <div className="segmented" role="group" aria-label="Программа">
            {(Object.keys(PROGRAMS) as LoanProgram[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`segmented-item${input.program === p ? " is-active" : ""}`}
                aria-pressed={input.program === p}
                // Смена программы подставляет её ставку из конфига — потом можно поправить
                onClick={() => set({ program: p, ratePct: globals[PROGRAM_RATE_PARAM[p]] ?? input.ratePct })}
              >
                {PROGRAMS[p]}
              </button>
            ))}
          </div>
          <div className="form-grid form-grid-3">
            <NumberField label="Сумма кредита" unit="₽" value={input.principal} min={1} max={100_000_000} onChange={(v) => set({ principal: v })} />
            <NumberField label="Ставка по договору" unit="%" value={input.ratePct} min={0} max={40} onChange={(v) => set({ ratePct: v })} />
            <NumberField label="Срок" unit="лет" value={input.years} min={1} max={35} onChange={(v) => set({ years: v })} />
            <DateField label="Дата выдачи" value={input.issueDate} max={today} onChange={(v) => set({ issueDate: v })} />
            <NumberField
              label="Стоимость жилья"
              unit="₽"
              value={input.propertyPrice}
              min={0}
              max={200_000_000}
              hint="Для налогового вычета"
              onChange={(v) => set({ propertyPrice: v })}
            />
          </div>
          <p className="field-hint">Данные остаются только в вашем браузере.</p>
        </>
      )}
    </section>
  );
}

type ClientProps = { data: LoanData | null; loading: boolean; onLogout: () => void };

export function ClientBar({ data, loading, onLogout }: ClientProps) {
  return (
    <section className="client-bar" aria-label="Личный кабинет">
      <span className="client-avatar" aria-hidden="true">
        {data?.owner?.name.charAt(0) ?? "…"}
      </span>
      <div className="client-info">
        <strong>{data?.owner?.name ?? "Загружаем…"}</strong>
        <span>
          {data?.owner
            ? `Договор ${data.owner.contractNo} · данные из банковского контура${loading ? " · обновляем…" : ""}`
            : "Подключаемся к банку"}
        </span>
      </div>
      <button type="button" className="button button-secondary" onClick={onLogout}>
        Выйти
      </button>
    </section>
  );
}
