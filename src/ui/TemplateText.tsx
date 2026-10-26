// Текст из конфига с подстановкой глобальных параметров: «за {buildDeadlineMonths} мес».
// Так в текстах шагов и подсказок нет захардкоженных ставок и сроков:
// админ меняет параметр — меняются все тексты.
// Формат по единице параметра: «%» и «₽» добавляются к числу, остальные
// единицы пишутся в самом тексте.

import { useConfig } from "../config/ConfigContext";
import { splitTemplate } from "../core/navigator";
import { formatNumber, formatPct, formatRub } from "./format";

export function useParamFormatter(): (id: string) => string {
  const { config, globals } = useConfig();
  return (id) => {
    const param = config.params.find((p) => p.id === id);
    if (!param) return `{${id}}`;
    const value = globals[id];
    if (param.unit === "₽") return formatRub(value);
    if (param.unit === "%") return formatPct(value);
    return formatNumber(value);
  };
}

export function fillTemplate(text: string, format: (id: string) => string): string {
  return splitTemplate(text)
    .map((p) => ("param" in p ? format(p.param) : p.text))
    .join("");
}

// Подставленное значение выделено и по наведению показывает, что это за параметр
export function TemplateText({ text }: { text: string }) {
  const { labels } = useConfig();
  const format = useParamFormatter();
  return (
    <>
      {splitTemplate(text).map((p, i) =>
        "param" in p ? (
          <strong key={i} className="param-value" title={`${labels[p.param] ?? p.param} — настраивается в админке`}>
            {format(p.param)}
          </strong>
        ) : (
          p.text
        ),
      )}
    </>
  );
}
