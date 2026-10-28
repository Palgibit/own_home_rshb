// Сценарии симулятора: описание, параметры, формулы эффектов.
// Каждая формула проверяется и считается на тестовом кредите прямо при вводе;
// ниже — «было → стало» для всего сценария, как его покажет симулятор.

import { useState } from "react";
import { Link } from "react-router-dom";
import { EFFECTS, type EffectKey } from "../../core/scenarios";
import { PROGRAMS, type AppConfig, type LoanProgram, type ParamDef, type ScenarioDef } from "../../config/schema";
import { NumberField } from "../../ui/NumberField";
import { formatMonths, formatNumber, formatPct, formatRub } from "../../ui/format";
import { optional, SelectField, TextField } from "./fields";
import { FUNCTIONS_LIST, previewFormula, previewScenario, testCase, testVariables } from "./preview";
import type { Edit } from "./AdminPage";

// Маленькие числа (месячная ставка 0,0025) показываем с нужной точностью, а не как «0»
const formatTest = (v: number) => (v !== 0 && Math.abs(v) < 0.01 ? v.toPrecision(3).replace(".", ",") : formatNumber(v));

const NEW_PARAM: ParamDef = { id: "x", label: "Новый параметр", unit: "₽", min: 0, max: 1000000, step: 1000, default: 100000 };

function newScenario(existing: ScenarioDef[]): ScenarioDef {
  let n = 1;
  while (existing.some((s) => s.id === `new-scenario-${n}`)) n++;
  return {
    id: `new-scenario-${n}`,
    title: "Новый сценарий",
    description: "Опишите, что происходит в этом сценарии.",
    params: [structuredClone(NEW_PARAM)],
    effects: {},
  };
}

// Копия сценария: уникальный id «…-copy», «…-copy-2» и название «… (копия)»
export function copyScenario(s: ScenarioDef, existing: ScenarioDef[]): ScenarioDef {
  let id = `${s.id}-copy`;
  for (let n = 2; existing.some((x) => x.id === id); n++) id = `${s.id}-copy-${n}`;
  return { ...structuredClone(s), id, title: `${s.title} (копия)` };
}

