// Фича 2. «Город или село» — сравниватель двух вариантов жилья.
// Стартовые значения — квартира в городе и дом с участком из конфига (условные цены),
// но посетитель меняет в каждой карточке цену, площадь, кредит, ставку, срок и содержание.
// Так это не реклама одной программы, а честное сравнение «бок о бок».

import { useState } from "react";
import { homeOption, type HomeOption } from "../../core/features";
import type { PurchaseLimits } from "../../core/purchase";
import { useConfig } from "../../config/ConfigContext";
import { PROGRAMS, PROGRAM_DOWN_PARAM, PROGRAM_RATE_PARAM, type LoanProgram } from "../../config/schema";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { NumberField } from "../../ui/NumberField";
import { formatNumber, formatPct, formatRub } from "../../ui/format";

type Props = { income: number; expenses: number; years: number };

type HomeInput = {
  program: LoanProgram;
  price: number;
  area: number;
  loan: number;
  ratePct: number;
  years: number;
  upkeep: number;
};

type CardProps = {
  title: string;
  value: HomeInput;
  onChange: (next: HomeInput) => void;
  o: HomeOption;
};

function OptionCard({ title, value, onChange, o }: CardProps) {
  const { globals } = useConfig();
  const set = (patch: Partial<HomeInput>) => onChange({ ...value, ...patch });
  const downPct = value.price > 0 ? (o.downPayment.value / value.price) * 100 : 0;
  const { warnings } = o;

  return (
    <article className="home-card">
      <h3 className="home-title">{title}</h3>
      <div className="segmented" role="radiogroup" aria-label={`${title}: программа`}>
        {(Object.keys(PROGRAMS) as LoanProgram[]).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={value.program === p}
            className={`segmented-item${value.program === p ? " is-active" : ""}`}
            // Смена программы подставляет её ставку из конфига — потом можно поправить
            onClick={() => set({ program: p, ratePct: globals[PROGRAM_RATE_PARAM[p]] ?? value.ratePct })}
          >
            {PROGRAMS[p]}
          </button>
        ))}
      </div>
      <div className="form-grid">
        <NumberField label="Цена" unit="₽" value={value.price} min={0} max={200_000_000} onChange={(v) => set({ price: v })} />
        <NumberField label="Площадь" unit="м²" value={value.area} min={1} max={2000} onChange={(v) => set({ area: v })} />
        <NumberField label="Кредит" unit="₽" value={value.loan} min={0} max={200_000_000} onChange={(v) => set({ loan: v })} />
        <NumberField label="Ставка" unit="%" value={value.ratePct} min={0} max={40} onChange={(v) => set({ ratePct: v })} />
        <NumberField label="Срок" unit="лет" value={value.years} min={1} max={35} onChange={(v) => set({ years: Math.round(v) })} />
        <NumberField
          label="Содержание"
          unit="₽/мес"
          value={value.upkeep}
          min={0}
          max={200_000}
          onChange={(v) => set({ upkeep: v })}
        />
      </div>
      <dl className="home-rows">
        <div>
          <dt>Взнос</dt>
          <dd>
            <ExplainableNumber value={o.downPayment} /> · {formatPct(downPct)}
          </dd>
        </div>
        <div><dt>На человека</dt><dd><ExplainableNumber value={o.areaPerPerson} format="number" /> м²</dd></div>
        <div><dt>Платёж</dt><dd className="home-key"><ExplainableNumber value={o.payment} /></dd></div>
        <div><dt>Переплата</dt><dd><ExplainableNumber value={o.overpayment} /></dd></div>
        <div>
          <dt>Свободный бюджет</dt>
          <dd className={o.budget.value < 0 ? "text-bad" : ""}><ExplainableNumber value={o.budget} /></dd>
        </div>
      </dl>
      {warnings.loanOverPrice && <p className="note note-warn">Кредит больше цены — считаем кредит равным цене.</p>}
      {warnings.downTooLow && (
        <p className="note note-warn">
          Взнос ниже минимума программы: нужно от {formatPct(warnings.downTooLow.minPct)} — {formatRub(warnings.downTooLow.minAmount)}.
        </p>
      )}
      {warnings.overLimit && (
        <p className="note note-warn">Кредит больше лимита программы — {formatRub(warnings.overLimit.limit)}.</p>
      )}
    </article>
  );
}

