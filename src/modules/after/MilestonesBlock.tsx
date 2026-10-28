// «Вехи кредита»: ключевые даты по графику — выдача, первый вычет, перелом «долг больше
// процентов», половина долга, конец обязательств по сельской ипотеке, последний платёж.
// Между прошедшими и будущими вехами — отметка «Вы здесь».

import { Fragment } from "react";
import { loanMilestones, type LoanStatus } from "../../core/loanStatus";
import { useConfig } from "../../config/ConfigContext";
import type { LoanData } from "../../data/DataSource";
import { formatDate } from "../../ui/format";
import { ruralRules } from "./rules";

type Props = { data: LoanData; status: LoanStatus; today: string };

export function MilestonesBlock({ data, status, today }: Props) {
  const { globals } = useConfig();
  const milestones = loanMilestones({
    contract: data.loan,
    status,
    today,
    rural: data.program === "rural" ? ruralRules(globals) : undefined,
    interestLimit: globals.interestLimit ?? Infinity,
  });
  // «Вы здесь» — перед первой будущей вехой
  const hereIndex = milestones.findIndex((m) => !m.past);

  return (
    <section className="feature" id="milestones" aria-labelledby="milestones-heading">
      <div className="feature-head">
        <p className="eyebrow">Ваш путь с ипотекой</p>
        <h2 id="milestones-heading">Вехи кредита</h2>
        <p className="feature-lead">Главные даты по вашему графику платежей: что уже позади и что впереди.</p>
      </div>

      <ol className="milestones">
        {milestones.map((m, i) => (
          <Fragment key={m.id}>
            {i === hereIndex && (
              <li className="milestone is-here" aria-label="Вы здесь">
                <span className="milestone-dot" aria-hidden="true" />
                <span className="milestone-date">{formatDate(today)}</span>
                <strong className="milestone-title">Вы здесь</strong>
              </li>
            )}
            <li className={`milestone${m.past ? " is-past" : ""}`}>
              <span className="milestone-dot" aria-hidden="true">
                {m.past ? "✓" : ""}
              </span>
              <span className="milestone-date">{formatDate(m.date)}</span>
              <strong className="milestone-title">{m.title}</strong>
              <span className="milestone-text">{m.text}</span>
            </li>
          </Fragment>
        ))}
      </ol>
    </section>
  );
}
