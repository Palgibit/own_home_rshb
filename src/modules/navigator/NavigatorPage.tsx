// Модуль 2. Навигатор «Путь к своему дому».
// Страница хранит ответы и отметки «сделано»; маршрут собирает ядро (core/navigator).
// Ссылка #/navigator?preset=rural-construction открывает типовой сценарий.
// Матрица «шаг × сценарий» — в панели администратора, вкладка «Навигатор».

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
import { PresetsBar } from "./PresetsBar";
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
        Выберите похожий сценарий или ответьте на пару вопросов — соберём маршрут от выбора объекта до новоселья.
      </p>

      <PresetsBar nav={nav} currentPresetId={currentPreset?.id} onPreset={choosePreset} />

      <section className="nav-grid">
        <QuestionsPanel nav={nav} answers={answers} adjusted={adjusted} onAnswer={(q, o) => applyAnswers({ ...answers, [q]: o })} />
        <Timeline stages={nav.stages} stepIds={nav.steps.map((s) => s.id)} route={route} done={done} onToggle={toggleDone} services={config.services} />
      </section>
    </main>
  );
}
