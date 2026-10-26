// Фича 5. «Откуда это число»: любое Explained-значение можно раскрыть.
// По клику — поповер: формула, подставленные значения с подписями и пояснение.
// Текст формулы и пояснение берутся из конфига по formulaId (их правит админ).

import { useEffect, useId, useRef, useState } from "react";
import type { Explained } from "../core/explain";
import { EFFECTS, type EffectKey } from "../core/scenarios";
import { useConfig } from "../config/ConfigContext";
import { formatBy, formatNumber, type Format } from "./format";
import "./ui.css";

const POPOVER_WIDTH = 340; // совпадает с шириной .explain-popover в ui.css

type Props = {
  value: Explained;
  format?: Format;
  className?: string;
};

export function ExplainableNumber({ value, format = "rub", className = "" }: Props) {
  const { config } = useConfig();
  const [open, setOpen] = useState(false);
  // Если справа не хватает места — прижимаем поповер к правому краю числа
  const [alignRight, setAlignRight] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const popoverId = useId();

  // Закрываем по клику снаружи и по Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Формулы сценариев имеют id вида «effect.extraIncome»: общий текст + само выражение
  const isEffect = value.formulaId.startsWith("effect.");
  const doc = config.formulas.find((f) => f.id === (isEffect ? "effect" : value.formulaId));
  const title = isEffect ? EFFECTS[value.formulaId.slice(7) as EffectKey] ?? doc?.title : doc?.title;
  const formula = isEffect ? value.expression : doc?.formula;
  const inputs = Object.entries(value.inputs);

  return (
    <span className={`explain ${className}`} ref={rootRef}>
      <button
        type="button"
        className="explain-value"
        aria-expanded={open}
        aria-controls={popoverId}
        title="Откуда это число?"
        onClick={() => {
          const rect = rootRef.current?.getBoundingClientRect();
          setAlignRight(rect !== undefined && rect.left + POPOVER_WIDTH > window.innerWidth - 16);
          setOpen((o) => !o);
        }}
      >
        {formatBy(format, value.value)}
      </button>
      {open && (
        <span className={`explain-popover${alignRight ? " is-right" : ""}`} id={popoverId} role="dialog" aria-label={title ?? "Расчёт"}>
          <span className="explain-head">
            <strong>{title ?? "Расчёт"}</strong>
            <button type="button" className="explain-close" aria-label="Закрыть" onClick={() => setOpen(false)}>
              ×
            </button>
          </span>
          {formula && <code className="explain-formula">{formula}</code>}
          {inputs.length > 0 && (
            <span className="explain-inputs">
              {inputs.map(([name, input]) => (
                <span className="explain-row" key={name}>
                  <span>{input.label}</span>
                  <span className="explain-num">{formatNumber(input.value)}</span>
                </span>
              ))}
            </span>
          )}
          {doc?.hint && <span className="explain-hint">{doc.hint}</span>}
        </span>
      )}
    </span>
  );
}
