// Навигатор в панели администратора.
// Шаги — формой: их правят чаще всего, а вложенные условия в JSON — главный
// источник ошибок. Вопросы, этапы, запреты и типовые сценарии меняются редко
// и связаны с логикой — они в «Расширенных настройках» через JSON.
// Ниже — матрица «шаг × сценарий» по черновику. Ошибки ссылок (этап, вопрос,
// сценарий, {параметр}) ловит validateConfig и показывает внизу.

import { useMemo, useState } from "react";
import {
  activeAnswers,
  buildMatrix,
  buildRoute,
  resolveStep,
  type Condition,
  type NavigatorDef,
  type StepDef,
  type StepLink,
  type StepVariant,
} from "../../core/navigator";
import type { AppConfig } from "../../config/schema";
import { NumberField } from "../../ui/NumberField";
import { plural } from "../../ui/format";
import { JsonEditor, SelectField, TextField } from "./fields";
import { MatrixView } from "./MatrixView";
import type { Edit } from "./AdminPage";

const count = (list: unknown) => (Array.isArray(list) ? list.length : "—");

// Матрицу и предпросмотр строим, только если структура навигатора цела:
// пока в JSON ошибка, ядро может упасть на битых данных
function canBuild(nav: NavigatorDef): boolean {
  try {
    buildMatrix(nav);
    return nav.questions.every((q) => Array.isArray(q.options));
  } catch {
    return false;
  }
}

function newStep(nav: NavigatorDef, stage: string): StepDef {
  let n = 1;
  while (nav.steps.some((s) => s.id === `new-step-${n}`)) n++;
  return { id: `new-step-${n}`, stage, title: "Новый шаг", recommendation: "Что сделать и зачем — коротко." };
}

export function NavigatorTab({ draft, edit }: { draft: AppConfig; edit: Edit }) {
  const nav = draft.navigator;
  const [index, setIndex] = useState(0);
  const ok = useMemo(() => canBuild(nav), [nav]);

  // Вопросы, этапы, запреты и типовые сценарии — одним JSON. Объект пересобираем
  // только при их изменении, чтобы редактор не сбрасывал текст на каждой правке шага
  const advanced = useMemo(
    () => ({ questions: nav?.questions, stages: nav?.stages, conflicts: nav?.conflicts, presets: nav?.presets }),
    [nav?.questions, nav?.stages, nav?.conflicts, nav?.presets],
  );

  const steps = Array.isArray(nav?.steps) ? nav.steps : [];
  const current = Math.min(index, steps.length - 1);
  const step = steps[current];

  return (
    <div className="admin-stack">
      <section className="panel">
        <h2 className="panel-title">Навигатор «Путь к своему дому»</h2>
        <div className="admin-counts">
          <span><b>{count(nav?.questions)}</b> вопросов</span>
          <span><b>{count(nav?.stages)}</b> этапов</span>
          <span><b>{count(nav?.steps)}</b> шагов</span>
          <span><b>{count(nav?.conflicts)}</b> запретов</span>
          <span><b>{count(nav?.presets)}</b> типовых сценариев</span>
        </div>
        <p className="scenario-description">
          Маршрут клиента собирается из шагов: шаг показывается, если ответы подходят под его условия. Ниже можно
          добавить шаг, поменять текст или условия и сразу увидеть, в каких сценариях он появится.
        </p>
      </section>

      {ok ? (
        <div className="admin-columns">
          <StepList
            nav={nav}
            current={current}
            onSelect={setIndex}
            onAdd={() => {
              edit((d) => void d.navigator.steps.push(newStep(d.navigator, step?.stage ?? d.navigator.stages[0]?.id ?? "")));
              setIndex(steps.length);
            }}
          />
          {step ? (
            <StepEditor
              key={current}
              nav={nav}
              draft={draft}
              step={step}
              set={(fn) => edit((d) => fn(d.navigator.steps[current]))}
              onRemove={() => {
                if (!window.confirm(`Удалить шаг «${step.title}»?`)) return;
                edit((d) => void d.navigator.steps.splice(current, 1));
                setIndex(Math.max(0, current - 1));
              }}
            />
          ) : (
            <p className="note">Шагов нет — добавьте первый.</p>
          )}
        </div>
      ) : (
        <p className="note note-warn">
          В расширенных настройках нарушена структура навигатора — форма шагов и матрица появятся, когда ошибка будет
          исправлена.
        </p>
      )}

      <details className="admin-vars admin-advanced">
        <summary>Расширенные настройки: вопросы, этапы, запреты, типовые сценарии (JSON)</summary>
        <pre className="admin-pre">{`questions — вопросы: { id, title, hint?, showIf?, options: [{ id, label, hint? }] }
stages    — этапы по порядку: { id, title }
conflicts — запреты: { when: { вопрос: [варианты] }, message } — такие ответы нельзя выбрать вместе
presets   — типовые сценарии: { id, title, answers: { вопрос: вариант } } — карточки над маршрутом и столбцы матрицы`}</pre>
        <JsonEditor
          label="navigator (без шагов)"
          rows={28}
          value={advanced}
          onChange={(v: Partial<NavigatorDef>) =>
            edit((d) => {
              d.navigator.questions = v.questions as NavigatorDef["questions"];
              d.navigator.stages = v.stages as NavigatorDef["stages"];
              d.navigator.conflicts = v.conflicts as NavigatorDef["conflicts"];
              d.navigator.presets = v.presets as NavigatorDef["presets"];
            })
          }
        />
      </details>

      {ok && <MatrixView nav={nav} />}
    </div>
  );
}

