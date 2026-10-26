// Модуль 1. Симулятор «Что, если…?»
// Страница хранит только ввод пользователя; все расчёты — в core/.
// Сценарий можно открыть ссылкой: #/simulator?scenario=lose-benefit (так ведёт навигатор).

import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { EarlyMode, Loan } from "../../core/annuity";
import { applyScenario, type ScenarioResult } from "../../core/scenarios";
import { useConfig } from "../../config/ConfigContext";
import { PROGRAM_RATE_PARAM } from "../../config/schema";
import { BalanceChart } from "./BalanceChart";
import { BaseLoanForm } from "./BaseLoanForm";
import { CityVsVillageBlock } from "./CityVsVillageBlock";
import { CoffeeBlock } from "./CoffeeBlock";
import { DepositVsEarlyBlock } from "./DepositVsEarlyBlock";
import { RealPaymentBlock } from "./RealPaymentBlock";
import { ResultCards } from "./ResultCards";
import { ScenarioPanel } from "./ScenarioPanel";
import type { BaseInput } from "./types";
import "./simulator.css";

const SECTIONS = [
  ["scenarios", "Сценарии"],
  ["deposit", "Досрочка или вклад"],
  ["coffee", "Чашка кофе"],
  ["real", "Реальный платёж"],
  ["city-village", "Город или село"],
] as const;

export function SimulatorPage() {
  const { config, globals, labels } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("scenario");

  const [base, setBase] = useState<BaseInput>(() => {
    const sim = config.simulator;
    // Если по ссылке пришёл сценарий только для одной программы — сразу включаем её
    const requested = config.scenarios.find((s) => s.id === requestedId);
    const program = requested?.onlyFor ?? sim.program;
    return {
      program,
      principal: sim.principal,
      ratePct: globals[PROGRAM_RATE_PARAM[program]] ?? 0,
      years: sim.years,
      income: sim.income,
      expenses: sim.expenses,
    };
  });

  // Значения параметров по сценариям: { "early-payment": { X: 500000, k: 12 }, … }
  const [paramValues, setParamValues] = useState<Record<string, Record<string, number>>>({});
  const [earlyMode, setEarlyMode] = useState<EarlyMode>("term");

  const scenarios = config.scenarios.filter((s) => !s.onlyFor || s.onlyFor === base.program);
  const scenario = scenarios.find((s) => s.id === requestedId) ?? scenarios[0];

  const loan: Loan = useMemo(
    () => ({ principal: base.principal, ratePct: base.ratePct, months: Math.max(1, Math.round(base.years * 12)) }),
    [base.principal, base.ratePct, base.years],
  );
  const household = useMemo(() => ({ income: base.income, expenses: base.expenses }), [base.income, base.expenses]);

  const params = useMemo(
    () =>
      scenario
        ? Object.fromEntries(scenario.params.map((p) => [p.id, paramValues[scenario.id]?.[p.id] ?? p.default]))
        : {},
    [scenario, paramValues],
  );

  // Формулы сценария проверены при сохранении конфига, но на всякий случай
  // ловим ошибку вычисления, чтобы страница не падала целиком
  const computed = useMemo((): { result: ScenarioResult } | { error: string } | null => {
    if (!scenario) return null;
    try {
      return {
        result: applyScenario({ scenario, loan, household, params, globals, globalLabels: labels, earlyMode }),
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [scenario, loan, household, params, globals, labels, earlyMode]);

  const selectScenario = (id: string) => setSearchParams({ scenario: id }, { replace: true });

  const openScenario = (id: string) => {
    selectScenario(id);
    document.getElementById("scenarios")?.scrollIntoView({ behavior: "smooth" });
  };

  const setParam = (id: string, value: number) =>
    scenario && setParamValues((all) => ({ ...all, [scenario.id]: { ...all[scenario.id], [id]: value } }));

  const result = computed && "result" in computed ? computed.result : null;

  return (
    <main className="sim-page">
      <Link className="back-link" to="/">
        <span aria-hidden="true">←</span> На главную
      </Link>
      <p className="eyebrow">Финансовые сценарии</p>
      <h1 className="page-title">Что, если…?</h1>
      <p className="page-lead">
        Меняйте условия и смотрите, как изменятся платёж, срок, переплата и бюджет. Нажмите на любое подчёркнутое
        число — покажем, как оно посчитано.
      </p>

      <nav className="sim-nav" aria-label="Разделы симулятора">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={(e) => {
            // Якоря через JS: в адресе уже есть # от HashRouter
            e.preventDefault();
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
          }}>
            {label}
          </a>
        ))}
      </nav>

      <section className="sim-grid" id="scenarios">
        <div className="sim-side">
          <BaseLoanForm value={base} onChange={setBase} />
          {scenario && (
            <ScenarioPanel
              scenarios={scenarios}
              scenario={scenario}
              onSelect={selectScenario}
              params={params}
              onParam={setParam}
              earlyMode={earlyMode}
              onEarlyMode={setEarlyMode}
            />
          )}
        </div>

        <div className="sim-main">
          {!scenario && <p className="note note-warn">Нет доступных сценариев. Добавьте их в админке.</p>}
          {computed && "error" in computed && (
            <p className="note note-warn">Не получилось посчитать сценарий: {computed.error}</p>
          )}
          {result && (
            <>
              <h2 className="results-title">{scenario?.title}: было → стало</h2>
              <ResultCards result={result} earlyMode={earlyMode} />
              <BalanceChart principal={loan.principal} before={result.before.schedule} after={result.after.schedule} />
            </>
          )}
        </div>
      </section>

      <DepositVsEarlyBlock loan={loan} program={base.program} onOpenScenario={openScenario} />
      <CoffeeBlock loan={loan} />
      {result && <RealPaymentBlock payment={result.before.payment.value} years={Math.ceil(loan.months / 12)} />}
      <CityVsVillageBlock income={base.income} expenses={base.expenses} months={loan.months} />
    </main>
  );
}
