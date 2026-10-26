// Навигатор — через редактор JSON: у шагов вложенные условия и варианты,
// форма для них вышла бы громоздкой. Ошибки ссылок (этап, вопрос, сценарий,
// {параметр}) ловит validateConfig и показывает внизу.

import { Link } from "react-router-dom";
import type { AppConfig, NavigatorDef } from "../../config/schema";
import { JsonEditor } from "./fields";
import type { Edit } from "./AdminPage";

const count = (list: unknown) => (Array.isArray(list) ? list.length : "—");

export function NavigatorTab({ draft, edit }: { draft: AppConfig; edit: Edit }) {
  const nav = draft.navigator;
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
        <details className="admin-vars">
          <summary>Как устроен шаг</summary>
          <pre className="admin-pre">{`{
  "id": "check-village",            // уникальный id
  "stage": "finance",               // id этапа из stages
  "title": "Проверьте населённый пункт",
  "showIf": { "financing": ["rural"] },   // когда показывать: вопрос → подходящие ответы
  "recommendation": "Текст, можно с {ruralRate}",
  "variants": [{ "when": { "object": ["construction"] }, "text": "Особый текст для стройки" }],
  "services": ["svoe-selo"],        // id сервисов с вкладки «После ипотеки»
  "calcLink": { "label": "Посчитать", "to": "/simulator?scenario=lose-benefit" }
}`}</pre>
        </details>
        <p className="field-hint">
          После сохранения проверьте маршрут и{" "}
          <Link className="text-link" to="/navigator?view=matrix">
            матрицу «шаг × сценарий»
          </Link>
          .
        </p>
      </section>
      <JsonEditor
        label="navigator"
        rows={32}
        value={nav}
        onChange={(v: NavigatorDef) => edit((d) => void (d.navigator = v))}
      />
    </div>
  );
}
