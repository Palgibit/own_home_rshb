// Фича 2. «Город или село» — миссия банка в одном экране:
// за те же деньги — квартира в городе по рыночной ставке или дом с участком
// по сельской ипотеке. Цены и ставки — условные, из конфига.

import { useState } from "react";
import { cityVsVillage, type HomeOption } from "../../core/features";
import { useConfig } from "../../config/ConfigContext";
import { ExplainableNumber } from "../../ui/ExplainableNumber";
import { NumberField } from "../../ui/NumberField";
import { formatMonths, formatNumber, formatPct, formatRub } from "../../ui/format";

type Props = { income: number; expenses: number; months: number };

function OptionCard({ title, subtitle, o, months }: { title: string; subtitle: string; o: HomeOption; months: number }) {
  return (
    <article className="home-card">
      <h3 className="home-title">{title}</h3>
      <p className="home-subtitle">{subtitle}</p>
      <dl className="home-rows">
        <div><dt>Цена</dt><dd>{formatRub(o.price)}</dd></div>
        <div><dt>Площадь</dt><dd>{formatNumber(Math.round(o.area))} м²</dd></div>
        <div><dt>На человека</dt><dd><ExplainableNumber value={o.areaPerPerson} format="number" /> м²</dd></div>
        <div><dt>Кредит</dt><dd><ExplainableNumber value={o.loan} /></dd></div>
        <div><dt>Ставка</dt><dd>{formatPct(o.ratePct)}</dd></div>
        <div><dt>Срок</dt><dd>{formatMonths(months)}</dd></div>
        <div><dt>Платёж</dt><dd className="home-key"><ExplainableNumber value={o.payment} /></dd></div>
        <div><dt>Переплата</dt><dd><ExplainableNumber value={o.overpayment} /></dd></div>
        <div>
          <dt>Свободный бюджет</dt>
          <dd className={o.budget.value < 0 ? "text-bad" : ""}><ExplainableNumber value={o.budget} /></dd>
        </div>
      </dl>
      {o.shortfall > 0 && <p className="note note-warn">Своих денег не хватает: ещё {formatRub(o.shortfall)}.</p>}
    </article>
  );
}

export function CityVsVillageBlock({ income, expenses, months }: Props) {
  const { config, globals } = useConfig();
  const [ownFunds, setOwnFunds] = useState(config.simulator.ownFunds);
  const [familySize, setFamilySize] = useState(config.simulator.familySize);

  const { city, village } = cityVsVillage({
    ownFunds,
    income,
    expenses,
    familySize,
    months,
    city: {
      pricePerM2: globals.cityPricePerM2 ?? 1,
      downPct: globals.cityDownPct ?? 0,
      ratePct: globals.marketRate ?? 0,
    },
    village: {
      price: globals.villageHousePrice ?? 0,
      area: globals.villageHouseArea ?? 0,
      downPct: globals.ruralDownPct ?? 0,
      ratePct: globals.ruralRate ?? 0,
      maxLoan: globals.ruralMaxLoan ?? Infinity,
    },
  });

  return (
    <section className="feature" id="city-village" aria-labelledby="cv-heading">
      <div className="feature-head">
        <p className="eyebrow">И к селу, и к городу</p>
        <h2 id="cv-heading">Город или село?</h2>
        <p className="feature-lead">
          Те же деньги — два варианта жизни. Сравните квартиру в городе и дом с участком по сельской ипотеке.
        </p>
      </div>

      <div className="panel">
        <div className="form-grid form-grid-3">
          <NumberField label="Свои средства" unit="₽" value={ownFunds} min={0} max={50_000_000} step={50_000} onChange={setOwnFunds} />
          <NumberField label="Человек в семье" value={familySize} min={1} max={12} onChange={(v) => setFamilySize(Math.round(v))} />
        </div>
        <p className="field-hint">
          Доход, расходы и срок — из блока «Ваш кредит» выше. Цены условные, их задаёт администратор.
        </p>
        <div className="home-grid">
          <OptionCard
            title="Квартира в городе"
            subtitle={`${formatRub(globals.cityPricePerM2 ?? 0)} за м², рыночная ипотека`}
            o={city}
            months={months}
          />
          <OptionCard title="Дом с участком" subtitle="Сельская ипотека" o={village} months={months} />
        </div>
      </div>
    </section>
  );
}
