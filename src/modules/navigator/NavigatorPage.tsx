// Модуль 2. Навигатор «Путь к своему дому».
// Страница хранит ответы и отметки «сделано»; маршрут собирает ядро (core/navigator).
// Ссылки: #/navigator?preset=rural-construction — открыть типовой сценарий,
//         #/navigator?view=matrix — сразу показать матрицу «шаг × сценарий».

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  activeAnswers,
  buildRoute,
  normalizeAnswers,
  type Adjustment,
  type Answers,
} from "../../core/navigator";
import { useConfig } from "../../config/ConfigContext";
import { MatrixView } from "./MatrixView";
import { QuestionsPanel } from "./QuestionsPanel";
import { Timeline } from "./Timeline";
import "./navigator.css";

const STORAGE_KEY = "svoe-zhilyo:navigator";

type Saved = { answers: Answers; done: string[] };

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(data: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // хранилище недоступно — прогресс просто не запомнится
  }
}

export function NavigatorPage() {
  const { config } = useConfig();
  const nav = config.navigator;
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "matrix" ? "matrix" : "route";

  // Старт: типовой сценарий из ссылки → сохранённые ответы → первый типовой сценарий.
  // Ответы всегда пропускаем через normalizeAnswers: конфиг мог измениться.
  const [answers, setAnswers] = useState<Answers>(() => {
    const fromLink = nav.presets.find((p) => p.id === searchParams.get("preset"))?.answers;
    const start = fromLink ?? loadSaved()?.answers ?? nav.presets[0]?.answers ?? {};
    return normalizeAnswers(nav, start).answers;
  });
  const [done, setDone] = useState<string[]>(() => loadSaved()?.done ?? []);
  const [adjusted, setAdjusted] = useState<Adjustment[]>([]);

  useEffect(() => save({ answers, done }), [answers, done]);

  const route = useMemo(() => buildRoute(nav, answers), [nav, answers]);
  const active = useMemo(() => activeAnswers(nav, answers), [nav, answers]);

  // Какой типовой сценарий сейчас выбран (если ответы совпадают с ним)
  const currentPreset = nav.presets.find((p) => {
    const presetActive = activeAnswers(nav, p.answers);
    const keys = new Set([...Object.keys(presetActive), ...Object.keys(active)]);
    return [...keys].every((k) => presetActive[k] === active[k]);
  });

  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next, { replace: true });
  };

  const applyAnswers = (next: Answers) => {
    const normalized = normalizeAnswers(nav, next);
    setAnswers(normalized.answers);
    setAdjusted(normalized.adjusted);
    setQuery({ preset: null });
  };

  const choosePreset = (id: string) => {
    const preset = nav.presets.find((p) => p.id === id);
    if (!preset) return;
    applyAnswers(preset.answers);
    setQuery({ preset: null, view: null });
  };

  const toggleDone = (id: string) =>
    setDone((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <main className="nav-page">
      <Link className="back-link" to="/">
        <span aria-hidden="true">←</span> На главную
      </Link>
      <p className="eyebrow">Ваш маршрут</p>
      <h1 className="page-title">Путь к своему дому</h1>
      <p className="page-lead">
        Ответьте на пару вопросов — соберём маршрут от выбора объекта до новоселья. Поменяйте ответ, и увидите, какие
        шаги появятся, а какие исчезнут.
      </p>

      <div className="segmented nav-tabs" role="tablist" aria-label="Вид">
        {(
          [
            ["route", "Мой маршрут"],
            ["matrix", "Шаги × сценарии"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={`segmented-item${view === id ? " is-active" : ""}`}
            onClick={() => setQuery({ view: id === "matrix" ? "matrix" : null })}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "route" ? (
        <section className="nav-grid">
          <QuestionsPanel
            nav={nav}
            answers={answers}
            currentPresetId={currentPreset?.id}
            adjusted={adjusted}
            onAnswer={(q, o) => applyAnswers({ ...answers, [q]: o })}
            onPreset={choosePreset}
          />
          <Timeline stages={nav.stages} stepIds={nav.steps.map((s) => s.id)} route={route} done={done} onToggle={toggleDone} services={config.services} />
        </section>
      ) : (
        <MatrixView nav={nav} currentPresetId={currentPreset?.id} onOpenPreset={choosePreset} />
      )}
    </main>
  );
}
