// Матрица «шаг × сценарий» — прямой ответ на требование задачи 2:
// видно, какие шаги есть в каждом сценарии и где рекомендация особая.
// Строится тем же ядром, что и маршрут, поэтому всегда совпадает с ним.

import { Fragment, useMemo } from "react";
import { buildMatrix, buildRoute, type NavigatorDef } from "../../core/navigator";
import { plural } from "../../ui/format";
import { fillTemplate, useParamFormatter } from "../../ui/TemplateText";

type Props = {
  nav: NavigatorDef;
  currentPresetId?: string;
  onOpenPreset: (presetId: string) => void;
};

export function MatrixView({ nav, currentPresetId, onOpenPreset }: Props) {
  const matrix = useMemo(() => buildMatrix(nav), [nav]);
  const counts = useMemo(() => nav.presets.map((p) => buildRoute(nav, p.answers).length), [nav]);
  const format = useParamFormatter();
  const columns = nav.presets.length + 1;

  return (
    <section className="panel matrix-panel" aria-labelledby="matrix-heading">
      <div>
        <h2 id="matrix-heading" className="panel-title">
          Как маршрут меняется по сценариям
        </h2>
        <p className="scenario-description">
          Строки — шаги, столбцы — типовые сценарии. Наведите на значок, чтобы прочитать рекомендацию; нажмите на
          сценарий, чтобы открыть его маршрут.
        </p>
      </div>

      <div className="matrix-legend" aria-hidden="true">
        <span>
          <i className="matrix-mark is-shown">●</i> шаг есть
        </span>
        <span>
          <i className="matrix-mark is-special">◆</i> особая рекомендация
        </span>
        <span>
          <i className="matrix-mark">·</i> шага нет
        </span>
      </div>

      <div className="matrix-scroll" tabIndex={0} aria-label="Таблица прокручивается по горизонтали">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col" className="matrix-corner">
                Шаг
              </th>
              {nav.presets.map((p, i) => (
                <th key={p.id} scope="col" className={p.id === currentPresetId ? "is-current" : undefined}>
                  <button type="button" className="matrix-preset" onClick={() => onOpenPreset(p.id)}>
                    {p.title}
                  </button>
                  <span className="matrix-count">
                    {counts[i]} {plural(counts[i], ["шаг", "шага", "шагов"])}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(({ stage, rows }) =>
              rows.length === 0 ? null : (
                <Fragment key={stage.id}>
                  <tr className="matrix-stage">
                    <th scope="colgroup" colSpan={columns}>
                      {stage.title}
                    </th>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.step.id}>
                      <th scope="row">{row.step.title}</th>
                      {row.cells.map((c, i) => {
                        const preset = nav.presets[i];
                        const current = preset.id === currentPresetId ? " is-current" : "";
                        if (c.cell === "none") {
                          return (
                            <td key={preset.id} className={current}>
                              <span className="matrix-mark" aria-label="нет">·</span>
                            </td>
                          );
                        }
                        const text = fillTemplate(c.text ?? "", format);
                        return (
                          <td key={preset.id} className={current}>
                            <span
                              className={`matrix-mark ${c.cell === "special" ? "is-special" : "is-shown"}`}
                              title={text}
                              aria-label={c.cell === "special" ? `особая рекомендация: ${text}` : `есть: ${text}`}
                            >
                              {c.cell === "special" ? "◆" : "●"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