export function ScenariosTab({ draft, edit }: { draft: AppConfig; edit: Edit }) {
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState<EffectKey>("earlyAmount"); // куда вставлять переменную по клику
  const scenarios = draft.scenarios;
  const s = scenarios[Math.min(index, scenarios.length - 1)];
  const current = Math.min(index, scenarios.length - 1);
  // Правка выбранного сценария в черновике
  const set = (fn: (s: ScenarioDef) => void) => edit((d) => fn(d.scenarios[current]));

  const add = (scenario: ScenarioDef) => {
    edit((d) => void d.scenarios.push(scenario));
    setIndex(scenarios.length);
  };

  return (
    <div className="admin-columns">
      <aside className="panel admin-list">
        <h2 className="panel-title">Сценарии</h2>
        <div className="admin-list-items">
          {scenarios.map((x, i) => (
            <button key={i} type="button" className={`scenario-chip${i === current ? " is-active" : ""}`} onClick={() => setIndex(i)}>
              {x.title || x.id}
            </button>
          ))}
        </div>
        <button type="button" className="button button-secondary" onClick={() => add(newScenario(scenarios))}>
          + Новый сценарий
        </button>
      </aside>

      {s ? (
        <div className="admin-stack">
          <section className="panel">
            <div className="admin-head">
              <h2 className="panel-title">{s.title || "Без названия"}</h2>
              <button
                type="button"
                className="admin-link-button"
                title="Новый сценарий на основе этого: параметры и формулы скопируются"
                onClick={() => add(copyScenario(s, scenarios))}
              >
                Копировать сценарий
              </button>
              <button
                type="button"
                className="admin-link-button is-danger"
                disabled={scenarios.length < 2}
                onClick={() => {
                  if (!window.confirm(`Удалить сценарий «${s.title}»?`)) return;
                  edit((d) => void d.scenarios.splice(current, 1));
                  setIndex(Math.max(0, current - 1));
                }}
              >
                Удалить сценарий
              </button>
            </div>
            <div className="admin-grid">
              <TextField label="Название" value={s.title} onChange={(v) => set((x) => void (x.title = v))} />
              <TextField
                label="id (для ссылки)"
                mono
                value={s.id}
                onChange={(v) => set((x) => void (x.id = v.trim()))}
                hint={<>Ссылка: <code>#/simulator?scenario={s.id}</code></>}
              />
              <SelectField<"" | LoanProgram>
                label="Для какой ипотеки"
                value={s.onlyFor ?? ""}
                options={[["", "Для любой"], ...(Object.entries(PROGRAMS) as [LoanProgram, string][])]}
                onChange={(v) => set((x) => void (x.onlyFor = v || undefined))}
              />
            </div>
            <TextField label="Описание" rows={2} value={s.description} onChange={(v) => set((x) => void (x.description = v))} />
            <TextField label="Подсказка под параметрами" rows={2} value={s.hint} onChange={(v) => set((x) => void (x.hint = optional(v)))} />
          </section>

          <ParamsEditor scenario={s} set={set} />

          <section className="panel">
            <h2 className="panel-title">Формулы</h2>
            <p className="scenario-description">
              Сценарий — это набор эффектов. Заполните только нужные, остальные оставьте пустыми. Результат под
              формулой посчитан на тестовом кредите и значениях параметров по умолчанию.
            </p>
            <div className="admin-effects">
              {(Object.keys(EFFECTS) as EffectKey[]).map((key) => (
                <EffectRow
                  key={key}
                  label={EFFECTS[key]}
                  expression={s.effects[key] ?? ""}
                  preview={s.effects[key]?.trim() ? previewFormula(s.effects[key]!, draft, s) : null}
                  onFocus={() => setFocused(key)}
                  onChange={(v) =>
                    set((x) => {
                      if (v.trim()) x.effects[key] = v;
                      else delete x.effects[key];
                    })
                  }
                />
              ))}
            </div>
            <Variables
              draft={draft}
              scenario={s}
              target={EFFECTS[focused]}
              onInsert={(name) =>
                set((x) => {
                  const cur = x.effects[focused] ?? "";
                  x.effects[focused] = cur && !/[\s(]$/.test(cur) ? `${cur} ${name}` : cur + name;
                })
              }
            />
          </section>

          <ScenarioPreview draft={draft} scenario={s} />
        </div>
      ) : (
        <p className="note">Сценариев нет — добавьте первый.</p>
      )}
    </div>
  );
}

function ParamsEditor({ scenario, set }: { scenario: ScenarioDef; set: (fn: (s: ScenarioDef) => void) => void }) {
  const setParam = (i: number, patch: Partial<ParamDef>) => set((x) => Object.assign(x.params[i], patch));
  return (
    <section className="panel">
      <h2 className="panel-title">Параметры сценария</h2>
      <p className="scenario-description">
        Пользователь задаёт их ползунком или галочкой в симуляторе. Имя параметра — переменная в формулах; у
        галочки она равна 1 (включено) или 0 — например, <code>toLoan ? X : 0</code>.
      </p>
      {scenario.params.map((p, i) => (
        <div key={i} className="admin-param">
          <div className="admin-grid">
            <TextField label="Имя в формулах" mono value={p.id} onChange={(v) => setParam(i, { id: v.trim() })} />
            <TextField label="Подпись" value={p.label} onChange={(v) => setParam(i, { label: v })} />
            <SelectField<"number" | "toggle">
              label="Тип"
              value={p.kind ?? "number"}
              options={[
                ["number", "Число (ползунок)"],
                ["toggle", "Галочка (0 или 1)"],
              ]}
              onChange={(v) =>
                setParam(i, v === "toggle" ? { kind: "toggle", default: 0, min: undefined, max: undefined, step: undefined, unit: undefined } : { ...NEW_PARAM, id: p.id, label: p.label, kind: undefined })
              }
            />
            {p.kind === "toggle" ? (
              <SelectField<"0" | "1">
                label="По умолчанию"
                value={p.default === 1 ? "1" : "0"}
                options={[
                  ["0", "Выключена"],
                  ["1", "Включена"],
                ]}
                onChange={(v) => setParam(i, { default: Number(v) })}
              />
            ) : (
              <>
                <TextField label="Единица" value={p.unit} onChange={(v) => setParam(i, { unit: optional(v) })} />
                <NumberField label="По умолчанию" value={p.default} onChange={(v) => setParam(i, { default: v })} />
                <NumberField label="Минимум" value={p.min ?? 0} onChange={(v) => setParam(i, { min: v })} />
                <NumberField label="Максимум" value={p.max ?? 0} onChange={(v) => setParam(i, { max: v })} />
                <NumberField label="Шаг" value={p.step ?? 1} onChange={(v) => setParam(i, { step: v })} />
              </>
            )}
          </div>
          <TextField label="Подсказка" value={p.hint} onChange={(v) => setParam(i, { hint: optional(v) })} />
          <button
            type="button"
            className="admin-remove"
            title="Удалить параметр"
            aria-label={`Удалить параметр ${p.label}`}
            onClick={() => set((x) => void x.params.splice(i, 1))}
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
            set((x) => {
              let n = 1;
              while (x.params.some((p) => p.id === `x${n}`)) n++;
              x.params.push({ ...NEW_PARAM, id: `x${n}` });
            })
          }
        >
          + Параметр
        </button>
      </div>
    </section>
  );
}

type EffectRowProps = {
  label: string;
  expression: string;
  preview: ReturnType<typeof previewFormula> | null;
  onFocus: () => void;
  onChange: (v: string) => void;
};

function EffectRow({ label, expression, preview, onFocus, onChange }: EffectRowProps) {
  return (
    <div className={`admin-effect${expression.trim() ? " is-used" : ""}`}>
      <label className="field-label">
        {label}
        <input
          className="admin-input is-mono"
          value={expression}
          placeholder="не используется"
          spellCheck={false}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <p className={`admin-status${preview ? (preview.ok ? " is-good" : " is-bad") : ""}`}>
        {!preview ? "—" : preview.ok ? `= ${formatTest(preview.value)}` : preview.error}
      </p>
    </div>
  );
}

type VariablesProps = { draft: AppConfig; scenario: ScenarioDef; target: string; onInsert: (name: string) => void };

// Справочник переменных с тестовыми значениями; клик вставляет имя в формулу
function Variables({ draft, scenario, target, onInsert }: VariablesProps) {
  const vars = testVariables(draft, scenario);
  const groups = [
    ["scenario", "Параметры сценария"],
    ["base", "Базовый кредит"],
    ["global", "Глобальные параметры"],
  ] as const;
  return (
    <details className="admin-vars" open>
      <summary>Переменные и функции — клик вставит в «{target}»</summary>
      {groups.map(([source, title]) => (
        <div key={source}>
          <p className="admin-vars-title">{title}</p>
          <div className="admin-vars-list">
            {vars
              .filter((v) => v.source === source)
              .map((v) => (
                <button key={v.name} type="button" className="admin-var" title={v.label} onClick={() => onInsert(v.name)}>
                  <code>{v.name}</code> <span>{v.label}</span> <b>{formatTest(v.value)}</b>
                </button>
              ))}
          </div>
        </div>
      ))}
      <p className="admin-vars-title">Функции</p>
      <div className="admin-vars-list">
        {FUNCTIONS_LIST.map((f) => (
          <button key={f.name} type="button" className="admin-var" onClick={() => onInsert(`${f.name}(`)}>
            <span>{f.hint}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

function ScenarioPreview({ draft, scenario }: { draft: AppConfig; scenario: ScenarioDef }) {
  const preview = previewScenario(draft, scenario);
  const { loan, household } = testCase(draft, scenario);
  return (
    <section className="panel">
      <h2 className="panel-title">Предпросмотр: было → стало</h2>
      <p className="scenario-description">
        Тестовый кредит: {formatRub(loan.principal)} под {formatPct(loan.ratePct)} на {formatMonths(loan.months)}, доход{" "}
        {formatRub(household.income)}, расходы {formatRub(household.expenses)} в месяц. Его меняют стартовые значения
        симулятора на вкладке «Параметры».
      </p>
      {"error" in preview ? (
        <p className="admin-status is-bad">Сценарий не считается: {preview.error}</p>
      ) : (
        <table className="compare-table">
          <thead>
            <tr>
              <th>Метрика</th>
              <th>Было</th>
              <th>Стало</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Платёж", "payment", formatRub],
                ["Срок", "months", formatMonths],
                ["Переплата", "overpayment", formatRub],
                ["Свободный бюджет", "budget", formatRub],
                ["Долговая нагрузка", "pdn", formatPct],
              ] as const
            ).map(([title, key, fmt]) => {
              const before = preview.result.before[key].value;
              const after = preview.result.after[key].value;
              return (
                <tr key={key} className={Math.abs(after - before) > 0.5 ? "admin-changed" : undefined}>
                  <th>{title}</th>
                  <td>{fmt(before)}</td>
                  <td>{fmt(after)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="field-hint">
        В симуляторе сценарий появится после сохранения:{" "}
        <Link className="text-link" to={`/simulator?scenario=${scenario.id}`}>
          открыть в симуляторе →
        </Link>
      </p>
    </section>
  );
}
