// Типовые сценарии — строка карточек над маршрутом: быстрый старт в один клик.
// На телефоне карточки прокручиваются по горизонтали.

import { useMemo } from "react";
import { buildRoute, type NavigatorDef } from "../../core/navigator";
import { plural } from "../../ui/format";

type Props = {
  nav: NavigatorDef;
  currentPresetId?: string;
  onPreset: (presetId: string) => void;
};

export function PresetsBar({ nav, currentPresetId, onPreset }: Props) {
  // Сколько шагов в маршруте каждого сценария — считает то же ядро, что и маршрут
  const counts = useMemo(() => nav.presets.map((p) => buildRoute(nav, p.answers).length), [nav]);

  return (
    <section className="presets-bar" aria-labelledby="presets-heading">
      <h2 id="presets-heading" className="panel-subtitle">
        С чего начнём?
      </h2>
      <div className="presets-row">
        {nav.presets.map((p, i) => {
          const isActive = p.id === currentPresetId;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={isActive}
              className={`preset-card${isActive ? " is-active" : ""}`}
              onClick={() => onPreset(p.id)}
            >
              <span className="preset-title">{p.title}</span>
              <span className="preset-count">
                {counts[i]} {plural(counts[i], ["шаг", "шага", "шагов"])}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
