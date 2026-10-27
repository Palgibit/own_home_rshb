// Модуль 1. Симулятор «Что, если…?»
// Страница хранит только ввод пользователя; все расчёты — в core/.
// Сценарий можно открыть ссылкой: #/simulator?scenario=lose-benefit (так ведёт навигатор).
// Без ?scenario= симулятор открывается на «Только мой кредит».

import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { EarlyMode } from "../../core/annuity";
import { applyScenario, computeMetrics, type ScenarioResult } from "../../core/scenarios";
import { useConfig } from "../../config/ConfigContext";
import { PROGRAM_RATE_PARAM } from "../../config/schema";
import { BalanceChart } from "./BalanceChart";
import { BaseLoanForm } from "./BaseLoanForm";
import { CityVsVillageBlock } from "./CityVsVillageBlock";
import { CoffeeBlock } from "./CoffeeBlock";
import { DepositVsEarlyBlock } from "./DepositVsEarlyBlock";
import { MoneyBar } from "./MoneyBar";
import { PlanBlock } from "./PlanBlock";
import { buildPurchase, choiceDefaults } from "./purchaseModel";
import { RealPaymentBlock } from "./RealPaymentBlock";
import { ResultCards } from "./ResultCards";
import { ScenarioPanel } from "./ScenarioPanel";
import type { BaseInput, PurchaseChoice } from "./types";
import { YearlyChart } from "./YearlyChart";
import "./simulator.css";

const SECTIONS = [
  ["scenarios", "Мой кредит и сценарии"],
  ["plan", "План досрочек"],
  ["deposit", "Досрочка или вклад"],
  ["city-village", "Город или село"],
  ["more", "Ещё расчёты"],
] as const;

// Результат без сценария — только «как есть»
type Computed = { result: Pick<ScenarioResult, "before"> & Partial<ScenarioResult> } | { error: string };

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
      price: sim.price,
      downPayment: sim.downPayment,
      ratePct: globals[PROGRAM_RATE_PARAM[program]] ?? 0,
      years: sim.years,
      income: sim.income,
      expenses: sim.expenses,
    };
  });
  const [choice, setChoice] = useState<PurchaseChoice>(() => choiceDefaults(config));

  // Значения параметров по сценариям: { "early-payment": { X: 500000, k: 12 }, … }
  const [paramValues, setParamValues] = useState<Record<string, Record<string, number>>>({});
  const [earlyMode, setEarlyMode] = useState<EarlyMode>("term");
  const [chart, setChart] = useState<"balance" | "yearly">("balance");

  const scenarios = config.scenarios.filter((s) => !s.onlyFor || s.onlyFor === base.program);
  const scenario = scenarios.find((s) => s.id === requestedId) ?? null;

  // Ставка со скидками, сумма кредита, страховка — из стоимости, взноса и галочек
  const purchase = useMemo(() => buildPurchase(base, choice, config, globals), [base, choice, config, globals]);
  const { loan, insurance } = purchase;
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
  const computed = useMemo((): Computed => {
    if (!scenario) return { result: { before: computeMetrics(loan, household, {}, undefined, insurance) } };
    try {
      return {
        result: applyScenario({ scenario, loan, household, params, globals, globalLabels: labels, earlyMode, insurance }),
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [scenario, loan, household, params, globals, labels, earlyMode, insurance]);

  const selectScenario = (id: string | null) => setSearchParams(id ? { scenario: id } : {}, { replace: true });

  const openScenario = (id: string) => {
    selectScenario(id);
    document.getElementById("scenarios")?.scrollIntoView({ behavior: "smooth" });
  };

  const setParam = (id: string, value: number) =>
    scenario && setParamValues((all) => ({ ...all, [scenario.id]: { ...all[scenario.id], [id]: value } }));

  const result = "result" in computed ? computed.result : null;
  const ownMoney = base.downPayment + purchase.deals.reduce((s, c) => s + c.amount, 0);

  return (
    <main className="sim-page">
      <Link className="back-link" to="/">
        <span aria-hidden="true">←</span> На главную
      </Link>
      <p className="eyebrow">Финансовые сценарии</p>
      <h1 className="page-title">Что, если…?</h1>
      <p className="page-lead">
        Посчитайте свой кредит и меняйте условия: как изменятся платёж, срок, переплата и бюджет. Нажмите на любое
        подчёркнутое число — покажем, как оно посчитано.
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
          <BaseLoanForm value={base} onChange={setBase} choice={choice} onChoice={setChoice} purchase={purchase} />
          <ScenarioPanel
            scenarios={scenarios}
            scenario={scenario}
            onSelect={selectScenario}
            params={params}
            onParam={setParam}
            earlyMode={earlyMode}
            onEarlyMode={setEarlyMode}
          />
        </div>

        <div className="sim-main">
          {"error" in computed && <p className="note note-warn">Не получилось посчитать сценарий: {computed.error}</p>}
          {result && (
            <>
              <h2 className="results-title">{scenario ? `${scenario.title}: было → стало` : "Ваш кредит"}</h2>
              <ResultCards result={result} earlyMode={earlyMode} />
              <MoneyBar before={result.before} after={result.after} ownMoney={ownMoney} loanBase={purchase.loanBase} />

              <section className="panel" aria-labelledby="chart-heading">
                <div className="chart-head">
                  <h3 id="chart-heading" className="panel-subtitle">
                    {chart === "yearly"
                      ? `Платёж по годам${scenario ? `: ${scenario.title}` : ""}`
                      : scenario
                        ? `Остаток долга: ${scenario.title}`
                        : "Остаток долга по графику"}
                  </h3>
                  <div className="segmented" role="radiogroup" aria-label="График">
                    {(
                      [
                        ["balance", "Остаток долга"],
                        ["yearly", "Платёж по годам"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={chart === id}
                        className={`segmented-item${chart === id ? " is-active" : ""}`}
                        onClick={() => setChart(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {chart === "balance" ? (
                  <BalanceChart
                    before={result.before.schedule}
                    after={result.after?.schedule}
                    beforeLabel={scenario ? "Без изменений" : "Остаток долга"}
                    afterLabel="С учётом сценария"
                  />
                ) : (
                  <YearlyChart metrics={result.after ?? result.before} />
                )}
              </section>
            </>
          )}
        </div>
      </section>

      <PlanBlock loan={loan} household={household} insurance={insurance} />
      <DepositVsEarlyBlock loan={loan} program={base.program} onOpenScenario={openScenario} />
      <CityVsVillageBlock income={base.income} expenses={base.expenses} months={loan.months} />

      {/* Второстепенные расчёты свёрнуты: открываются по клику, чтобы не спорить за внимание с главными */}
      <section className="feature" id="more" aria-labelledby="more-heading">
        <div className="feature-head">
          <h2 id="more-heading">Ещё расчёты</h2>
        </div>
        <div className="more-list">
          <details className="more-item">
            <summary>
              <span className="more-title">Доплачивать понемногу каждый месяц</span>
              <span className="more-hint">Насколько раньше закроете кредит, если добавлять к платежу пару тысяч</span>
            </summary>
            <CoffeeBlock loan={loan} />
          </details>
          {result && (
            <details className="more-item">
              <summary>
                <span className="more-title">Сколько на самом деле стоит платёж</span>
                <span className="more-hint">Платёж по договору не меняется, а деньги дешевеют — сколько он весит в сегодняшних рублях</span>
              </summary>
              <RealPaymentBlock payment={result.before.payment.value} years={Math.ceil(loan.months / 12)} />
            </details>
          )}
        </div>
      </section>
    </main>
  );
}
