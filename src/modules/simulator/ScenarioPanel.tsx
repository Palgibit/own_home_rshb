// Выбор сценария «Что, если…?» и его параметры. Всё берётся из конфига:
// новый сценарий, добавленный админом, появится здесь без изменений в коде.
// Первая кнопка — «Только мой кредит»: расчёт без сценария.

import type { EarlyMode } from "../../core/annuity";
import type { ScenarioDef } from "../../config/schema";
import { NumberField } from "../../ui/NumberField";

type Props = {
  scenarios: ScenarioDef[];
  scenario: ScenarioDef | null; // null — «Только мой кредит»
  onSelect: (id: string | null) => void;
  params: Record<string, number>;
  onParam: (id: string, value: number) => void;
  earlyMode: EarlyMode;
  onEarlyMode: (mode: EarlyMode) => void;
};

export function ScenarioPanel({ scenarios, scenario, onSelect, params, onParam, earlyMode, onEarlyMode }: Props) {
  const hasEarly = Boolean(scenario?.effects.earlyAmount?.trim());
  const chips: [string | null, string][] = [[null, "Только мой кредит"], ...scenarios.map((s): [string, string] => [s.id, s.title])];

  return (
    <section className="panel" aria-labelledby="scenario-heading">
      <h2 id="scenario-heading" className="panel-title">
        Что, если…
      </h2>

      <div className="scenario-list" role="radiogroup" aria-label="Сценарий">
        {chips.map(([id, title]) => {
          const active = id === (scenario?.id ?? null);
          return (
            <button
              key={id ?? "none"}
              type="button"
              role="radio"
              aria-checked={active}
              className={`scenario-chip${active ? " is-active" : ""}`}
              onClick={() => onSelect(id)}
            >
              {title}
            </button>
          );
        })}
      </div>

      <p className="scenario-description">
        {scenario
          ? scenario.description
          : "Платёж, срок, переплата и бюджет по вашему кредиту без изменений. Выберите сценарий — покажем, что изменится."}
      </p>

      {scenario && scenario.params.length > 0 && (
        <div className="form-grid">
          {scenario.params.map((p) => (
            <NumberField
              key={p.id}
              label={p.label}
              unit={p.unit}
              value={params[p.id] ?? p.default}
              min={p.min}
              max={p.max}
              step={p.step}
              hint={p.hint}
              slider
              onChange={(v) => onParam(p.id, v)}
            />
          ))}
        </div>
      )}

      {hasEarly && (
        <div className="segmented" role="radiogroup" aria-label="Что уменьшить">
          {(
            [
              ["term", "Уменьшить срок"],
              ["payment", "Уменьшить платёж"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={earlyMode === mode}
              className={`segmented-item${earlyMode === mode ? " is-active" : ""}`}
              onClick={() => onEarlyMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {scenario?.hint && <p className="note">{scenario.hint}</p>}
    </section>
  );
}
