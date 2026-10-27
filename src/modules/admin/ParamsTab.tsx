// Глобальные параметры (ставки, лимиты, цены, пороги ПДН) и стартовые значения симулятора.
// Параметр доступен во всех формулах по id и в текстах как {id}.

import { useState } from "react";
import {
  PROGRAMS,
  type AppConfig,
  type GlobalParam,
  type LoanProgram,
  type PlanItem,
  type SimulatorDefaults,
} from "../../config/schema";
import { NumberField } from "../../ui/NumberField";
import { JsonEditor, optional, SelectField, TextField } from "./fields";
import type { Edit } from "./AdminPage";

const SIM_LABELS: Record<Exclude<keyof SimulatorDefaults, "program" | "planExample">, [string, string?]> = {
  price: ["Стоимость жилья", "₽"],
  downPayment: ["Первоначальный взнос", "₽"],
  years: ["Срок", "лет"],
  income: ["Доход семьи", "₽/мес"],
  expenses: ["Обязательные расходы", "₽/мес"],
  compareAmount: ["«Досрочка или вклад»: сумма", "₽"],
  compareMonth: ["… через сколько месяцев", "мес"],
  compareHorizonMonths: ["… горизонт сравнения", "мес"],
  coffeeExtra: ["«Чашка кофе»: доплата", "₽/мес"],
  coffeeMax: ["… максимум ползунка", "₽/мес"],
  ownFunds: ["«Город или село»: свои средства", "₽"],
  familySize: ["… человек в семье"],
};

export function ParamsTab({ draft, edit }: { draft: AppConfig; edit: Edit }) {
  const groups = [...new Set(draft.params.map((p) => p.group))];
  // По индексу, а не по id: пока админ печатает, id может временно совпасть с другим
  const setParam = (index: number, patch: Partial<GlobalParam>) => edit((d) => Object.assign(d.params[index], patch));

  return (
    <div className="admin-stack">
      <p className="note">
        Значения сразу участвуют в расчётах всех трёх модулей. В формулах параметр пишется по имени (<code>ruralRate</code>),
        в текстах навигатора и модуля 3 — в фигурных скобках (<code>{"{ruralRate}"}</code>).
      </p>

      {groups.map((group) => (
        <section key={group} className="panel">
          <h2 className="panel-title">{group}</h2>
          {draft.params.map(
            (p, index) =>
              p.group === group && (
              <div key={index} className="admin-param">
                <div className="admin-param-main">
                  <TextField label="Название" value={p.label} onChange={(v) => setParam(index, { label: v })} hint={<code>{p.id}</code>} />
                  <NumberField label="Значение" unit={p.unit} value={p.value} onChange={(v) => setParam(index, { value: v })} />
                  <TextField label="Единица" value={p.unit} onChange={(v) => setParam(index, { unit: optional(v) })} />
                  <TextField label="Подсказка" value={p.hint} onChange={(v) => setParam(index, { hint: optional(v) })} />
                </div>
                <button
                  type="button"
                  className="admin-remove"
                  aria-label={`Удалить параметр ${p.label}`}
                  title="Удалить параметр"
                  onClick={() => edit((d) => void (d.params.splice(index, 1)))}
                >
                  ×
                </button>
              </div>
              ),
          )}
        </section>
      ))}

      <NewParam groups={groups} onAdd={(p) => edit((d) => void d.params.push(p))} />

      <section className="panel">
        <h2 className="panel-title">Стартовые значения симулятора</h2>
        <p className="scenario-description">
          С ними симулятор открывается у нового посетителя. На них же админка считает предпросмотр формул.
        </p>
        <div className="admin-grid">
          <SelectField<LoanProgram>
            label="Программа"
            value={draft.simulator.program}
            options={Object.entries(PROGRAMS) as [LoanProgram, string][]}
            onChange={(v) => edit((d) => void (d.simulator.program = v))}
          />
          {(Object.keys(SIM_LABELS) as (keyof typeof SIM_LABELS)[]).map((key) => (
            <NumberField
              key={key}
              label={SIM_LABELS[key][0]}
              unit={SIM_LABELS[key][1]}
              min={0}
              value={draft.simulator[key]}
              onChange={(v) => edit((d) => void (d.simulator[key] = v))}
            />
          ))}
        </div>
        <JsonEditor
          label="Стартовый план досрочных платежей"
          rows={8}
          value={draft.simulator.planExample}
          hint="kind: once — разовый, monthly — каждый месяц, yearly — каждый год; fromMonth — с какого месяца; amount — сумма, ₽; mode: term — сократить срок, payment — уменьшить платёж."
          onChange={(v: PlanItem[]) => edit((d) => void (d.simulator.planExample = v))}
        />
      </section>
    </div>
  );
}

function NewParam({ groups, onAdd }: { groups: string[]; onAdd: (p: GlobalParam) => void }) {
  const empty: GlobalParam = { id: "", label: "", group: groups[0] ?? "", value: 0 };
  const [p, setP] = useState<GlobalParam>(empty);
  const set = (patch: Partial<GlobalParam>) => setP((cur) => ({ ...cur, ...patch }));

  return (
    <section className="panel">
      <h2 className="panel-title">Новый параметр</h2>
      <div className="admin-grid">
        <TextField label="Имя в формулах (латиницей)" mono value={p.id} placeholder="matCapital" onChange={(v) => set({ id: v.trim() })} />
        <TextField label="Название" value={p.label} placeholder="Материнский капитал" onChange={(v) => set({ label: v })} />
        <TextField label="Группа" value={p.group} onChange={(v) => set({ group: v })} hint={`Есть: ${groups.join(", ")}`} />
        <TextField label="Единица" value={p.unit} placeholder="₽" onChange={(v) => set({ unit: optional(v) })} />
        <NumberField label="Значение" value={p.value} onChange={(v) => set({ value: v })} />
      </div>
      <div>
        <button
          type="button"
          className="button button-secondary"
          disabled={!p.id || !p.label || !p.group}
          onClick={() => {
            onAdd(p);
            setP(empty);
          }}
        >
          Добавить параметр
        </button>
      </div>
    </section>
  );
}
