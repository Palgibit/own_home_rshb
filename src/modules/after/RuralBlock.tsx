// Только для сельской ипотеки: таймер до подтверждения занятости, регистрация
// в доме и что будет с платежом, если льготу потерять (ссылка в симулятор).

import { Link } from "react-router-dom";
import { daysBetween, remainingPayment, ruralObligations, type LoanStatus } from "../../core/loanStatus";
import { useConfig } from "../../config/ConfigContext";
import type { LoanData } from "../../data/DataSource";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { TemplateText } from "../../ui/TemplateText";
import { formatDate, formatDaysLeft, formatPct, plural } from "../../ui/format";
import { ruralRules } from "./rules";

type Props = { data: LoanData; status: LoanStatus; today: string };

export function RuralBlock({ data, status, today }: Props) {
  const { config, globals } = useConfig();
  const o = ruralObligations(data.loan.issueDate, today, ruralRules(globals));
  const isClient = data.kind === "bank";
  const registrationOpen = today <= o.registrationDeadline;

  // Потеря льготы: остаток тот же, ставка — lossRate, срок — оставшийся
  const lossRate = globals.lossRate;
  const lossPayment = remainingPayment({ ...status.remaining, ratePct: lossRate });
  const nowPayment = status.next?.amount;

  return (
    <section className="feature" id="rural" aria-labelledby="rural-heading">
      <div className="feature-head">
        <p className="eyebrow">Только для сельской ипотеки</p>
        <h2 id="rural-heading">Сохраните льготную ставку</h2>
        <p className="feature-lead">
          <TemplateText text={config.after.ruralHint} />
        </p>
      </div>

      <div className="feature-grid">
        <div className="panel">
          {o.finished ? (
            <p className="big-answer">Обязательства выполнены — льготная ставка сохраняется до конца срока.</p>
          ) : (
            <>
              <p className="metric-label">Следующее подтверждение занятости</p>
              <p className="big-answer timer">
                {o.daysToCheck !== null ? formatDaysLeft(o.daysToCheck) : "—"}
                {o.nextCheck && <span className="timer-date">до {formatDate(o.nextCheck)}</span>}
              </p>
              <div className="check-dots" aria-label={`Пройдено проверок: ${o.checksDone} из ${o.checks.length}`}>
                {o.checks.map((d, i) => (
                  <span
                    key={d}
                    className={i < o.checksDone ? "is-done" : i === o.checksDone ? "is-next" : ""}
                    title={formatDate(d)}
                  />
                ))}
              </div>
              <p className="field-hint">
                Пройдено {o.checksDone} из {o.checks.length} {plural(o.checks.length, ["проверки", "проверок", "проверок"])}{" "}
                — раз в {globals.employmentCheckMonths} мес до {formatDate(o.obligationsEnd)}.
                {isClient && o.lastCheck && ` Подтверждение от ${formatDate(o.lastCheck)} банк принял ✓`}
                {!isClient && " Рассчитано по дате выдачи. В личном кабинете банк напомнит заранее."}
              </p>
              <p className="note">
                {registrationOpen
                  ? `Зарегистрируйтесь в доме до ${formatDate(o.registrationDeadline)} — ${formatDaysLeft(daysBetween(today, o.registrationDeadline))}.`
                  : o.nextRegistrationCheck
                    ? `Регистрацию в доме подтверждайте раз в год. Следующая проверка — ${formatDate(o.nextRegistrationCheck)}.`
                    : "Регистрация в доме подтверждена на весь срок обязательств."}
              </p>
            </>
          )}
        </div>

        <div className="panel">
          <p className="metric-label">Если льготу потерять</p>
          {nowPayment && status.remaining.principal > 0 ? (
            <p className="big-answer">
              Платёж вырастет с <ExplainableNumber value={nowPayment} /> до <ExplainableNumber value={lossPayment} /> в
              месяц
            </p>
          ) : (
            <p className="scenario-description">Кредит погашен — ставка больше не важна.</p>
          )}
          <p className="field-hint">
            Ставка после потери льготы — {formatPct(lossRate)} (условно, точное значение задаёт кредитный договор). На остаток
            долга, на оставшийся срок.
          </p>
          <Link className="button button-secondary" to="/simulator?scenario=lose-benefit">
            Посчитать подробно в симуляторе →
          </Link>
        </div>
      </div>
    </section>
  );
}
