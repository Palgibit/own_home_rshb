import type { RuralRules } from "../../core/loanStatus";

// Правила сельской ипотеки — из глобальных параметров конфига (их меняет админ)
export function ruralRules(globals: Record<string, number>): RuralRules {
  return {
    checkEveryMonths: globals.employmentCheckMonths,
    obligationYears: globals.obligationYears,
    registrationDays: globals.registrationDays,
  };
}
