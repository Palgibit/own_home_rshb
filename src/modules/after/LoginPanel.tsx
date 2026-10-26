// Имитация входа в личный кабинет: выбираем одного из демо-клиентов «банка».
// Настоящей авторизации нет — это демо (так и написано в README).

import { PROGRAMS } from "../../config/schema";
import { bankClients } from "../../data/bankMock";

export function LoginPanel({ onLogin }: { onLogin: (id: string) => void }) {
  return (
    <section className="panel" aria-labelledby="login-heading">
      <h2 id="login-heading" className="panel-title">
        Вход в личный кабинет
      </h2>
      <p className="scenario-description">
        Это имитация входа: выберите демо-клиента. Его кредит, график, история платежей и страховка придут из
        «банковского контура» — вводить ничего не нужно.
      </p>
      <div className="login-grid">
        {bankClients().map((c) => (
          <button key={c.id} type="button" className="login-card" onClick={() => onLogin(c.id)}>
            <span className="client-avatar" aria-hidden="true">
              {c.name.charAt(0)}
            </span>
            <strong>{c.name}</strong>
            <span className="login-program">{PROGRAMS[c.program]}</span>
            <span className="login-object">{c.propertyTitle}</span>
            <span className="text-link">
              Войти <span aria-hidden="true">→</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
