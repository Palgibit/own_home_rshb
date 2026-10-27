// Вопросы навигатора — уточнение ответов после выбора типового сценария.
// Варианты, недопустимые при ответах выше (например, сельская ипотека на вторичку),
// выключены — и рядом написано почему.

import type { Adjustment, Answers, NavigatorDef } from "../../core/navigator";
import { optionBlockedBy, visibleQuestions } from "../../core/navigator";
import { TemplateText } from "../../ui/TemplateText";

type Props = {
  nav: NavigatorDef;
  answers: Answers;
  adjusted: Adjustment[];
  onAnswer: (questionId: string, optionId: string) => void;
};

export function QuestionsPanel({ nav, answers, adjusted, onAnswer }: Props) {
  const optionLabel = (q: string, o: string) =>
    nav.questions.find((x) => x.id === q)?.options.find((x) => x.id === o)?.label ?? o;

  return (
    <div className="nav-side">
      <section className="panel" aria-labelledby="questions-heading">
        <div>
          <h2 id="questions-heading" className="panel-title">
            Ваша ситуация
          </h2>
          <p className="field-hint nav-side-hint">Уточните ответы — маршрут справа подстроится.</p>
        </div>

        {visibleQuestions(nav, answers).map((q) => {
          const blocked = q.options
            .map((o) => ({ option: o, reason: optionBlockedBy(nav, answers, q.id, o.id) }))
            .filter((x) => x.reason);
          return (
            <fieldset key={q.id} className="nav-question">
              <legend className="nav-question-title">{q.title}</legend>
              {q.hint && (
                <p className="field-hint">
                  <TemplateText text={q.hint} />
                </p>
              )}
              <div className="nav-options" role="radiogroup" aria-label={q.title}>
                {q.options.map((o) => {
                  const isBlocked = blocked.some((b) => b.option.id === o.id);
                  const isActive = answers[q.id] === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      disabled={isBlocked}
                      className={`nav-option${isActive ? " is-active" : ""}`}
                      onClick={() => onAnswer(q.id, o.id)}
                    >
                      <span className="nav-option-label">{o.label}</span>
                      {o.hint && (
                        <span className="nav-option-hint">
                          <TemplateText text={o.hint} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {blocked.map(({ option, reason }) => (
                <p key={option.id} className="nav-blocked">
                  <strong>Почему нельзя «{option.label}»:</strong> {reason}
                </p>
              ))}
            </fieldset>
          );
        })}

        {adjusted.map((a) => (
          <p key={a.questionId} className="note note-warn" role="status">
            Заменили «{optionLabel(a.questionId, a.from)}» на «{optionLabel(a.questionId, a.to)}»: {a.reason}
          </p>
        ))}
      </section>
    </div>
  );
}
