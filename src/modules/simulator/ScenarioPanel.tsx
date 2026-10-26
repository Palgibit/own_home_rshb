// Выбор сценария «Что, если…?» и его параметры. Всё берётся из конфига:
// новый сценарий, добавленный админом, появится здесь без изменений в коде.

import type { EarlyMode } from "../../core/annuity";
import type { ScenarioDef } from "../../config/schema";
import { NumberField } from "../../ui/NumberField";

type Props = {
  scenarios: ScenarioDef[];
  scenario: ScenarioDef;
  onSelect: (id: string) => void;
  params: Record<string, number>;
  onParam: (id: string, value: number) => void;
  earlyMode: EarlyMode;
  onEarlyMode: (mode: EarlyMode) => void;
};

export function ScenarioPanel({ scenarios, scenario, onSelect, params, onParam, earlyMode, onEarlyMode }: Props) {
  const hasEarly = Boolean(scenario.effects.earlyAmount?.trim());

  return (
    <section className="panel" aria-labelledby="scenario-heading">
      <h2 id="scenario-heading" className="panel-title">
        Что, если…
      </h2>

      <div className="scenario-list" role="radiogroup" aria-label="Сценарий">
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={s.id === scenario.id}
            className={`scenario-chip${s.id === scenario.id ? " is-active" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>

      <p className="scenario-description">{scenario.description}</p>

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

      {scenario.hint && <p className="note">{scenario.hint}</p>}
    </section>
  );
}
