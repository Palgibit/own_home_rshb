// Список изменений конфига по разделам: «Ставка сельской ипотеки: 3 % → 2,5 %».

import type { ConfigChange } from "./diff";

export function ChangesList({ changes, empty }: { changes: ConfigChange[]; empty: string }) {
  if (!changes.length) return <p className="scenario-description">{empty}</p>;
  const sections = [...new Set(changes.map((c) => c.section))];
  return (
    <div className="admin-changes">
      {sections.map((section) => (
        <div key={section}>
          <p className="admin-vars-title">{section}</p>
          <ul>
            {changes
              .filter((c) => c.section === section)
              .map((c, i) => (
                <li key={i}>
                  <span>{c.label}</span>{" "}
                  {c.kind === "added" ? (
                    <b className="admin-status is-good">добавлено</b>
                  ) : c.kind === "removed" ? (
                    <b className="admin-status is-bad">удалено</b>
                  ) : c.before !== undefined && c.after !== undefined ? (
                    <b>
                      {c.before} → {c.after}
                    </b>
                  ) : (
                    <b>изменено</b>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
