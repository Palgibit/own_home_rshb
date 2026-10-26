// Фича 3. Досрочка «чашкой кофе»: небольшая доплата каждый месяц
// и обратный вопрос — сколько доплачивать, чтобы закрыть кредит к нужному сроку.

import { useState } from "react";
import type { Loan } from "../../core/annuity";
import { coffee, extraForTarget } from "../../core/features";
import { useConfig } from "../../config/ConfigContext";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { NumberField } from "../../ui/NumberField";
import { formatRub } from "../../ui/format";

export function CoffeeBlock({ loan }: { loan: Loan }) {
  const { config } = useConfig();
  const [extra, setExtra] = useState(config.simulator.coffeeExtra);
  const totalYears = Math.max(1, Math.round(loan.months / 12));
  const [targetYears, setTargetYears] = useState(Math.max(1, Math.round(totalYears * 0.75)));

  const result = coffee(loan, extra);
  const target = Math.min(targetYears, totalYears);
  const need = extraForTarget(loan, target * 12);

  return (
    <section className="feature" id="coffee" aria-labelledby="coffee-heading">
      <div className="feature-head">
        <p className="eyebrow">Маленькие шаги</p>
        <h2 id="coffee-heading">Досрочка «чашкой кофе»</h2>
        <p className="feature-lead">Даже небольшая доплата каждый месяц заметно сокращает срок и переплату.</p>
      </div>

      <div className="feature-grid">
        <div className="panel">
          <NumberField
            label="Доплачиваю к платежу каждый месяц"
            unit="₽"
            value={extra}
            min={0}
            max={config.simulator.coffeeMax}
            step={500}
            slider
            onChange={setExtra}
          />
          <p className="big-answer">
            {result.monthsSaved.value > 0 ? (
              <>
                Закроете на <ExplainableNumber value={result.monthsSaved} format="months" /> раньше и сэкономите{" "}
                <ExplainableNumber value={result.interestSaved} />
              </>
            ) : (
              "Подвиньте ползунок — посмотрим, что даст доплата."
            )}
          </p>
        </div>

        <div className="panel">
          <NumberField
            label="Хочу закрыть кредит за"
            unit="лет"
            value={targetYears}
            min={1}
            max={totalYears}
            slider
            onChange={setTargetYears}
          />
          <p className="big-answer">
            {need.value > 0 ? (
              <>
                Доплачивайте <ExplainableNumber value={need} /> в месяц
              </>
            ) : (
              `Это срок по договору — доплачивать не нужно.`
            )}
          </p>
          {need.value > 0 && (
            <p className="field-hint">Итого платёж — {formatRub(need.inputs.Pt.value)} в месяц.</p>
          )}
        </div>
      </div>
    </section>
  );
}
