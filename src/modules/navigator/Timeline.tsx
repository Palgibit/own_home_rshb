// Таймлайн маршрута: этапы и шаги с отметками «сделано».
// При смене ответов новые шаги плавно появляются, ушедшие — плавно исчезают,
// а сверху видно, сколько шагов добавилось и убралось.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { RouteStep, Stage } from "../../core/navigator";
import type { ServiceDef } from "../../config/schema";
import { plural } from "../../ui/format";
import { TemplateText } from "../../ui/TemplateText";

const LEAVE_MS = 360; // совпадает с длительностью анимации .is-leaving в navigator.css

type Props = {
  stages: Stage[];
  stepIds: string[]; // порядок шагов в конфиге
  route: RouteStep[];
  done: string[];
  onToggle: (stepId: string) => void;
  services: ServiceDef[];
};

type Change = { added: RouteStep[]; removed: RouteStep[] };

// Держит ушедшие шаги на экране, пока проигрывается анимация исчезновения
function useLeavingSteps(route: RouteStep[]) {
  const prev = useRef(route);
  const timers = useRef<number[]>([]);
  const [leaving, setLeaving] = useState<RouteStep[]>([]);
  const [change, setChange] = useState<Change | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = route;
    if (before === route) return;
    const nowIds = new Set(route.map((r) => r.step.id));
    const beforeIds = new Set(before.map((r) => r.step.id));
    const removed = before.filter((r) => !nowIds.has(r.step.id));
    const added = route.filter((r) => !beforeIds.has(r.step.id));
    setChange(added.length || removed.length ? { added, removed } : null);
    if (!removed.length) {
      setLeaving((list) => list.filter((r) => !nowIds.has(r.step.id)));
      return;
    }
    const removedIds = new Set(removed.map((r) => r.step.id));
    setLeaving((list) => [...list.filter((r) => !nowIds.has(r.step.id) && !removedIds.has(r.step.id)), ...removed]);
    timers.current.push(window.setTimeout(() => setLeaving((list) => list.filter((r) => !removed.includes(r))), LEAVE_MS));
  }, [route]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return { leaving, change };
}

const stepsWord = (n: number) => `${n} ${plural(n, ["шаг", "шага", "шагов"])}`;

export function Timeline({ stages, stepIds, route, done, onToggle, services }: Props) {
  const { leaving, change } = useLeavingSteps(route);
  const doneCount = route.filter((r) => done.includes(r.step.id)).length;
  const progress = route.length ? Math.round((doneCount / route.length) * 100) : 0;

  // На экране — текущие шаги и те, что ещё исчезают; порядок — по этапам
  const leavingIds = new Set(leaving.map((r) => r.step.id));
  const shown = [...route, ...leaving];

  return (
    <div className="nav-main">
      <div className="panel nav-progress">
        <div className="nav-progress-head">
          <h2 className="panel-title">Ваш маршрут: {stepsWord(route.length)}</h2>
          <span className="nav-progress-count">
            Сделано {doneCount} из {route.length}
          </span>
        </div>
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Прогресс по маршруту"
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        {change && (
          <p className="nav-change" role="status">
            Маршрут изменился:
            {change.added.length > 0 && <span className="delta delta-good">+{stepsWord(change.added.length)}</span>}
            {change.removed.length > 0 && <span className="delta delta-bad">−{stepsWord(change.removed.length)}</span>}
          </p>
        )}
      </div>

      <ol className="timeline">
        {stages.map((stage, stageIndex) => {
          const steps = shown.filter((r) => r.step.stage === stage.id);
          if (!steps.length) return null;
          // Внутри этапа — порядок шагов как в конфиге
          steps.sort((a, b) => stepIds.indexOf(a.step.id) - stepIds.indexOf(b.step.id));
          const allLeaving = steps.every((r) => leavingIds.has(r.step.id));
          const stageDone = steps.every((r) => leavingIds.has(r.step.id) || done.includes(r.step.id));
          return (
            <li key={stage.id} className={`timeline-stage${allLeaving ? " is-leaving" : ""}`}>
              <div className={`stage-marker${stageDone ? " is-done" : ""}`} aria-hidden="true">
                {stageDone ? "✓" : stageIndex + 1}
              </div>
              <div className="stage-body">
                <h3 className="stage-title">{stage.title}</h3>
                <ul className="stage-steps">
                  {steps.map((r) => (
                    <StepCard
                      key={r.step.id}
                      route={r}
                      leaving={leavingIds.has(r.step.id)}
                      done={done.includes(r.step.id)}
                      onToggle={() => onToggle(r.step.id)}
                      services={services}
                    />
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type StepCardProps = {
  route: RouteStep;
  leaving: boolean;
  done: boolean;
  onToggle: () => void;
  services: ServiceDef[];
};

function StepCard({ route, leaving, done, onToggle, services }: StepCardProps) {
  const { step, text, calcLink, special } = route;
  const linked = (step.services ?? [])
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is ServiceDef => Boolean(s));

  return (
    <li className={`step-card${leaving ? " is-leaving" : ""}${done ? " is-done" : ""}`} aria-hidden={leaving || undefined}>
      <button
        type="button"
        className="step-check"
        aria-pressed={done}
        aria-label={done ? `Снять отметку: ${step.title}` : `Отметить сделанным: ${step.title}`}
        onClick={onToggle}
        disabled={leaving}
      >
        {done ? "✓" : ""}
      </button>
      <div className="step-body">
        <h4 className="step-title">{step.title}</h4>
        {special && <span className="step-badge">Для вашего сценария</span>}
        {/* key={text}: при смене рекомендации абзац перерисуется с анимацией — видно, что текст изменился */}
        <p key={text} className="step-text">
          <TemplateText text={text} />
        </p>
        {(calcLink || linked.length > 0) && (
          <div className="step-links">
            {calcLink && (
              <Link className="step-calc" to={calcLink.to}>
                {calcLink.label} <span aria-hidden="true">→</span>
              </Link>
            )}
            {linked.map((s) =>
              s.href ? (
                <a key={s.id} className="service-chip" href={s.href} target="_blank" rel="noreferrer" title={s.description}>
                  {s.title} <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <span key={s.id} className="service-chip is-stub" title={`${s.description}. Ссылка-заглушка в демо`}>
                  {s.title}
                </span>
              ),
            )}
          </div>
        )}
      </div>
    </li>
  );
}