// ── Список шагов, сгруппированный по этапам ──────────────────────

type StepListProps = { nav: NavigatorDef; current: number; onSelect: (i: number) => void; onAdd: () => void };

function StepList({ nav, current, onSelect, onAdd }: StepListProps) {
  const stageIds = new Set(nav.stages.map((s) => s.id));
  // Шаг с несуществующим этапом тоже должен быть виден — иначе его не исправить
  const groups = [
    ...nav.stages.map((s) => ({ id: s.id, title: s.title })),
    { id: "", title: "Без этапа" },
  ].map((g) => ({
    ...g,
    items: nav.steps
      .map((step, i) => ({ step, i }))
      .filter(({ step }) => (g.id ? step.stage === g.id : !stageIds.has(step.stage))),
  }));

  return (
    <aside className="panel admin-list">
      <h2 className="panel-title">Шаги</h2>
      <div className="admin-step-list">
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.id || "none"}>
              <p className="admin-vars-title">{g.title}</p>
              {g.items.map(({ step, i }) => (
                <button
                  key={i}
                  type="button"
                  className={`admin-step-item${i === current ? " is-active" : ""}`}
                  onClick={() => onSelect(i)}
                >
                  {step.title || step.id}
                </button>
              ))}
            </div>
          ))}
      </div>
      <button type="button" className="button button-secondary" onClick={onAdd}>
        + Новый шаг
      </button>
    </aside>
  );
}

// ── Карточка шага ────────────────────────────────────────────────

type StepEditorProps = {
  nav: NavigatorDef;
  draft: AppConfig;
  step: StepDef;
  set: (fn: (s: StepDef) => void) => void;
  onRemove: () => void;
};

