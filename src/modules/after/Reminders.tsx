// Персональные напоминания — только у клиента банка: ближайший платёж,
// подтверждение занятости (сельская ипотека), продление страховки.
// Гость видит приглашение войти: так разница «гость / клиент» заметна сразу.

import { daysBetween, ruralObligations, type LoanStatus } from "../../core/loanStatus";
import { useConfig } from "../../config/ConfigContext";
import type { LoanData } from "../../data/DataSource";
import { formatDate, formatDaysLeft, formatRub } from "../../ui/format";
import { ruralRules } from "./rules";
import { scrollToSection } from "./scroll";

type Props = { data: LoanData; status: LoanStatus; today: string; onLogin: () => void };

type Reminder = { id: string; urgent: boolean; title: string; text: string; section: string };

export function Reminders({ data, status, today, onLogin }: Props) {
  const { config, globals } = useConfig();
  const soon = config.after.reminderDays;

  if (data.kind !== "bank") {
    return (
      <section className="reminders reminders-guest" aria-label="Напоминания">
        <p>
          <strong>В личном кабинете данные подставятся сами.</strong> Банк знает ваш график, историю платежей и
          страховку — и заранее напомнит о платеже, продлении полиса и подтверждении занятости.
        </p>
        <button type="button" className="button button-secondary" onClick={onLogin}>
          Войти в кабинет →
        </button>
      </section>
    );
  }

  const items: Reminder[] = [];
  if (status.next) {
    const days = daysBetween(today, status.next.row.date);
    items.push({
      id: "payment",
      urgent: days <= 3,
      title: `Платёж ${formatRub(status.next.amount.value)}`,
      text: `${formatDate(status.next.row.date)} — ${formatDaysLeft(days)}`,
      section: "loan",
    });
  }

  if (data.program === "rural") {
    const o = ruralObligations(data.loan.issueDate, today, ruralRules(globals));
    if (o.nextCheck && o.daysToCheck !== null) {
      items.push({
        id: "employment",
        urgent: o.daysToCheck <= soon,
        title: "Подтвердите занятость",
        text: `до ${formatDate(o.nextCheck)} — ${formatDaysLeft(o.daysToCheck)}. Иначе ставка может вырасти`,
        section: "rural",
      });
    }
    if (o.nextRegistrationCheck && daysBetween(today, o.nextRegistrationCheck) <= soon) {
      items.push({
        id: "registration",
        urgent: true,
        title: "Подтвердите регистрацию в доме",
        text: `до ${formatDate(o.nextRegistrationCheck)} — ${formatDaysLeft(daysBetween(today, o.nextRegistrationCheck))}`,
        section: "rural",
      });
    }
  }

  if (data.insurance) {
    const days = daysBetween(today, data.insurance.endDate);
    items.push({
      id: "insurance",
      urgent: days <= soon,
      title: days < 0 ? "Полис страхования истёк" : days <= soon ? "Продлите страховку" : "Страховка действует",
      text: `${days < 0 ? "закончился" : "до"} ${formatDate(data.insurance.endDate)} — ${formatDaysLeft(days)}`,
      section: "insurance",
    });
  }

  // Срочное — наверх
  items.sort((a, b) => Number(b.urgent) - Number(a.urgent));

  return (
    <section className="reminders" aria-labelledby="reminders-heading">
      <h2 id="reminders-heading" className="panel-subtitle">
        Напоминания для вас
      </h2>
      <ul className="reminder-list">
        {items.map((r) => (
          <li key={r.id}>
            <a href={`#${r.section}`} className={`reminder${r.urgent ? " is-urgent" : ""}`} onClick={(e) => scrollToSection(e, r.section)}>
              <span className="reminder-mark" aria-hidden="true">
                {r.urgent ? "!" : "✓"}
              </span>
              <span>
                <strong>{r.title}</strong>
                <span className="reminder-text">{r.text}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
