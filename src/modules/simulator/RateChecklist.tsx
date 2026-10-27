// «Скидки и надбавки»: галочки к базовой ставке и «лесенка» — базовая ставка,
// каждая поправка (скидка вниз, надбавка вверх) и итог. Значения — из конфига, условные.

import { optionApplies } from "../../core/purchase";
import { useConfig } from "../../config/ConfigContext";
import { PROGRAMS, type LoanProgram } from "../../config/schema";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { formatNumber, formatPct } from "../../ui/format";
import type { Purchase } from "./purchaseModel";
import type { PurchaseChoice } from "./types";

type Props = {
  program: LoanProgram;
  basePct: number;
  choice: PurchaseChoice;
  onChoice: (next: PurchaseChoice) => void;
  purchase: Purchase;
};

// −0,3 п.п. / +1 п.п.
const signed = (v: number) => `${v > 0 ? "+" : "−"}${formatNumber(Math.abs(v))} п.п.`;

export function RateChecklist({ program, basePct, choice, onChoice, purchase }: Props) {
  const { config, globals } = useConfig();
  const bigFrom = globals.bigDownFromPct ?? 0;
  const bigDiscount = globals.bigDownDiscount ?? 0;
  const noLife = globals.noLifeInsuranceRate ?? 0;

  // Варианты одной группы взаимоисключающие: отметили один — снимаем остальные
  const toggle = (id: string, group?: string) => {
    const on = !choice.rateOptions.includes(id);
    const sameGroup = group ? config.rateOptions.filter((o) => o.group === group).map((o) => o.id) : [];
    const rest = choice.rateOptions.filter((x) => x !== id && !(on && sameGroup.includes(x)));
    onChoice({ ...choice, rateOptions: on ? [...rest, id] : rest });
  };

  const bigDownState =
    program !== "market"
      ? `не действует для программы «${PROGRAMS[program]}»`
      : purchase.downPct >= bigFrom
        ? "начислена: взнос достаточный"
        : `взнос ${formatPct(purchase.downPct)} — нужно от ${formatPct(bigFrom)}`;

  return (
    <details className="panel-details choice-block">
      <summary>
        <span>Скидки и надбавки</span>
        <span className="choice-summary">
          ставка <strong>{formatPct(purchase.rate.value)}</strong>
        </span>
      </summary>

      <div className="check-list">
        {config.rateOptions.map((o) => {
          const applies = optionApplies(o, program);
          return (
            <label key={o.id} className={`check${applies ? "" : " is-disabled"}`}>
              <input
                type="checkbox"
                checked={applies && choice.rateOptions.includes(o.id)}
                disabled={!applies}
                onChange={() => toggle(o.id, o.group)}
              />
              <span className="check-text">
                <span className="check-label">
                  {o.label} <span className="check-delta">{signed(o.deltaPct)}</span>
                </span>
                <span className="check-hint">
                  {applies ? o.hint : `Не действует для программы «${PROGRAMS[program]}»: ставку задаёт программа.`}
                </span>
              </span>
            </label>
          );
        })}

        <label className="check">
          <input
            type="checkbox"
            checked={choice.lifeInsurance}
            onChange={() => onChoice({ ...choice, lifeInsurance: !choice.lifeInsurance })}
          />
          <span className="check-text">
            <span className="check-label">Страховать жизнь</span>
            <span className="check-hint">Без полиса жизни ставка выше на {signed(noLife).slice(1)} — для обеих программ.</span>
          </span>
        </label>

        {bigDiscount > 0 && (
          <p className="check-auto">
            Скидка за взнос от {formatPct(bigFrom)} ({signed(-bigDiscount)}) начисляется сама — {bigDownState}.
          </p>
        )}
      </div>

      <RateLadder basePct={basePct} purchase={purchase} />
    </details>
  );
}

// Лесенка ставки: мини-водопад. Базовая и итоговая ставки — полосы от нуля,
// поправки — «висячие» отрезки от предыдущего значения к новому.
function RateLadder({ basePct, purchase }: { basePct: number; purchase: Purchase }) {
  const steps: { label: string; from: number; to: number; kind: "base" | "down" | "up" | "total"; text: string }[] = [];
  steps.push({ label: "Базовая ставка", from: 0, to: basePct, kind: "base", text: formatPct(basePct) });
  let current = basePct;
  for (const a of purchase.adjustments) {
    const next = current + a.deltaPct;
    steps.push({ label: a.label, from: current, to: next, kind: a.deltaPct < 0 ? "down" : "up", text: signed(a.deltaPct) });
    current = next;
  }
  const scale = Math.max(...steps.map((s) => Math.max(s.from, s.to)), 0.1);
  const pos = (v: number) => `${(Math.max(v, 0) / scale) * 100}%`;

  return (
    <div className="ladder" aria-label="Как складывается ставка">
      {steps.map((s, k) => (
        <div className="ladder-row" key={k}>
          <span className="ladder-label">{s.label}</span>
          <span className="ladder-track">
            <span
              className={`ladder-bar ladder-${s.kind}`}
              style={{ left: pos(Math.min(s.from, s.to)), width: pos(Math.abs(s.to - s.from)) }}
            />
          </span>
          <span className="ladder-value">{s.text}</span>
        </div>
      ))}
      <div className="ladder-row ladder-row-total">
        <span className="ladder-label">Ваша ставка</span>
        <span className="ladder-track">
          <span className="ladder-bar ladder-total" style={{ left: 0, width: pos(purchase.rate.value) }} />
        </span>
        <span className="ladder-value">
          <ExplainableNumber value={purchase.rate} format="pct" />
        </span>
      </div>
    </div>
  );
}
