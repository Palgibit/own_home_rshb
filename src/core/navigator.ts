// Навигатор «Путь к своему дому»: сборка маршрута из шагов с условиями.
//
// Пользователь отвечает на несколько вопросов (цель, объект, сфера работы,
// финансирование). Каждый шаг в конфиге знает, при каких ответах он нужен
// (showIf), и может иметь особую рекомендацию для части сценариев (variants).
// Недопустимые сочетания ответов (например, сельская ипотека на вторичку)
// описаны в конфиге как конфликты. Код ничего не знает о конкретных
// вопросах и шагах — всё это редактирует админ.

// Ответы: { goal: "buy", object: "construction", financing: "rural" }
export type Answers = Record<string, string>;

// Условие: для каждого вопроса — список подходящих вариантов.
// Все вопросы условия должны совпасть (И), внутри списка — любой (ИЛИ).
// Пустое условие выполняется всегда.
export type Condition = Record<string, string[]>;

export type QuestionOption = { id: string; label: string; hint?: string };

export type Question = {
  id: string;
  title: string;
  hint?: string;
  showIf?: Condition; // вопрос задаётся только при этих ответах
  options: QuestionOption[];
};

// Недопустимое сочетание ответов и объяснение, почему
export type Conflict = { when: Condition; message: string };

export type Stage = { id: string; title: string };

export type StepLink = { label: string; to: string }; // to — адрес внутри приложения: /simulator?scenario=…

export type StepVariant = {
  when: Condition;
  text: string; // заменяет рекомендацию по умолчанию
  calcLink?: StepLink; // заменяет ссылку в расчёт
};

export type StepDef = {
  id: string;
  stage: string;
  title: string;
  showIf?: Condition;
  recommendation: string;
  variants?: StepVariant[]; // первая подходящая побеждает
  services?: string[]; // id сервисов экосистемы из конфига
  calcLink?: StepLink;
};

// Типовой сценарий: готовый набор ответов. Он же — столбец матрицы «шаг × сценарий»
export type Preset = { id: string; title: string; answers: Answers };

export type NavigatorDef = {
  questions: Question[];
  conflicts: Conflict[];
  stages: Stage[];
  steps: StepDef[];
  presets: Preset[];
};

// Шаг маршрута с выбранной под ответы рекомендацией
export type RouteStep = {
  step: StepDef;
  text: string;
  calcLink?: StepLink;
  special: boolean; // рекомендация особая для этого сценария (сработал variant)
};

// ── Условия и вопросы ───────────────────────────────────────────

// Ответ на скрытый вопрос не учитывается: условие на него не выполняется
export function matches(cond: Condition | undefined, answers: Answers): boolean {
  if (!cond) return true;
  return Object.entries(cond).every(([q, allowed]) => answers[q] !== undefined && allowed.includes(answers[q]));
}

// Ответы только на заданные вопросы (с учётом showIf, по порядку)
export function activeAnswers(nav: NavigatorDef, answers: Answers): Answers {
  const active: Answers = {};
  for (const q of nav.questions) {
    if (answers[q.id] !== undefined && matches(q.showIf, active)) active[q.id] = answers[q.id];
  }
  return active;
}

export function visibleQuestions(nav: NavigatorDef, answers: Answers): Question[] {
  const active = activeAnswers(nav, answers);
  return nav.questions.filter((q) => matches(q.showIf, active));
}

export function findConflict(nav: NavigatorDef, answers: Answers): Conflict | undefined {
  const active = activeAnswers(nav, answers);
  return nav.conflicts.find((c) => matches(c.when, active));
}

// Почему вариант нельзя выбрать. Проверяем только против ответов на вопросы
// ВЫШЕ по списку: так пользователь всегда может поменять ранний ответ,
// а поздние подстроятся (см. normalizeAnswers).
export function optionBlockedBy(nav: NavigatorDef, answers: Answers, questionId: string, optionId: string): string | undefined {
  const index = nav.questions.findIndex((q) => q.id === questionId);
  const earlier: Answers = {};
  for (const q of nav.questions.slice(0, index)) {
    if (answers[q.id] !== undefined) earlier[q.id] = answers[q.id];
  }
  return findConflict(nav, { ...earlier, [questionId]: optionId })?.message;
}

