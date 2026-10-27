// «Страховка и расходы на сделку»: страховка первого года — в кредит или сразу,
// галочки расходов, итог «Нужно сразу» полосой из частей и сравнение
// «Страховать жизнь или нет?». Суммы и тарифы — из конфига, условные.

import { useConfig } from "../../config/ConfigContext";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { formatRub } from "../../ui/format";
import { StackBar } from "./MoneyBar";
import type { Purchase } from "./purchaseModel";
import type { PurchaseChoice } from "./types";

type Props = {
  choice: PurchaseChoice;
  onChoice: (next: PurchaseChoice) => void;
  purchase: Purchase;
};

export function CostsBlock({ choice, onChoice, purchase }: Props) {
  const { config } = useConfig();
  const toggleDeal = (id: string) =>
    onChoice({
      ...choice,
      dealCosts: choice.dealCosts.includes(id) ? choice.dealCosts.filter((x) => x !== id) : [...choice.dealCosts, id],
    });
  const dealsTotal = purchase.deals.reduce((s, c) => s + c.amount, 0);
  const down = purchase.upfront.value - dealsTotal - purchase.insuranceNow;

  return (
    <details className="panel-details choice-block">
      <summary>
        <span>Страховка и расходы на сделку</span>
        <span className="choice-summary">
          сразу <strong>{formatRub(purchase.upfront.value)}</strong>
        </span>
      </summary>

      <div className="check-list">
        <label className="check">
          <input
            type="checkbox"
            checked={choice.insuranceFinanced}
            onChange={() => onChoice({ ...choice, insuranceFinanced: !choice.insuranceFinanced })}
          />
          <span className="check-text">
            <span className="check-label">Страховку первого года — в кредит</span>
            <span className="check-hint">
              Премия {formatRub(purchase.firstYearPremium)} добавится к сумме кредита. Со второго года страховку платят
              сами, раз в год.
            </span>
          </span>
        </label>
        {config.dealCosts.map((c) => (
          <label key={c.id} className="check">
            <input type="checkbox" checked={choice.dealCosts.includes(c.id)} onChange={() => toggleDeal(c.id)} />
            <span className="check-text">
              <span className="check-label">
                {c.label} <span className="check-delta">{formatRub(c.amount)}</span>
              </span>
              {c.hint && <span className="check-hint">{c.hint}</span>}
            </span>
          </label>
        ))}
      </div>

      <div className="upfront">
        <p className="loan-amount">
          <span>Нужно сразу</span>
          <ExplainableNumber value={purchase.upfront} />
        </p>
        <StackBar
          label="Из чего складывается сумма в день сделки"
          parts={[
            { label: "Взнос", value: down, color: "var(--chart-4)" },
            { label: "Расходы на сделку", value: dealsTotal, color: "var(--chart-2)" },
            { label: "Страховка", value: purchase.insuranceNow, color: "var(--chart-3)" },
          ]}
        />
      </div>

      <LifeChoice purchase={purchase} />
    </details>
  );
}

// «Страховать жизнь или нет?»: два столбца за весь срок — цена полиса против лишних процентов
function LifeChoice({ purchase }: { purchase: Purchase }) {
  const { policy, extraInterest, winner, difference } = purchase.lifeChoice;
  const max = Math.max(policy.value, extraInterest.value, 1);
  const rows = [
    { label: "Полис жизни за весь срок", value: policy, color: "var(--chart-3)" },
    { label: "Лишние проценты без полиса", value: extraInterest, color: "var(--chart-2)" },
  ];

  return (
    <div className="life-choice">
      <h4 className="choice-title">Страховать жизнь или нет?</h4>
      <div className="hbars">
        {rows.map((r) => (
          <div className="hbar-row" key={r.label}>
            <span className="hbar-label">{r.label}</span>
            <span className="hbar-track">
              <span className="hbar-fill" style={{ width: `${(Math.max(r.value.value, 0) / max) * 100}%`, background: r.color }} />
            </span>
            <span className="hbar-value">
              <ExplainableNumber value={r.value} />
            </span>
          </div>
        ))}
      </div>
      <p className="verdict-plaque verdict-deposit">
        {winner === "insure" ? "Выгоднее страховать" : "Выгоднее без полиса"} на {formatRub(difference)}
      </p>
      <p className="field-hint">
        Считаем на сумму {formatRub(purchase.loanBase)} без досрочек. Тариф и надбавка — условные, точные назовут банк и
        страховая.
      </p>
    </div>
  );
}