function StepEditor({ nav, draft, step, set, onRemove }: StepEditorProps) {
  const paramsHint = "Можно подставлять глобальные параметры в фигурных скобках: {ruralRate}, {buildDeadlineMonths}…";

  return (
    <div className="admin-stack">
      <section className="panel">
        <div className="admin-head">
          <h2 className="panel-title">{step.title || "Без названия"}</h2>
          <button type="button" className="admin-link-button is-danger" onClick={onRemove}>
            Удалить шаг
          </button>
        </div>
        <div className="admin-grid">
          <TextField label="Название" value={step.title} onChange={(v) => set((x) => void (x.title = v))} />
          <TextField
            label="id"
            mono
            value={step.id}
            hint="Латиницей, уникальный. По нему запоминаются отметки «сделано»."
            onChange={(v) => set((x) => void (x.id = v.trim()))}
          />
          <SelectField
            label="Этап"
            value={step.stage}
            options={nav.stages.map((s) => [s.id, s.title])}
            onChange={(v) => set((x) => void (x.stage = v))}
          />
        </div>
        <TextField
          label="Рекомендация"
          rows={4}
          value={step.recommendation}
          hint={paramsHint}
          onChange={(v) => set((x) => void (x.recommendation = v))}
        />
      </section>

      <section className="panel">
        <h2 className="panel-title">Когда показывать</h2>
        <p className="scenario-description">
          Отметьте подходящие ответы. Если у вопроса ничего не отмечено — ответ на него не важен. Шаг показывается,
          когда подходят все отмеченные вопросы.
        </p>
        <ConditionEditor
          nav={nav}
          value={step.showIf}
          onChange={(c) =>
            set((x) => {
              if (c) x.showIf = c;
              else delete x.showIf;
            })
          }
        />
      </section>

      <section className="panel">
        <h2 className="panel-title">Особые тексты</h2>
        <p className="scenario-description">
          Для части сценариев рекомендация может быть другой — например, для сельской ипотеки. Срабатывает первый
          подходящий текст сверху; если ни один не подошёл — обычная рекомендация.
        </p>
        {(step.variants ?? []).map((v, i) => (
          <div key={i} className="admin-param">
            <ConditionEditor
              nav={nav}
              value={v.when}
              onChange={(c) => set((x) => void (x.variants![i].when = c ?? {}))}
            />
            <TextField label="Текст вместо рекомендации" rows={3} value={v.text} hint={paramsHint} onChange={(t) => set((x) => void (x.variants![i].text = t))} />
            <CalcLinkEditor
              draft={draft}
              label="Ссылка в расчёт для этого текста"
              emptyLabel="Как у шага"
              value={v.calcLink}
              onChange={(link) =>
                set((x) => {
                  const variant: StepVariant = x.variants![i];
                  if (link) variant.calcLink = link;
                  else delete variant.calcLink;
                })
              }
            />
            <button
              type="button"
              className="admin-remove"
              title="Удалить особый текст"
              aria-label={`Удалить особый текст №${i + 1}`}
              onClick={() =>
                set((x) => {
                  x.variants!.splice(i, 1);
                  if (!x.variants!.length) delete x.variants;
                })
              }
            >
              ×
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => set((x) => void (x.variants = [...(x.variants ?? []), { when: {}, text: x.recommendation }]))}
          >
            + Особый текст
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Ссылки</h2>
        <fieldset className="admin-checks">
          <legend className="field-label">Сервисы экосистемы</legend>
          {draft.services.map((s) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={(step.services ?? []).includes(s.id)}
                onChange={(e) =>
                  set((x) => {
                    // Порядок — как в списке сервисов
                    const on = new Set(x.services ?? []);
                    if (e.target.checked) on.add(s.id);
                    else on.delete(s.id);
                    const list = draft.services.map((d) => d.id).filter((id) => on.has(id));
                    if (list.length) x.services = list;
                    else delete x.services;
                  })
                }
              />{" "}
              {s.title}
            </label>
          ))}
        </fieldset>
        <CalcLinkEditor
          draft={draft}
          label="Ссылка в расчёт"
          emptyLabel="Без ссылки"
          value={step.calcLink}
          onChange={(link) =>
            set((x) => {
              if (link) x.calcLink = link;
              else delete x.calcLink;
            })
          }
        />
      </section>

      <section className="panel">
        <h2 className="panel-title">Срок, расходы, документы</h2>
        <p className="scenario-description">
          Из них навигатор собирает сводку «≈ N мес на весь путь, ≈ M ₽ расходов» и общий список документов.
        </p>
        <div className="admin-grid">
          <NumberField
            label="Срок шага: от"
            unit="дн"
            min={0}
            value={step.days?.[0] ?? 0}
            onChange={(v) => set((x) => setDays(x, v, x.days?.[1] ?? v))}
          />
          <NumberField
            label="до"
            unit="дн"
            min={0}
            value={step.days?.[1] ?? 0}
            onChange={(v) => set((x) => setDays(x, x.days?.[0] ?? 0, v))}
          />
        </div>
        <fieldset className="admin-checks">
          <legend className="field-label">Расходы на сделку (суммы — на вкладке «Ставка и расходы»)</legend>
          {draft.dealCosts.map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={(step.costs ?? []).includes(c.id)}
                onChange={(e) =>
                  set((x) => {
                    const on = new Set(x.costs ?? []);
                    if (e.target.checked) on.add(c.id);
                    else on.delete(c.id);
                    const list = draft.dealCosts.map((d) => d.id).filter((id) => on.has(id));
                    if (list.length) x.costs = list;
                    else delete x.costs;
                  })
                }
              />{" "}
              {c.label}
            </label>
          ))}
        </fieldset>
        <TextField
          label="Что подготовить — по документу в строке"
          rows={4}
          value={(step.docs ?? []).join("\n")}
          onChange={(v) =>
            set((x) => {
              // Пустые строки при вводе не сохраняем, чтобы проверка конфига не ругалась на каждый Enter
              const list = v.split("\n").filter((d, i, all) => d.trim() || i === all.length - 1);
              if (list.some((d) => d.trim())) x.docs = list;
              else delete x.docs;
            })
          }
        />
      </section>

      <StepPreview nav={nav} step={step} />
    </div>
  );
}

