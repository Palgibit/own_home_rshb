// Поле даты в российском формате ДД.ММ.ГГГГ.
// Стандартный <input type="date"> показывает формат по языку браузера (в англоязычном — 10/25/2026),
// поэтому вводим дату текстом: точки ставятся сами, наружу отдаём ISO «2026-10-25».

import { useId, useState } from "react";
import "./ui.css";

type Props = {
  label: string;
  value: string; // ISO: 2026-10-25
  onChange: (iso: string) => void;
  max?: string; // ISO; более поздние даты не принимаем
  hint?: string;
};

// «2026-10-25» → «25.10.2026»
export function isoToRu(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : "";
}

// «25.10.2026» → «2026-10-25»; несуществующую дату (31.02) не принимаем
export function ruToIso(text: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (date.getUTCDate() !== Number(d) || date.getUTCMonth() !== Number(m) - 1) return null;
  return `${y}-${m}-${d}`;
}

// Оставляем только цифры и расставляем точки: «25102026» → «25.10.2026»
function mask(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join(".");
}

export function DateField({ label, value, onChange, max, hint }: Props) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? isoToRu(value);
  const iso = ruToIso(text);
  // Ошибку показываем, только когда дата введена полностью
  const error =
    text.length === 10 && (!iso ? "Такой даты нет" : max && iso > max ? `Не позже ${isoToRu(max)}` : null);

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="field-box">
        <input
          id={id}
          className="field-input"
          inputMode="numeric"
          placeholder="ДД.ММ.ГГГГ"
          value={text}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            const next = mask(e.target.value);
            setDraft(next);
            const parsed = ruToIso(next);
            if (parsed && (!max || parsed <= max)) onChange(parsed);
          }}
          // Ушли из поля с неполной датой — возвращаем последнюю правильную
          onBlur={() => setDraft(null)}
        />
      </div>
      {error ? <p className="field-hint text-bad">{error}</p> : hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
