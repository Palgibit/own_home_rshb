// План досрочных платежей: разовые и регулярные платежи, у каждого свой режим.
// План разворачивается в список разовых досрочек для buildSchedule — он уже умеет
// несколько досрочек с разными режимами. Затем сравниваем четыре варианта.

import type { EarlyMode, Loan } from "./annuity";
import { explained, inp, type Explained } from "./explain";
import type { InsuranceSettings } from "./purchase";
import { computeMetrics, type Household, type Metrics } from "./scenarios";

export type PlanKind = "once" | "monthly" | "yearly"; // разовый / каждый месяц / каждый год

export type PlanItem = {
  kind: PlanKind;
  fromMonth: number; // с какого месяца (для разового — в каком)
  amount: number; // ₽
  mode: EarlyMode; // сократить срок / уменьшить платёж
};

export type EarlyPayment = { month: number; amount: number; mode: EarlyMode };

// Регулярные платежи разворачиваются в разовые до конца срока по договору.
// Если кредит закончится раньше, лишние события график просто не дойдёт до них.
export function expandPlan(items: PlanItem[], months: number, modeOverride?: EarlyMode): EarlyPayment[] {
  const out: EarlyPayment[] = [];
  for (const item of items) {
    if (!(item.amount > 0)) continue;
    const mode = modeOverride ?? item.mode;
    const from = Math.max(1, Math.round(item.fromMonth));
    const step = item.kind === "monthly" ? 1 : item.kind === "yearly" ? 12 : 0;
    if (step === 0) {
      if (from <= months) out.push({ month: from, amount: item.amount, mode });
      continue;
    }
    for (let m = from; m <= months; m += step) out.push({ month: m, amount: item.amount, mode });
  }
  return out.sort((a, b) => a.month - b.month);
}

export type PlanVariantId = "none" | "yours" | "term" | "payment";

export type PlanVariant = {
  id: PlanVariantId;
  metrics: Metrics;
  saving: Explained; // экономия на переплате против варианта без досрочек
  extraPaid: number; // сколько фактически внесено досрочно
};

export type PlanComparison = Record<PlanVariantId, PlanVariant>;

// Четыре варианта: без досрочек, ваш план как есть, весь план в режиме «срок», весь план в режиме «платёж»
export function comparePlan(
  loan: Loan,
  household: Household,
  items: PlanItem[],
  insurance?: InsuranceSettings,
): PlanComparison {
  const run = (earlyPayments: EarlyPayment[]) =>
    computeMetrics(loan, household, { earlyPayments }, undefined, insurance);
  const none = run([]);
  const variant = (id: PlanVariantId, metrics: Metrics): PlanVariant => {
    // Экономия = переплата без досрочек − переплата с планом (проценты и страховка)
    const saving = explained("planSaving", none.overpayment.value - metrics.overpayment.value, {
      without: inp(none.overpayment.value, "Переплата без досрочек, ₽"),
      with: inp(metrics.overpayment.value, "Переплата с планом, ₽"),
    });
    const extraPaid = metrics.schedule.rows.reduce((s, r) => s + r.extra, 0);
    return { id, metrics, saving, extraPaid };
  };
  return {
    none: variant("none", none),
    yours: variant("yours", run(expandPlan(items, loan.months))),
    term: variant("term", run(expandPlan(items, loan.months, "term"))),
    payment: variant("payment", run(expandPlan(items, loan.months, "payment"))),
  };
}
