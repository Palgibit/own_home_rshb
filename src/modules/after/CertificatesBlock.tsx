// Справки. Клиент заказывает справку — в демо заявка создаётся и запоминается
// в браузере, но никуда не отправляется. Гость видит, какие справки есть,
// и приглашение войти: справки выдают по договору, без входа их не заказать.

import { useState } from "react";
import { addDays, interestByYear, type LoanStatus } from "../../core/loanStatus";
import { useConfig } from "../../config/ConfigContext";
import type { LoanData } from "../../data/DataSource";
import { formatDate } from "../../ui/format";

type Request = { no: string; certId: string; year?: number; delivery: "cabinet" | "email"; created: string; ready: string };

const keyFor = (clientId: string) => `svoe-zhilyo:certificates:${clientId}`;

function loadRequests(clientId: string): Request[] {
  try {
    return JSON.parse(localStorage.getItem(keyFor(clientId)) ?? "[]") as Request[];
  } catch {
    return [];
  }
}

type Props = { data: LoanData; status: LoanStatus; today: string; onLogin: () => void };

export function CertificatesBlock({ data, status, today, onLogin }: Props) {
  const { config } = useConfig();
  const certs = config.after.certificates;
  const clientId = data.owner?.id;
  const years = interestByYear(status, data.loan.issueDate).map((y) => y.year);

  const [certId, setCertId] = useState(certs[0]?.id ?? "");
  const [year, setYear] = useState(years[years.length - 1] ?? Number(today.slice(0, 4)));
  const [delivery, setDelivery] = useState<Request["delivery"]>("cabinet");
  const [requests, setRequests] = useState<Request[]>(() => (clientId ? loadRequests(clientId) : []));

  const selected = certs.find((c) => c.id === certId);

  const order = () => {
    if (!clientId || !selected) return;
    const request: Request = {
      no: `СП-${String(Date.now()).slice(-6)}`, // номер заявки — условный
      certId: selected.id,
      year: selected.byYear ? year : undefined,
      delivery,
      created: today,
      ready: addDays(today, selected.days),
    };
    const next = [request, ...requests];
    setRequests(next);
    try {
      localStorage.setItem(keyFor(clientId), JSON.stringify(next));
    } catch {
      // не запомним — не страшно, это демо
    }
  };

  return (
    <section className="feature" id="certificates" aria-labelledby="cert-heading">
      <div className="feature-head">
        <p className="eyebrow">Документы</p>
        <h2 id="cert-heading">Справки</h2>
        <p className="feature-lead">Закажите справку онлайн — без визита в офис.</p>
      </div>

      <div className="feature-grid">
        <div className="panel">
          <div className="cert-list" role="radiogroup" aria-label="Какая справка нужна">
            {certs.map((c) => (
              <label key={c.id} className={`cert-option${certId === c.id ? " is-active" : ""}`}>
                <input type="radio" name="certificate" value={c.id} checked={certId === c.id} onChange={() => setCertId(c.id)} />
                <span>
                  <strong>{c.title}</strong>
                  <span className="cert-description">{c.description}</span>
                </span>
              </label>
            ))}
          </div>

          {clientId ? (
            <>
              <div className="form-grid">
                {selected?.byYear && years.length > 0 && (
                  <label className="field">
                    <span className="field-label">За какой год</span>
                    <select className="field-box field-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="field">
                  <span className="field-label">Куда прислать</span>
                  <div className="segmented" role="group" aria-label="Куда прислать">
                    {(["cabinet", "email"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`segmented-item${delivery === d ? " is-active" : ""}`}
                        aria-pressed={delivery === d}
                        onClick={() => setDelivery(d)}
                      >
                        {d === "cabinet" ? "В кабинет" : "На e-mail"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" className="button button-primary" onClick={order}>
                Заказать справку
              </button>
              <p className="field-hint">Демо: заявка создаётся, но в банк не отправляется.</p>
            </>
          ) : (
            <div className="note note-action">
              <p>Справки выдают по кредитному договору — заказать их можно в личном кабинете.</p>
              <button type="button" className="button button-secondary" onClick={onLogin}>
                Войти и заказать →
              </button>
            </div>
          )}
        </div>

        {clientId && (
          <div className="panel">
            <h3 className="panel-subtitle">Мои заявки</h3>
            {requests.length === 0 ? (
              <p className="scenario-description">Пока нет заявок.</p>
            ) : (
              <ul className="history-list">
                {requests.map((r) => {
                  const cert = certs.find((c) => c.id === r.certId);
                  const ready = r.ready <= today;
                  return (
                    <li key={r.no}>
                      <span>
                        <strong>{cert?.title ?? r.certId}</strong>
                        {r.year && ` за ${r.year}`}
                        <span className="reminder-text">
                          {r.no} · {r.delivery === "cabinet" ? "в кабинет" : "на e-mail"}
                        </span>
                      </span>
                      <span className={ready ? "history-ok" : "cert-status"}>
                        {ready ? "Готова ✓" : `Будет готова ${formatDate(r.ready)}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
