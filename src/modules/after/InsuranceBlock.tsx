// Страхование: у клиента — его полис из банка, срок и напоминание о продлении;
// у гостя — что нужно знать о страховке и ссылка на РСХБ Страхование.

import { daysBetween } from "../../core/loanStatus";
import { useConfig } from "../../config/ConfigContext";
import type { LoanData } from "../../data/DataSource";
import { TemplateText } from "../../ui/TemplateText";
import { formatDate, formatDaysLeft, formatRub } from "../../ui/format";

export function InsuranceBlock({ data, today }: { data: LoanData; today: string }) {
  const { config } = useConfig();
  const service = config.services.find((s) => s.id === config.after.insuranceService);
  const policy = data.insurance;
  const days = policy ? daysBetween(today, policy.endDate) : null;
  const soon = days !== null && days <= config.after.reminderDays;

  const serviceLink = service?.href ? (
    <a className="button button-secondary" href={service.href} target="_blank" rel="noreferrer">
      {policy ? "Продлить" : "Оформить"} в {service.title} →
    </a>
  ) : null;

  return (
    <section className="feature" id="insurance" aria-labelledby="insurance-heading">
      <div className="feature-head">
        <p className="eyebrow">Защита</p>
        <h2 id="insurance-heading">Страхование</h2>
        <p className="feature-lead">
          <TemplateText text={config.after.insuranceHint} />
        </p>
      </div>

      <div className="panel insurance-panel">
        {policy && days !== null ? (
          <>
            <dl className="verdict-rows">
              <div>
                <dt>Полис</dt>
                <dd>
                  {policy.company}, № {policy.number}
                </dd>
              </div>
              <div>
                <dt>Что застраховано</dt>
                <dd>{policy.title}</dd>
              </div>
              <div>
                <dt>Действует</dt>
                <dd>
                  {formatDate(policy.startDate)} — {formatDate(policy.endDate)}
                </dd>
              </div>
              <div>
                <dt>Взнос за год</dt>
                <dd>{formatRub(policy.premium)}</dd>
              </div>
            </dl>
            <div className={`note note-action${soon ? " note-warn" : ""}`}>
              <p>
                {days < 0
                  ? `Полис закончился ${formatDate(policy.endDate)}. Продлите его как можно скорее.`
                  : soon
                    ? `Полис заканчивается ${formatDaysLeft(days)}. Продлите заранее — новый полис начнёт действовать сразу после старого.`
                    : `Полис действует ещё ${formatDaysLeft(days).replace("через ", "")}. Напомним за ${config.after.reminderDays} дней до окончания.`}
              </p>
              {serviceLink}
            </div>
          </>
        ) : (
          <div className="note note-action">
            <p>В личном кабинете здесь будет ваш полис: что застраховано, до какого числа действует и сколько стоит продление.</p>
            {serviceLink}
          </div>
        )}
      </div>
    </section>
  );
}
