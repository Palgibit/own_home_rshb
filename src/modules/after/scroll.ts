import type { MouseEvent } from "react";

// Якоря через JS: в адресе уже есть # от HashRouter, обычная ссылка #id сломала бы маршрут
export function scrollToSection(e: MouseEvent | null, id: string) {
  e?.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}