// Срок шага: оба нуля — срока нет
function setDays(step: StepDef, min: number, max: number) {
  if (min === 0 && max === 0) delete step.days;
  else step.days = [min, max];
}

// ── Условие: по каждому вопросу — галочки вариантов ──────────────

function ConditionEditor({ nav, value, onChange }: { nav: NavigatorDef; value: Condition | undefined; onChange: (c: Condition | undefined) => void }) {
  const toggle = (q: string, o: string, on: boolean) => {
    const next: Condition = structuredClone(value ?? {});
    const list = new Set(next[q] ?? []);
    if (on) list.add(o);
    else list.delete(o);
    // Порядок — как у вариантов вопроса
    const ordered = (nav.questions.find((x) => x.id === q)?.options ?? []).map((x) => x.id).filter((id) => list.has(id));
    if (ordered.length) next[q] = ordered;
    else delete next[q];
    onChange(Object.keys(next).length ? next : undefined);
  };

  return (
    <div className="admin-condition">
      {nav.questions.map((q) => (
        <fieldset key={q.id} className="admin-checks">
          <legend className="field-label">{q.title}</legend>
          {q.options.map((o) => (
            <label key={o.id}>
              <input
                type="checkbox"
                checked={(value?.[q.id] ?? []).includes(o.id)}
                onChange={(e) => toggle(q.id, o.id, e.target.checked)}
              />{" "}
              {o.label}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

// ── Ссылка в расчёт: подпись + куда ведёт ────────────────────────

type CalcLinkProps = {
  draft: AppConfig;
  label: string;
  emptyLabel: string;
  value: StepLink | undefined;
  onChange: (link: StepLink | undefined) => void;
};

function CalcLinkEditor({ draft, label, emptyLabel, value, onChange }: CalcLinkProps) {
  const targets: [string, string][] = [
    ["", emptyLabel],
    ["/simulator", "Симулятор"],
    ...draft.scenarios.map((s): [string, string] => [`/simulator?scenario=${s.id}`, `Симулятор: ${s.title}`]),
    ["/after", "Жизнь после ипотеки"],
  ];
  // Адрес, которого нет в списке (задан вручную в JSON), тоже показываем
  if (value?.to && !targets.some(([to]) => to === value.to)) targets.push([value.to, value.to]);

  return (
    <div className="admin-grid">
      <SelectField
        label={label}
        value={value?.to ?? ""}
        options={targets}
        onChange={(to) => onChange(to ? { label: value?.label || "Посчитать", to } : undefined)}
      />
      {value && <TextField label="Подпись ссылки" value={value.label} onChange={(t) => onChange({ ...value, label: t })} />}
    </div>
  );
}

// ── Предпросмотр: в каких типовых сценариях шаг появится ─────────

function StepPreview({ nav, step }: { nav: NavigatorDef; step: StepDef }) {
  // Считает то же ядро, что и маршрут клиента
  const rows = nav.presets.map((p) => ({ preset: p, route: resolveStep(step, activeAnswers(nav, p.answers)) }));
  const shown = rows.filter((r) => r.route);
  const total = useMemo(() => nav.presets.map((p) => buildRoute(nav, p.answers).length), [nav]);

  return (
    <section className="panel">
      <h2 className="panel-title">Предпросмотр</h2>
      <p className="big-answer">
        Шаг показывается в {shown.length} из {nav.presets.length} типовых сценариев
      </p>
      <ul className="admin-preview-list">
        {rows.map(({ preset, route }, i) => (
          <li key={preset.id} className={route ? "is-shown" : undefined}>
            <span aria-hidden="true">{route ? (route.special ? "◆" : "●") : "·"}</span> {preset.title}
            {route?.special && <em> — особый текст</em>}
            <small>
              {" "}
              ({total[i]} {plural(total[i], ["шаг", "шага", "шагов"])} в маршруте)
            </small>
          </li>
        ))}
      </ul>
      <p className="field-hint">Изменения видны клиенту после сохранения.</p>
    </section>
  );
}
