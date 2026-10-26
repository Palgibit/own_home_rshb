// «Мой кредит»: остаток, следующий платёж, прогресс, уплаченные проценты,
// ближайшие платежи. У клиента — ещё история платежей из банка.

import type { LoanStatus } from "../../core/loanStatus";
import { PROGRAMS } from "../../config/schema";
import type { LoanData } from "../../data/DataSource";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { formatDate, formatMonths, formatPct, formatRub } from "../../ui/format";

const HISTORY_ROWS = 6;

export function MyLoanBlock({ data, status }: { data: LoanData; status: LoanStatus }) {
  const { loan } = data;
  const closed = !status.next;
  const left = status.schedule.months - status.paid;

  return (
    <section className="feature" id="loan" aria-labelledby="loan-heading">
      <div className="feature-head">
        <p className="eyebrow">{data.propertyTitle}</p>
        <h2 id="loan-heading">Мой кредит</h2>
        <p className="feature-lead">
          {PROGRAMS[data.program]}, {formatRub(loan.principal)} под {formatPct(loan.ratePct)} на{" "}
          {formatMonths(loan.months)}. Выдан {formatDate(loan.issueDate)}
          {data.owner && `, договор ${data.owner.contractNo}`}.
        </p>
      </div>

      {closed ? (
        <p className="note">Кредит погашен — поздравляем! Справку о закрытии кредита можно запросить в банке.</p>
      ) : (
        <>
          <div className="metric-grid">
            <div className="metric-card">
              <p className="metric-label">Остаток долга</p>
              <span className="metric-after">
                <ExplainableNumber value={status.balance} />
              </span>
              <span className="metric-extra">из {formatRub(loan.principal)}</span>
            </div>
            <div className="metric-card">
              <p className="metric-label">Следующий платёж</p>
              <span className="metric-after">
                <ExplainableNumber value={status.next!.amount} />
              </span>
              <span className="metric-extra">{formatDate(status.next!.row.date)}</span>
            </div>
            <div className="metric-card">
              <p className="metric-label">Погашено долга</p>
              <span className="metric-after">
                <ExplainableNumber value={status.progress} format="pct" />
              </span>
              <span className="progress" role="presentation">
                <span style={{ width: `${Math.min(100, status.progress.value)}%` }} />
              </span>
            </div>
            <div className="metric-card">
              <p className="metric-label">Уплачено процентов</p>
              <span className="metric-after">
                <ExplainableNumber value={status.interestPaid} />
              </span>
              <span className="metric-extra">можно заявить к вычету</span>
            </div>
          </div>
          <p className="field-hint after-endline">
            Последний платёж по графику — {formatDate(status.endDate)}, осталось {formatMonths(left)}.
          </p>
        </>
      )}

      <div className="feature-grid after-tables">
        {!closed && (
          <div className="panel">
            <h3 className="panel-subtitle">Ближайшие платежи</h3>
            <div className="table-scroll">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Платёж</th>
                    <th>Проценты</th>
                    <th>Долг</th>
                  </tr>
                </thead>
                <tbody>
                  {status.upcoming.map((r) => (
                    <tr key={r.month}>
                      <th>{formatDate(r.date)}</th>
                      <td>{formatRub(r.payment)}</td>
                      <td>{formatRub(r.interest)}</td>
                      <td>{formatRub(r.principal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="panel">
          <h3 className="panel-subtitle">История платежей</h3>
          {data.history ? (
            <>
              <ul className="history-list">
                {data.history.slice(0, HISTORY_ROWS).map((p) => (
                  <li key={`${p.date}-${p.kind}`}>
                    <span>
                      {formatDate(p.date)}
                      {p.kind === "early" && <span className="history-tag">досрочно</span>}
                    </span>
                    <span className="history-amount">
                      {formatRub(p.amount)} <span className="history-ok">✓</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="field-hint">
                Всего внесено платежей: {data.history.length}. Данные из банковского контура.
              </p>
            </>
          ) : (
            <p className="scenario-description">
              Историю платежей знает только банк. В личном кабинете здесь будет каждый платёж — с датой, суммой и
              досрочными погашениями.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
