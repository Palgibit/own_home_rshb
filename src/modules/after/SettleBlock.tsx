// Обустройство: сервисы экосистемы «Своё» из конфига (список выбирает админ)

import { useConfig } from "../../config/ConfigContext";

export function SettleBlock() {
  const { config } = useConfig();
  const services = config.after.settleServices
    .map((id) => config.services.find((s) => s.id === id))
    .filter((s) => s !== undefined);

  return (
    <section className="feature" id="settle" aria-labelledby="settle-heading">
      <div className="feature-head">
        <p className="eyebrow">Экосистема «Своё»</p>
        <h2 id="settle-heading">Обустройство</h2>
        <p className="feature-lead">Дом куплен — дальше сад, соседи, свежие продукты. Всё это есть у банка.</p>
      </div>
      <div className="service-grid">
        {services.map((s) =>
          s.href ? (
            <a key={s.id} className="service-card" href={s.href} target="_blank" rel="noreferrer">
              <strong>{s.title}</strong>
              <span>{s.description}</span>
              <span className="text-link">
                Перейти <span aria-hidden="true">↗</span>
              </span>
            </a>
          ) : (
            <div key={s.id} className="service-card is-stub" title="Ссылка-заглушка в демо">
              <strong>{s.title}</strong>
              <span>{s.description}</span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
