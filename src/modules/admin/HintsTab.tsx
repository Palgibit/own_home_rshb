// Подсказки «откуда это число»: текст формулы и пояснение простым языком.
// Ядро ссылается на них по formulaId, поэтому их можно переписать без кода.

import { useState } from "react";
import type { AppConfig } from "../../config/schema";
import { TextField } from "./fields";
import type { Edit } from "./AdminPage";

export function HintsTab({ draft, edit }: { draft: AppConfig; edit: Edit }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = draft.formulas
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => !q || `${f.id} ${f.title} ${f.formula} ${f.hint}`.toLowerCase().includes(q));

  return (
    <div className="admin-stack">
      <p className="note">
        Эти тексты открываются по клику на любое подчёркнутое число в симуляторе, навигаторе и модуле «Жизнь после
        ипотеки». Для формул сценариев поповер показывает само выражение из вкладки «Сценарии».
      </p>
      <TextField label="Поиск" value={query} placeholder="платёж, вычет, ПДН…" onChange={setQuery} />
      {shown.map(({ f, index }) => (
        <section key={f.id} className="panel">
          <div className="admin-head">
            <h2 className="panel-subtitle">{f.title}</h2>
            <code className="admin-id">{f.id}</code>
          </div>
          <div className="admin-grid">
            <TextField label="Заголовок" value={f.title} onChange={(v) => edit((d) => void (d.formulas[index].title = v))} />
            <TextField label="Формула" mono rows={2} value={f.formula} onChange={(v) => edit((d) => void (d.formulas[index].formula = v))} />
          </div>
          <TextField label="Пояснение простым языком" rows={3} value={f.hint} onChange={(v) => edit((d) => void (d.formulas[index].hint = v))} />
        </section>
      ))}
      {!shown.length && <p className="note">Ничего не нашлось.</p>}
    </div>
  );
}
