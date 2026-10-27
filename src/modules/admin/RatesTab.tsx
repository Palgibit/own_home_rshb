// Скидки и надбавки к ставке (галочки в симуляторе) и расходы на сделку (блок «Нужно сразу»).
// Глобальные параметры ставки и страховки (скидка за большой взнос, надбавка без полиса,
// тарифы) — на вкладке «Параметры», группы «Ставка» и «Страховка».

import { PROGRAMS, type AppConfig, type LoanProgram } from "../../config/schema";
import { NumberField } from "../../ui/NumberField";
import { optional, TextField } from "./fields";
import type { Edit } from "./AdminPage";

// Новый id: уникальный, чтобы не пересечься с существующими
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}`;

export function RatesTab({ draft, edit }: { draft: AppConfig; edit: Edit }) {
  return (
    <div className="admin-stack">
      <p className="note">
        Значения условные — в подсказках стоит писать «уточняйте в банке». Скидка за большой взнос и надбавка за отказ
        от страхования жизни, а также тарифы страховки — на вкладке «Параметры».
      </p>

      <section className="panel">
        <h2 className="panel-title">Скидки и надбавки к ставке</h2>
        <p className="scenario-description">
          Галочки в симуляторе. Отрицательная поправка — скидка, положительная — надбавка. Варианты с одинаковой группой
          взаимоисключающие: клиент может отметить только один.
        </p>
        {draft.rateOptions.map((o, i) => (
          <div key={i} className="admin-param">
            <div className="admin-grid">
              <TextField label="Подпись" value={o.label} hint={<code>{o.id}</code>} onChange={(v) => edit((d) => void (d.rateOptions[i].label = v))} />
              <NumberField label="Поправка" unit="п.п." step={0.1} value={o.deltaPct} onChange={(v) => edit((d) => void (d.rateOptions[i].deltaPct = v))} />
              <TextField
                label="Группа"
                mono
                value={o.group}
                placeholder="например, client"
                hint="Пусто — вариант сам по себе"
                onChange={(v) => edit((d) => void (d.rateOptions[i].group = optional(v.trim())))}
              />
            </div>
            <fieldset className="admin-checks">
              <legend className="field-label">Действует для программ (ни одной — для всех)</legend>
              {(Object.keys(PROGRAMS) as LoanProgram[]).map((p) => (
                <label key={p}>
                  <input
                    type="checkbox"
                    checked={o.programs?.includes(p) ?? false}
                    onChange={(e) =>
                      edit((d) => {
                        const on = new Set(d.rateOptions[i].programs ?? []);
                        if (e.target.checked) on.add(p);
                        else on.delete(p);
                        d.rateOptions[i].programs = on.size ? (Object.keys(PROGRAMS) as LoanProgram[]).filter((x) => on.has(x)) : undefined;
                      })
                    }
                  />{" "}
                  {PROGRAMS[p]}
                </label>
              ))}
            </fieldset>
            <TextField label="Подсказка" value={o.hint} onChange={(v) => edit((d) => void (d.rateOptions[i].hint = optional(v)))} />
            <button
              type="button"
              className="admin-remove"
              title="Удалить вариант"
              aria-label={`Удалить вариант ${o.label}`}
              onClick={() => edit((d) => void d.rateOptions.splice(i, 1))}
            >
              ×
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              edit((d) => void d.rateOptions.push({ id: newId("option"), label: "Новая скидка", deltaPct: -0.1, programs: ["market"] }))
            }
          >
            + Скидка или надбавка
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Расходы на сделку</h2>
        <p className="scenario-description">
          Галочки в блоке «Нужно сразу». «Отмечено по умолчанию» — с чем симулятор открывается у нового посетителя.
        </p>
        {draft.dealCosts.map((c, i) => (
          <div key={i} className="admin-param">
            <div className="admin-grid">
              <TextField label="Подпись" value={c.label} hint={<code>{c.id}</code>} onChange={(v) => edit((d) => void (d.dealCosts[i].label = v))} />
              <NumberField label="Сумма" unit="₽" min={0} value={c.amount} onChange={(v) => edit((d) => void (d.dealCosts[i].amount = v))} />
            </div>
            <label className="admin-checks">
              <input type="checkbox" checked={c.default} onChange={(e) => edit((d) => void (d.dealCosts[i].default = e.target.checked))} /> Отмечено по
              умолчанию
            </label>
            <TextField label="Подсказка" value={c.hint} onChange={(v) => edit((d) => void (d.dealCosts[i].hint = optional(v)))} />
            <button
              type="button"
              className="admin-remove"
              title="Удалить расход"
              aria-label={`Удалить расход ${c.label}`}
              onClick={() => edit((d) => void d.dealCosts.splice(i, 1))}
            >
              ×
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => edit((d) => void d.dealCosts.push({ id: newId("cost"), label: "Новый расход", amount: 0, default: false }))}
          >
            + Расход
          </button>
        </div>
      </section>
    </div>
  );
}
