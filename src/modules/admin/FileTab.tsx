// Экспорт, импорт и сброс конфига. Конфиг живёт в localStorage этого браузера,
// поэтому файл — способ перенести настройки на другой компьютер или отдать их жюри.

import { useRef, useState } from "react";
import type { AppConfig } from "../../config/schema";
import { exportConfig, importConfig } from "../../config/store";
import { ChangesList } from "./ChangesList";
import type { ConfigChange } from "./diff";

type Props = {
  saved: AppConfig;
  fromDefault: ConfigChange[]; // отличия сохранённого конфига от умолчаний
  dirty: boolean;
  onImport: (config: AppConfig) => void; // загрузить в черновик
  onReset: () => void;
};

export function FileTab({ saved, fromDefault, dirty, onImport, onReset }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [imported, setImported] = useState<string | null>(null);

  const download = () => {
    const blob = new Blob([exportConfig(saved)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `svoe-zhilyo-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const result = importConfig(await file.text());
    if ("errors" in result) {
      setImportErrors(result.errors);
      setImported(null);
    } else {
      onImport(result.config);
      setImportErrors([]);
      setImported(file.name);
    }
    if (input.current) input.current.value = ""; // чтобы тот же файл можно было выбрать ещё раз
  };

  return (
    <div className="admin-stack">
      <section className="panel">
        <h2 className="panel-title">Отличия от умолчаний</h2>
        <p className="scenario-description">
          Что в сохранённых настройках не так, как в исходном конфиге. Кнопка «Сбросить к умолчаниям» ниже уберёт всё это.
        </p>
        <ChangesList changes={fromDefault} empty="Настройки совпадают с умолчаниями." />
      </section>

      <section className="panel">
        <h2 className="panel-title">Экспорт</h2>
        <p className="scenario-description">Скачать сохранённые настройки одним JSON-файлом.</p>
        {dirty && <p className="note note-warn">В черновике есть несохранённые изменения — в файл они не попадут. Сначала сохраните.</p>}
        <div>
          <button type="button" className="button button-secondary" onClick={download}>
            Скачать JSON
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Импорт</h2>
        <p className="scenario-description">
          Файл проверяется так же, как при сохранении. Корректный загружается в черновик — посмотрите вкладки и нажмите
          «Сохранить».
        </p>
        <div>
          <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => upload(e.target.files?.[0])} />
          <button type="button" className="button button-secondary" onClick={() => input.current?.click()}>
            Выбрать файл…
          </button>
        </div>
        {imported && <p className="admin-status is-good">Файл «{imported}» загружен в черновик. Не забудьте сохранить.</p>}
        {importErrors.length > 0 && (
          <div className="admin-errors">
            <p className="admin-status is-bad">Файл не подошёл:</p>
            <ul>
              {importErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Сбросить к умолчаниям</h2>
        <p className="scenario-description">
          Удалить настройки из этого браузера и вернуть исходные ставки, сценарии и тексты. Отменить нельзя — если нужно,
          сначала скачайте JSON.
        </p>
        <div>
          <button
            type="button"
            className="button button-secondary is-danger"
            onClick={() => window.confirm("Сбросить все настройки к умолчаниям?") && onReset()}
          >
            Сбросить
          </button>
        </div>
      </section>
    </div>
  );
}
