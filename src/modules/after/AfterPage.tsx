// Модуль 3. «Жизнь после ипотеки».
// Один интерфейс, два источника данных:
//   #/after          — публичный сайт: гость смотрит демо-кредит или вводит свой;
//   #/after/cabinet  — личный кабинет: вход демо-клиентом, данные из «банковского контура»;
//   #/after/cabinet?as=sokolova — сразу войти демо-клиентом (ссылка для жюри).
// Блоки модуля получают только LoanData и не знают, откуда она пришла.

import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { loanStatus } from "../../core/loanStatus";
import { useConfig } from "../../config/ConfigContext";
import { bankClients, bankSource } from "../../data/bankMock";
import { todayIso, type DataSource } from "../../data/DataSource";
import { demoInput, demoSource, manualSource } from "../../data/guest";
import { ChangeLoanBlock } from "./ChangeLoanBlock";
import { CertificatesBlock } from "./CertificatesBlock";
import { ClientBar, GuestSourcePanel, type GuestState } from "./SourcePanels";
import { InsuranceBlock } from "./InsuranceBlock";
import { LoginPanel } from "./LoginPanel";
import { MyLoanBlock } from "./MyLoanBlock";
import { Reminders } from "./Reminders";
import { RuralBlock } from "./RuralBlock";
import { SettleBlock } from "./SettleBlock";
import { TaxBlock } from "./TaxBlock";
import { useLoanData } from "./useLoanData";
import { scrollToSection } from "./scroll";
import "../simulator/simulator.css";
import "./after.css";

export type AfterMode = "guest" | "client";

const SESSION_KEY = "svoe-zhilyo:session"; // id вошедшего демо-клиента
const GUEST_KEY = "svoe-zhilyo:after-guest"; // выбор и ввод гостя

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // хранилище недоступно — просто не запомним
  }
}

export function AfterPage({ mode }: { mode: AfterMode }) {
  const { config } = useConfig();
  const navigate = useNavigate();
  const today = useMemo(todayIso, []);
  const demo = config.after.guestDemo;

  const [searchParams] = useSearchParams();
  const [clientId, setClientId] = useState<string | null>(() => {
    const fromLink = searchParams.get("as");
    if (fromLink && bankClients().some((c) => c.id === fromLink)) {
      writeStorage(SESSION_KEY, fromLink);
      return fromLink;
    }
    return readStorage<string>(SESSION_KEY);
  });
  const [guest, setGuest] = useState<GuestState>(
    () => readStorage<GuestState>(GUEST_KEY) ?? { source: "demo", input: demoInput(demo, today) },
  );
  useEffect(() => writeStorage(GUEST_KEY, guest), [guest]);

  const login = (id: string) => {
    writeStorage(SESSION_KEY, id);
    setClientId(id);
  };
  const logout = () => {
    writeStorage(SESSION_KEY, null);
    setClientId(null);
  };

  // Источник данных выбирается здесь — и только здесь
  const source = useMemo<DataSource | null>(() => {
    if (mode === "client") return clientId ? bankSource(clientId) : null;
    return guest.source === "demo" ? demoSource(demo) : manualSource(guest.input);
  }, [mode, clientId, guest, demo]);

  const { data, loading, error } = useLoanData(source, today);
  const status = useMemo(() => (data ? loanStatus(data.loan, today) : null), [data, today]);

  const sections = [
    ["loan", "Мой кредит"],
    ...(data?.program === "rural" ? [["rural", "Сельская ипотека"]] : []),
    ["early", "Досрочка"],
    ["tax", "Налоговый вычет"],
    ["certificates", "Справки"],
    ["insurance", "Страхование"],
    ["settle", "Обустройство"],
  ];

  return (
    <main className="sim-page after-page">
      <Link className="back-link" to="/">
        <span aria-hidden="true">←</span> На главную
      </Link>
      <p className="eyebrow">Всё для вашего дома</p>
      <h1 className="page-title">Жизнь после ипотеки</h1>
      <p className="page-lead">
        Остаток и платежи, досрочное погашение, налоговый вычет, справки и страховка — в одном месте. Нажмите на любое
        подчёркнутое число — покажем, как оно посчитано.
      </p>

      <nav className="after-modes" aria-label="Где открыт модуль">
        <NavLink end to="/after" className={({ isActive }) => `after-mode${isActive ? " is-active" : ""}`}>
          <strong>Публичный сайт</strong>
          <span>Гость: демо-кредит или ручной ввод</span>
        </NavLink>
        <NavLink to="/after/cabinet" className={({ isActive }) => `after-mode${isActive ? " is-active" : ""}`}>
          <strong>Личный кабинет</strong>
          <span>Клиент: данные из банка и напоминания</span>
        </NavLink>
      </nav>

      {mode === "guest" && <GuestSourcePanel value={guest} onChange={setGuest} today={today} />}
      {mode === "client" && !clientId && <LoginPanel onLogin={login} />}
      {mode === "client" && clientId && <ClientBar data={data} loading={loading} onLogout={logout} />}

      {error && <p className="note note-warn">Не удалось загрузить данные: {error}</p>}
      {mode === "client" && clientId && loading && !data && (
        <p className="note after-loading">Подключаемся к банковскому контуру…</p>
      )}

      {data && status && (
        // key: при смене клиента или источника локальные поля блоков начинаются заново
        <div key={`${data.kind}-${data.owner?.id ?? ""}`} className={loading ? "after-content is-loading" : "after-content"}>
          <Reminders data={data} status={status} today={today} onLogin={() => navigate("/after/cabinet")} />

          <nav className="sim-nav" aria-label="Разделы модуля">
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={(e) => scrollToSection(e, id)}>
                {label}
              </a>
            ))}
          </nav>

          <MyLoanBlock data={data} status={status} />
          {data.program === "rural" && <RuralBlock data={data} status={status} today={today} />}
          <ChangeLoanBlock data={data} status={status} />
          <TaxBlock data={data} status={status} />
          <CertificatesBlock data={data} status={status} today={today} onLogin={() => navigate("/after/cabinet")} />
          <InsuranceBlock data={data} today={today} />
          <SettleBlock />
        </div>
      )}
    </main>
  );
}
