// Модуль 3 «Жизнь после ипотеки» и сервисы экосистемы: формой.
// Справки — через JSON (список однотипных объектов).

import { PROGRAMS, type AfterDef, type AppConfig, type CertificateDef, type LoanProgram } from "../../config/schema";
import type { GuestDemo } from "../../data/guest";
import { NumberField } from "../../ui/NumberField";
import { JsonEditor, SelectField, TextField } from "./fields";
import type { Edit } from "./AdminPage";

const DEMO_NUMBERS: [Exclude<keyof GuestDemo, "program" | "propertyTitle">, string, string][] = [
  ["principal", "Сумма кредита", "₽"],
  ["ratePct", "Ставка", "%"],
  ["years", "Срок", "лет"],
  ["monthsAgo", "Выдан месяцев назад", "мес"],
  ["propertyPrice", "Стоимость жилья", "₽"],
];

export function AfterTab({ draft, edit }: { draft: AppConfig; edit: Edit }) {
  const a = draft.after;
  const setAfter = (fn: (a: AfterDef) => void) => edit((d) => fn(d.after));
  const setDemo = (patch: Partial<GuestDemo>) => setAfter((x) => Object.assign(x.guestDemo, patch));
  const hint = "Можно подставлять глобальные параметры: {ndfl}, {employmentCheckMonths}…";

  return (
    <div className="admin-stack">
      <section className="panel">
        <h2 className="panel-title">Общее</h2>
        <div className="admin-grid">
          <NumberField label="Напоминать заранее" unit="дн" min={0} value={a.reminderDays} onChange={(v) => setAfter((x) => void (x.reminderDays = v))} />
          <NumberField label="Досрочка по умолчанию" unit="₽" min={0} value={a.earlyAmount} onChange={(v) => setAfter((x) => void (x.earlyAmount = v))} />
          <NumberField label="Зарплата в калькуляторе вычета" unit="₽/мес" min={0} value={a.salary} onChange={(v) => setAfter((x) => void (x.salary = v))} />
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Демо-кредит гостя</h2>
        <p className="scenario-description">Что видит гость публичного сайта до ввода своего кредита.</p>
        <div className="admin-grid">
          <SelectField<LoanProgram>
            label="Программа"
            value={a.guestDemo.program}
            options={Object.entries(PROGRAMS) as [LoanProgram, string][]}
            onChange={(v) => setDemo({ program: v })}
          />
          {DEMO_NUMBERS.map(([key, label, unit]) => (
            <NumberField key={key} label={label} unit={unit} min={0} value={a.guestDemo[key]} onChange={(v) => setDemo({ [key]: v })} />
          ))}
          <TextField label="Объект" value={a.guestDemo.propertyTitle} onChange={(v) => setDemo({ propertyTitle: v })} />
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Подсказки</h2>
        <TextField label="Страхование" rows={3} value={a.insuranceHint} hint={hint} onChange={(v) => setAfter((x) => void (x.insuranceHint = v))} />
        <TextField label="Обязательства по сельской ипотеке" rows={3} value={a.ruralHint} hint={hint} onChange={(v) => setAfter((x) => void (x.ruralHint = v))} />
        <TextField
          label="Налоговый вычет: шаги (по одному в строке)"
          rows={Math.max(4, a.taxSteps.length + 1)}
          value={a.taxSteps.join("\n")}
          hint={hint}
          // Пустые строки не выкидываем сразу — иначе не напечатать новую строку; их не пропустит проверка
          onChange={(v) => setAfter((x) => void (x.taxSteps = v.split("\n")))}
        />
        <TextField
          label="Когда кредит закроется: шаги (по одному в строке)"
          rows={Math.max(4, a.closingSteps.length + 1)}
          value={a.closingSteps.join("\n")}
          hint={hint}
          onChange={(v) => setAfter((x) => void (x.closingSteps = v.split("\n")))}
        />
      </section>

      <section className="panel">
        <h2 className="panel-title">Справка по налоговому вычету</h2>
        <p className="scenario-description">
          Вопросы и ответы над калькулятором вычета. Отвечайте коротко, в 1–3 предложения.
        </p>
        {a.taxFaq.map((f, i) => (
          <div key={i} className="admin-param">
            <TextField label={`Вопрос ${i + 1}`} value={f.q} onChange={(v) => setAfter((x) => void (x.taxFaq[i].q = v))} />
            <TextField label="Ответ" rows={3} value={f.a} hint={hint} onChange={(v) => setAfter((x) => void (x.taxFaq[i].a = v))} />
            <button
              type="button"
              className="admin-remove"
              title="Удалить вопрос"
              aria-label={`Удалить вопрос ${f.q}`}
              onClick={() => setAfter((x) => void x.taxFaq.splice(i, 1))}
            >
              ×
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setAfter((x) => void x.taxFaq.push({ q: "Новый вопрос?", a: "Короткий ответ." }))}
          >
            + Вопрос
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Сервисы экосистемы</h2>
        <p className="scenario-description">
          На них ведут шаги навигатора и раздел «Обустройство». Пустая ссылка — сервис показан без перехода.
        </p>
        {draft.services.map((s, i) => (
          <div key={i} className="admin-param">
            <div className="admin-grid">
              <TextField label="Название" value={s.title} hint={<code>{s.id}</code>} onChange={(v) => edit((d) => void (d.services[i].title = v))} />
              <TextField label="Ссылка" mono value={s.href} placeholder="https://…" onChange={(v) => edit((d) => void (d.services[i].href = v.trim()))} />
            </div>
            <TextField label="Описание" value={s.description} onChange={(v) => edit((d) => void (d.services[i].description = v))} />
          </div>
        ))}
        <div className="admin-grid">
          <SelectField
            label="Сервис страхования"
            value={a.insuranceService}
            options={draft.services.map((s) => [s.id, s.title])}
            onChange={(v) => setAfter((x) => void (x.insuranceService = v))}
          />
        </div>
        <fieldset className="admin-checks">
          <legend className="field-label">В разделе «Обустройство»</legend>
          {draft.services.map((s) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={a.settleServices.includes(s.id)}
                onChange={(e) =>
                  setAfter((x) => {
                    // Порядок — как в списке сервисов
                    const on = new Set(x.settleServices);
                    if (e.target.checked) on.add(s.id);
                    else on.delete(s.id);
                    x.settleServices = draft.services.map((d) => d.id).filter((id) => on.has(id));
                  })
                }
              />{" "}
              {s.title}
            </label>
          ))}
        </fieldset>
      </section>

      <JsonEditor
        label="Справки (certificates)"
        rows={18}
        value={a.certificates}
        hint="Поля: id, title, description, days — через сколько дней готова, byYear: true — нужно выбрать год."
        onChange={(v: CertificateDef[]) => setAfter((x) => void (x.certificates = v))}
      />
    </div>
  );
}
