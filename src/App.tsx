import { Link, NavLink, Route, Routes } from "react-router-dom";
import { AdminPage } from "./modules/admin/AdminPage";
import { AfterPage } from "./modules/after/AfterPage";
import { NavigatorPage } from "./modules/navigator/NavigatorPage";
import { SimulatorPage } from "./modules/simulator/SimulatorPage";
import rshbLogo from "./assets/logo-rshb.svg";

const modules = [
  {
    path: "/navigator",
    number: "01",
    title: "Путь к своему дому",
    description:
      "Персональный маршрут от выбора объекта до сделки и обустройства.",
    linkText: "Собрать маршрут",
    label: "Навигатор",
  },
  {
    path: "/simulator",
    number: "02",
    title: "Что, если…?",
    description:
      "Сравните финансовые сценарии и разберитесь, как они повлияют на бюджет.",
    linkText: "Рассчитать сценарий",
    label: "Симулятор",
  },
  {
    path: "/after",
    number: "03",
    title: "Жизнь после ипотеки",
    description:
      "Кредит, досрочное погашение, вычеты и полезные напоминания в одном месте.",
    linkText: "Посмотреть сервисы",
    label: "После ипотеки",
  },
];

function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="Своё Жильё — на главную">
          <img className="brand-logo" src={rshbLogo} alt="Россельхозбанк" />
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-title">Своё Жильё</span>
        </Link>
        <nav className="main-nav" aria-label="Основная навигация">
          {modules.map((item) => (
            <NavLink
              key={item.path}
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link-active" : ""}`
              }
              to={item.path}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link className="admin-link" to="/admin">
          Админка
        </Link>
      </div>
    </header>
  );
}

function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Путь к своему дому начинается здесь</p>
          <h1>И к селу,<br />и к городу</h1>
          <p className="hero-description">
            Один понятный путь к своему жилью: от планирования бюджета до
            повседневных дел после сделки.
          </p>
          <Link className="button button-primary" to="/navigator">
            Начать путь <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun" />
          <div className="hill hill-back" />
          <div className="hill hill-front" />
          <div className="house">
            <div className="house-roof" />
            <div className="house-body">
              <span className="house-window" />
              <span className="house-door" />
            </div>
          </div>
          <div className="hero-note">
            <span className="note-mark">✓</span>
            <span>План, который подходит именно вам</span>
          </div>
        </div>
      </section>

      <section className="journey-section" aria-labelledby="journey-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Всё связано</p>
            <h2 id="journey-heading">Ваш путь к своему жилью</h2>
          </div>
          <p className="section-description">
            Три инструмента работают как один маршрут — с понятными шагами и
            прозрачными расчётами.
          </p>
        </div>
        <div className="module-grid">
          {modules.map((item) => (
            <article className="module-card" key={item.path}>
              <span className="card-number">{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <Link className="text-link" to={item.path}>
                {item.linkText} <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-note">
        <span className="trust-icon" aria-hidden="true">✳</span>
        <p>
          <strong>Не просто калькулятор.</strong> Продумайте свой сценарий,
          пройдите подходящие этапы и узнайте, что делать дальше.
        </p>
      </section>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="module-placeholder">
      <p className="eyebrow">Страница не найдена</p>
      <h1>Такого адреса пока нет</h1>
      <Link className="button button-primary" to="/">
        Вернуться на главную
      </Link>
    </main>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <Link className="footer-brand" to="/">
        Своё Жильё
      </Link>
      <p>
        Демо-прототип для конкурса РСХБ.Цифра. Не является официальным сервисом
        банка. Все ставки и цены условные.
      </p>
    </footer>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/navigator" element={<NavigatorPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        {/* key: публичный сайт и кабинет — разные экземпляры страницы со своим состоянием */}
        <Route path="/after" element={<AfterPage key="guest" mode="guest" />} />
        <Route path="/after/cabinet" element={<AfterPage key="client" mode="client" />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Footer />
    </div>
  );
}
