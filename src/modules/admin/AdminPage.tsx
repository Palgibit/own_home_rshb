// Админка. Админ правит черновик — копию конфига. Черновик проверяется при каждом
// изменении (validateConfig); «Сохранить» доступно, только когда ошибок нет.
// После сохранения конфиг уходит в localStorage, и все модули сразу перерисовываются.
// Вкладка — в адресе: #/admin?tab=scenarios.

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useConfig } from "../../config/ConfigContext";
import { validateConfig, type AppConfig } from "../../config/schema";
import { defaultConfig } from "../../config/store";
import { plural } from "../../ui/format";
import { AfterTab } from "./AfterTab";
import { FileTab } from "./FileTab";
import { HintsTab } from "./HintsTab";
import { NavigatorTab } from "./NavigatorTab";
import { ParamsTab } from "./ParamsTab";
import { ScenariosTab } from "./ScenariosTab";
import "../simulator/simulator.css";
import "./admin.css";

// Демо без настоящей авторизации: пароль виден в коде и на экране входа (см. README)
const DEMO_PASSWORD = "rshb2026";
const SESSION_KEY = "svoe-zhilyo:admin";

// Правка черновика: функция получает копию и меняет её на месте
export type Edit = (fn: (draft: AppConfig) => void) => void;

const TABS = [
  ["params", "Параметры"],
  ["scenarios", "Сценарии и формулы"],
  ["hints", "Подсказки"],
  ["navigator", "Навигатор"],
  ["after", "После ипотеки"],
  ["file", "Файл"],
] as const;
type TabId = (typeof TABS)[number][0];

export function AdminPage() {
  const [authed, setAuthed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      return false;
    }
  });

  const login = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // без хранилища вход просто не запомнится
    }
    setAuthed(true);
  };
  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // нечего удалять
    }
    setAuthed(false);
  };

  return (
    <main className="admin-page">
      <Link className="back-link" to="/">
        <span aria-hidden="true">←</span> На главную
      </Link>
      <p className="eyebrow">Администрирование</p>
      <h1 className="page-title">Настройки</h1>
      {authed ? <AdminEditor onLogout={logout} /> : <LoginForm onLogin={login} />}
    </main>
  );
}

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password === DEMO_PASSWORD) onLogin();
    else setWrong(true);
  };
  return (
    <form className="panel admin-login" onSubmit={submit}>
      <h2 className="panel-title">Вход для администратора</h2>
      <div className="field">
        <label className="field-label" htmlFor="admin-password">
          Пароль
        </label>
        <input
          id="admin-password"
          className="admin-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setWrong(false);
          }}
        />
        {wrong && <p className="admin-status is-bad">Неверный пароль</p>}
      </div>
      <button type="submit" className="button button-primary">
        Войти
      </button>
      <p className="note">
        Это демо без настоящей авторизации. Пароль: <code>{DEMO_PASSWORD}</code>. Настройки хранятся только в этом
        браузере.
      </p>
    </form>
  );
}

// Проверка не должна ронять страницу, даже если в JSON сломана структура
function safeValidate(config: AppConfig): string[] {
  try {
    return validateConfig(config);
  } catch (e) {
    return [`Структура конфига нарушена: ${e instanceof Error ? e.message : String(e)}`];
  }
}

function AdminEditor({ onLogout }: { onLogout: () => void }) {
  const { config, update, reset } = useConfig();
  const [draft, setDraft] = useState<AppConfig>(() => structuredClone(config));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabId = TABS.find(([id]) => id === searchParams.get("tab"))?.[0] ?? "params";

  const errors = useMemo(() => safeValidate(draft), [draft]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config), [draft, config]);

  // Копия + изменение на месте: проще писать вложенные правки, а сохранённый конфиг не трогается
  const edit: Edit = (fn) =>
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  // Не потерять несохранённые правки при закрытии вкладки браузера
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () => {
    if (update(draft).length === 0) setSavedAt(new Date());
  };

  const content = (() => {
    switch (tab) {
      case "params":
        return <ParamsTab draft={draft} edit={edit} />;
      case "scenarios":
        return <ScenariosTab draft={draft} edit={edit} />;
      case "hints":
        return <HintsTab draft={draft} edit={edit} />;
      case "navigator":
        return <NavigatorTab draft={draft} edit={edit} />;
      case "after":
        return <AfterTab draft={draft} edit={edit} />;
      case "file":
        return (
          <FileTab
            saved={config}
            dirty={dirty}
            onImport={(c) => setDraft(c)}
            onReset={() => {
              reset();
              setDraft(structuredClone(defaultConfig));
              setSavedAt(new Date());
            }}
          />
        );
    }
  })();

  return (
    <>
      <div className="admin-top">
        <p className="page-lead">
          Ставки, сценарии, формулы, шаги навигатора и тексты. Изменения применяются ко всем модулям после
          сохранения.
        </p>
        <button type="button" className="admin-link-button" onClick={onLogout}>
          Выйти из админки
        </button>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Разделы настроек">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`scenario-chip${tab === id ? " is-active" : ""}`}
            onClick={() => setSearchParams(id === "params" ? {} : { tab: id }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="admin-content">{content}</div>

      <div className={`admin-savebar${errors.length ? " has-errors" : ""}`} role="status">
        <div className="admin-savebar-inner">
          <div className="admin-savebar-text">
            {errors.length > 0 ? (
              <button type="button" className="admin-link-button is-danger" onClick={() => setShowErrors((v) => !v)}>
                {errors.length} {plural(errors.length, ["ошибка", "ошибки", "ошибок"])} — сохранить
                нельзя {showErrors ? "▾" : "▸"}
              </button>
            ) : dirty ? (
              <span>Есть несохранённые изменения</span>
            ) : (
              <span className="admin-status is-good">
                {savedAt ? `Сохранено в ${savedAt.toLocaleTimeString("ru-RU").slice(0, 5)} — уже видно в модулях` : "Все изменения сохранены"}
              </span>
            )}
          </div>
          <div className="admin-savebar-actions">
            <button type="button" className="button button-secondary" disabled={!dirty} onClick={() => setDraft(structuredClone(config))}>
              Отменить
            </button>
            <button type="button" className="button button-primary" disabled={!dirty || errors.length > 0} onClick={save}>
              Сохранить
            </button>
          </div>
        </div>
        {showErrors && errors.length > 0 && (
          <ul className="admin-errors">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