// «на 5 000 ₽ меньше» / «на 5 000 ₽ больше» / «столько же»
function diffText(diff: number, fmt: (v: number) => string, less: string, more: string): string {
  if (Math.abs(diff) < 0.5) return "столько же";
  return `на ${fmt(Math.abs(diff))} ${diff < 0 ? less : more}`;
}

export function CityVsVillageBlock({ income, expenses, years }: Props) {
  const { config, globals } = useConfig();
  const [familySize, setFamilySize] = useState(config.simulator.familySize);

  // Стартовые карточки: кредит = цена × (1 − минимальный взнос), у сельской — не больше лимита
  const [a, setA] = useState<HomeInput>(() => {
    const price = (globals.cityPricePerM2 ?? 0) * (globals.cityArea ?? 0);
    return {
      program: "market",
      price,
      area: globals.cityArea ?? 0,
      loan: Math.round(price * (1 - (globals.cityDownPct ?? 0) / 100)),
      ratePct: globals.marketRate ?? 0,
      years,
      upkeep: globals.cityUpkeep ?? 0,
    };
  });
  const [b, setB] = useState<HomeInput>(() => {
    const price = globals.villageHousePrice ?? 0;
    return {
      program: "rural",
      price,
      area: globals.villageHouseArea ?? 0,
      loan: Math.min(Math.floor(price * (1 - (globals.ruralDownPct ?? 0) / 100)), globals.ruralMaxLoan ?? Infinity),
      ratePct: globals.ruralRate ?? 0,
      years,
      upkeep: globals.villageUpkeep ?? 0,
    };
  });

  const limits = (p: LoanProgram): PurchaseLimits => ({
    minDownPct: globals[PROGRAM_DOWN_PARAM[p]] ?? 0,
    maxLoan: p === "rural" ? globals.ruralMaxLoan : undefined,
  });
  const calc = (h: HomeInput) =>
    homeOption({ ...h, months: h.years * 12, limits: limits(h.program), income, expenses, familySize });
  const oa = calc(a);
  const ob = calc(b);

  return (
    <section className="feature" id="city-village" aria-labelledby="cv-heading">
      <div className="feature-head">
        <p className="eyebrow">И к селу, и к городу</p>
        <h2 id="cv-heading">Город или село?</h2>
        <p className="feature-lead">
          Сравните два варианта жилья бок о бок: меняйте цену, площадь, кредит, ставку и срок в каждой карточке.
        </p>
      </div>

      <div className="panel">
        <div className="form-grid form-grid-3">
          <NumberField label="Человек в семье" value={familySize} min={1} max={12} onChange={(v) => setFamilySize(Math.round(v))} />
        </div>
        <p className="field-hint">
          Доход и расходы — из блока «Ваш кредит» выше. Стартовые цены условные, их задаёт администратор. Содержание —
          коммунальные платежи, налог, обслуживание дома.
        </p>
        <div className="home-grid">
          <OptionCard title="Вариант А: квартира в городе" value={a} onChange={setA} o={oa} />
          <OptionCard title="Вариант Б: дом с участком" value={b} onChange={setB} o={ob} />
        </div>
        <p className="note home-verdict">
          <strong>Вариант Б по сравнению с А:</strong> платёж{" "}
          {diffText(ob.payment.value - oa.payment.value, formatRub, "меньше", "больше")}, переплата{" "}
          {diffText(ob.overpayment.value - oa.overpayment.value, formatRub, "меньше", "больше")}, свободный бюджет{" "}
          {diffText(ob.budget.value - oa.budget.value, formatRub, "меньше", "больше")}, места на человека{" "}
          {diffText(ob.areaPerPerson.value - oa.areaPerPerson.value, (v) => `${formatNumber(Math.round(v * 10) / 10)} м²`, "меньше", "больше")}.
        </p>
      </div>
    </section>
  );
}
