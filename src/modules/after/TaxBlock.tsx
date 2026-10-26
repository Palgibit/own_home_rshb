// Налоговый вычет: имущественный и по процентам, за сколько лет вернёте,
// проценты по годам и короткая инструкция (шаги — в конфиге).

import { useState } from "react";
import { deductionYears, interestDeduction, propertyDeduction } from "../../core/features";
import { interestByYear, type LoanStatus } from "../../core/loanStatus";
import { useConfig } from "../../config/ConfigContext";
import type { LoanData } from "../../data/DataSource";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { NumberField } from "../../ui/NumberField";
import { TemplateText } from "../../ui/TemplateText";
import { formatRub, plural } from "../../ui/format";

export function TaxBlock({ data, status }: { data: LoanData; status: LoanStatus }) {
  const { config, globals } = useConfig();
  const [cost, setCost] = useState(data.propertyPrice);
  const [salary, setSalary] = useState(config.after.salary);

  const ndfl = globals.ndfl;
  const property = propertyDeduction(cost, ndfl, globals.propertyLimit);
  const interestNow = interestDeduction(status.interestPaid.value, ndfl, globals.interestLimit);
  const interestAll = interestDeduction(status.interestTotal, ndfl, globals.interestLimit);
  const years = deductionYears(property.value, salary, ndfl);
  const byYear = interestByYear(status, data.loan.issueDate);
  const ndflHint = config.params.find((p) => p.id === "ndfl")?.hint;

  return (
    <section className="feature" id="tax" aria-labelledby="tax-heading">
      <div className="feature-head">
        <p className="eyebrow">Вернуть часть денег</p>
        <h2 id="tax-heading">Налоговый вычет</h2>
        <p className="feature-lead">
          Государство возвращает часть НДФЛ с расходов на жильё и с процентов по ипотеке. Это два разных вычета — можно
          получить оба.
        </p>
      </div>

      <div className="feature-grid">
        <div className="panel">
          <div className="form-grid">
            <NumberField label="Стоимость жилья" unit="₽" value={cost} min={0} max={200_000_000} onChange={setCost} />
            <NumberField label="Зарплата до вычета налога" unit="₽/мес" value={salary} min={0} max={10_000_000} onChange={setSalary} />
          </div>
          <dl className="verdict-rows">
            <div>
              <dt>Имущественный вычет</dt>
              <dd>
                <ExplainableNumber value={property} />
              </dd>
            </div>
            <div>
              <dt>По процентам — за уже уплаченные</dt>
              <dd>
                <ExplainableNumber value={interestNow} />
              </dd>
            </div>
            <div>
              <dt>По процентам — за весь срок по графику</dt>
              <dd>
                <ExplainableNumber value={interestAll} />
              </dd>
            </div>
          </dl>
          <p className="big-answer">
            Всего можно вернуть {formatRub(property.value + interestAll.value)}
          </p>
          {Number.isFinite(years.value) && property.value > 0 && (
            <p className="note">
              Имущественный вычет вернёте примерно за <ExplainableNumber value={years} format="number" />{" "}
              {plural(years.value, ["год", "года", "лет"])}: за год возвращают не больше НДФЛ, уплаченного за этот год.
            </p>
          )}
          <p className="field-hint">{ndflHint}</p>
        </div>

        <div className="panel">
          <h3 className="panel-subtitle">Как получить</h3>
          <ol className="steps-list">
            {config.after.taxSteps.map((s, i) => (
              <li key={i}>
                <TemplateText text={s} />
              </li>
            ))}
          </ol>
          {byYear.length > 0 && (
            <details className="table-view">
              <summary>Проценты по годам — для декларации</summary>
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Год</th>
                    <th>Уплачено процентов</th>
                    <th>Вернут</th>
                  </tr>
                </thead>
                <tbody>
                  {byYear.map((y) => (
                    <tr key={y.year}>
                      <th>{y.year}</th>
                      <td>{formatRub(y.interest)}</td>
                      <td>{formatRub((y.interest * ndfl) / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="field-hint">
                {data.kind === "bank"
                  ? "По данным банка. Точная сумма — в справке об уплаченных процентах."
                  : "По графику, без учёта просрочек и досрочек — точные суммы будут в справке банка."}
              </p>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}