export type Adjustment = { questionId: string; from: string; to: string; reason: string };

// Приводит ответы к допустимым: идём по вопросам сверху вниз, и если ответ
// конфликтует с более ранними — заменяем его на первый разрешённый вариант.
// Возвращает исправленные ответы и список замен, чтобы показать их пользователю.
export function normalizeAnswers(nav: NavigatorDef, answers: Answers): { answers: Answers; adjusted: Adjustment[] } {
  const result: Answers = { ...answers };
  const adjusted: Adjustment[] = [];
  for (const q of nav.questions) {
    const current = result[q.id];
    const allowed = q.options.filter((o) => !optionBlockedBy(nav, result, q.id, o.id));
    if (current === undefined || !q.options.some((o) => o.id === current)) {
      if (allowed[0]) result[q.id] = allowed[0].id;
      continue;
    }
    const reason = optionBlockedBy(nav, result, q.id, current);
    if (reason && allowed[0]) {
      result[q.id] = allowed[0].id;
      // Замену скрытого вопроса не показываем: пользователь его сейчас не видит
      if (matches(q.showIf, activeAnswers(nav, result))) {
        adjusted.push({ questionId: q.id, from: current, to: allowed[0].id, reason });
      }
    }
  }
  return { answers: result, adjusted };
}

// ── Маршрут ─────────────────────────────────────────────────────

export function resolveStep(step: StepDef, answers: Answers): RouteStep | null {
  if (!matches(step.showIf, answers)) return null;
  const variant = step.variants?.find((v) => matches(v.when, answers));
  return {
    step,
    text: variant?.text ?? step.recommendation,
    calcLink: variant?.calcLink ?? step.calcLink,
    special: Boolean(variant),
  };
}

// Маршрут: шаги, подходящие под ответы, в порядке этапов
export function buildRoute(nav: NavigatorDef, answers: Answers): RouteStep[] {
  const active = activeAnswers(nav, answers);
  const stageOrder = new Map(nav.stages.map((s, i) => [s.id, i]));
  return nav.steps
    .map((step, index) => ({ route: resolveStep(step, active), index }))
    .filter((x): x is { route: RouteStep; index: number } => x.route !== null)
    .sort((a, b) => (stageOrder.get(a.route.step.stage) ?? 0) - (stageOrder.get(b.route.step.stage) ?? 0) || a.index - b.index)
    .map((x) => x.route);
}

// ── Матрица «шаг × сценарий» ────────────────────────────────────

export type MatrixCell = "none" | "shown" | "special";

export type MatrixRow = { step: StepDef; cells: { cell: MatrixCell; text?: string }[] };

// Строки — все шаги по этапам, столбцы — типовые сценарии
export function buildMatrix(nav: NavigatorDef): { stage: Stage; rows: MatrixRow[] }[] {
  const routes = nav.presets.map((p) => new Map(buildRoute(nav, p.answers).map((r) => [r.step.id, r])));
  return nav.stages.map((stage) => ({
    stage,
    rows: nav.steps
      .filter((s) => s.stage === stage.id)
      .map((step) => ({
        step,
        cells: routes.map((route) => {
          const r = route.get(step.id);
          if (!r) return { cell: "none" as const };
          return { cell: r.special ? ("special" as const) : ("shown" as const), text: r.text };
        }),
      })),
  }));
}

// ── Подстановка параметров в текст ──────────────────────────────

// Разбивает «Дом нужно достроить за {buildDeadlineMonths} мес» на куски:
// текст и ссылки на параметры. Значения подставляет интерфейс — так в текстах
// шагов нет захардкоженных ставок и сроков.
export type TextPart = { text: string } | { param: string };

export function splitTemplate(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const re = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ param: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export function templateParams(text: string): string[] {
  return splitTemplate(text).flatMap((p) => ("param" in p ? [p.param] : []));
}
