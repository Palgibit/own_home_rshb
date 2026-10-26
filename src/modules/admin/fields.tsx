// Поля форм админки: текст, многострочный текст, выбор, редактор JSON.
// Числовые поля — общий NumberField из ui/.

import { useEffect, useId, useState, type ReactNode } from "react";

type TextProps = {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  mono?: boolean; // моноширинный шрифт — для id и формул
  rows?: number; // > 1 — многострочное поле
};

export function TextField({ label, value, onChange, hint, placeholder, mono, rows = 1 }: TextProps) {
  const id = useId();
  const className = `admin-input${mono ? " is-mono" : ""}`;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {rows > 1 ? (
        <textarea id={id} className={className} rows={rows} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className={className} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

type SelectProps<T extends string> = {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
};

export function SelectField<T extends string>({ label, value, options, onChange }: SelectProps<T>) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="admin-input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

// Пустая строка в необязательном поле конфига — значит «поля нет»
export const optional = (text: string) => (text.trim() ? text : undefined);

type JsonProps = {
  label: string;
  value: unknown;
  onChange: (value: never) => void;
  rows?: number;
  hint?: ReactNode;
};

// Редактор куска конфига в виде JSON. Пока текст не разбирается — показываем ошибку
// и черновик не трогаем. Разобрался — отдаём наверх; дальше его проверит validateConfig.
export function JsonEditor({ label, value, onChange, rows = 24, hint }: JsonProps) {
  const id = useId();
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  // Значение поменялось снаружи (импорт, отмена, сброс) — показываем новое,
  // если текст в редакторе описывает что-то другое
  useEffect(() => {
    let same = false;
    try {
      same = JSON.stringify(JSON.parse(text)) === JSON.stringify(value);
    } catch {
      // в редакторе битый JSON — заменяем
    }
    if (!same) {
      setText(JSON.stringify(value, null, 2));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- реагируем только на смену значения снаружи
  }, [value]);

  const change = (next: string) => {
    setText(next);
    try {
      onChange(JSON.parse(next) as never);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className="admin-input is-mono admin-json" rows={rows} spellCheck={false} value={text} onChange={(e) => change(e.target.value)} />
      {error ? <p className="admin-status is-bad">Не JSON: {error}. Черновик не изменён, пока ошибка не исправлена.</p> : hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
