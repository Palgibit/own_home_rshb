// «Когда кредит закроется»: что сделать после последнего платежа (шаги из конфига)
// и сколько можно вернуть за страховку при полном досрочном погашении.
// У клиента полис подставлен из банка, у гостя — премия по тарифам из конфига, её можно поправить.

import { useState } from "react";
import { addMonths, insuranceRefund, type LoanStatus } from "../../core/loanStatus";
import { useConfig } from "../../config/ConfigContext";
import type { LoanData } from "../../data/DataSource";
import { DateField } from "../../ui/DateField";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { NumberField } from "../../ui/NumberField";
import { TemplateText } from "../../ui/TemplateText";
import { formatDate, formatRub } from "../../ui/format";

type Props = { data: LoanData; status: LoanStatus; today: string };

// Гостю: полис считаем годовым от ближайшей прошедшей годовщины выдачи
function guestPolicy(issueDate: string, today: string) {
  let start = issueDate;
  for (let k = 1; addMonths(issueDate, k * 12) <= today; k++) start = addMonths(issueDate, k * 12);
  return { startDate: start, endDate: addMonths(start, 12) };
}

export function CloseBlock({ data, status, today }: Props) {
  const { config, globals } = useConfig();
  const policy = data.insurance ?? {
    ...guestPolicy(data.loan.issueDate, today),
    // Условная премия: тарифы объекта и жизни из конфига · остаток долга
    premium: Math.round((status.balance.value * ((globals.propertyInsurancePct ?? 0) + (globals.lifeInsurancePct ?? 0))) / 100),
  };
  const [premium, setPremium] = useState(policy.premium);
  const [closeDate, setCloseDate] = useState(today);
  const refund = insuranceRefund(data.insurance ? policy.premium : premium, policy.startDate, policy.endDate, closeDate);

  return (
    <section className="feature" id="close" aria-labelledby="close-heading">
      <div className="feature-head">
        <p className="eyebrow">Финиш</p>
        <h2 id="close-heading">Когда кредит закроется</h2>
        <p className="feature-lead">
          Последний платёж — ещё не конец: нужно снять обременение с жилья и забрать то, что вам положено.
        </p>
      </div>

      <div className="feature-grid">
        <div className="panel">
          <h3 className="panel-subtitle">Что сделать</h3>
          <ol className="steps-list">
            {config.after.closingSteps.map((s, i) => (
              <li key={i}>
                <TemplateText text={s} />
              </li>
            ))}
          </ol>
        </div>

        <div className="panel">
          <h3 className="panel-subtitle">Вернуть часть страховки</h3>
          <p className="scenario-description">
            Если закрыть кредит досрочно, премию за оставшиеся дни полиса можно вернуть. Условно: из суммы могут вычесть
            расходы страховой — уточните в ней.
          </p>
          <div className="form-grid">
            {data.insurance ? (
              <p className="field-hint">
                Ваш полис: {formatRub(policy.premium)} в год, с {formatDate(policy.startDate)} по {formatDate(policy.endDate)}.
              </p>
            ) : (
              <NumberField
                label="Премия за год"
                unit="₽"
                value={premium}
                min={0}
                max={1_000_000}
                hint={`Полис условно с ${formatDate(policy.startDate)} по ${formatDate(policy.endDate)}`}
                onChange={setPremium}
              />
            )}
            <DateField label="Дата полного погашения" value={closeDate} onChange={setCloseDate} />
          </div>
          <p className="big-answer">
            <ExplainableNumber value={refund} />
          </p>
          <p className="field-hint">
            Чтобы закрыть кредит сегодня, понадобится остаток долга {formatRub(status.balance.value)} плюс проценты за дни с
            последнего платежа — точную сумму назовёт банк.
          </p>
        </div>
      </div>
    </section>
  );
}
