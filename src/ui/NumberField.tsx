// Числовое поле с подписью, единицей и (по желанию) ползунком.
// Пока поле в фокусе, храним «сырой» текст, чтобы не мешать вводу;
// при выходе из поля показываем число с пробелами: 6 000 000.

import { useId, useState } from "react";
import "./ui.css";

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  slider?: boolean;
};

const display = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export function NumberField({ label, value, onChange, unit, min, max, step = 1, hint, slider }: Props) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));

  const commit = (text: string) => {
    // Убираем пробелы (в т.ч. неразрывные) и принимаем запятую как десятичный разделитель
    const v = Number(text.replace(/[\s ]/g, "").replace(",", "."));
    if (Number.isFinite(v)) onChange(clamp(v));
  };

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="field-box">
        <input
          id={id}
          className="field-input"
          inputMode="decimal"
          value={draft ?? display.format(value)}
          onFocus={() => setDraft(String(value))}
          onChange={(e) => {
            setDraft(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => setDraft(null)}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </div>
      {slider && min !== undefined && max !== undefined && (
        <input
          className="field-range"
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
