import type { MonthMatrix } from "../lib/flexMatrix";
import { heatColor, fmtShort } from "../lib/heat";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function fmtMoney(v: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

interface MonthCalendarProps {
  matrix: MonthMatrix;
  selectedDate?: string;
  onPick: (date: string) => void;
  onClose: () => void;
}

export function MonthCalendar({ matrix, selectedDate, onPick, onClose }: MonthCalendarProps) {
  const { year, month, days, min, max, currency, source, nights } = matrix;
  const real = source === "amadeus";
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0-6

  return (
    <div className="matrix-panel">
      <div className="matrix-head">
        <h2>
          {MONTHS[month]} {year}
          <span className={`src-badge ${real ? "real" : "est"}`}>{real ? "Amadeus (real)" : "estimado"}</span>
          <span className="month-trip">{nights ? `ida+volta · ${nights} noites` : "somente ida"}</span>
        </h2>
        <div className="matrix-legend">
          <span className="muted">{fmtMoney(min, currency)}</span>
          <span className="heat-bar" />
          <span className="muted">{fmtMoney(max, currency)}</span>
          <button className="link" onClick={onClose}>
            fechar
          </button>
        </div>
      </div>

      <div className="month-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="month-wd">
            {w}
          </div>
        ))}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`pad-${i}`} className="month-pad" />
        ))}
        {days.map((d) => {
          const day = Number(d.date.slice(8, 10));
          if (d.price === null) {
            return (
              <div key={d.date} className="month-cell empty" title="sem preço">
                <span className="month-day">{day}</span>
                <span className="month-price">–</span>
              </div>
            );
          }
          const isMin = d.price === min;
          const isSel = d.date === selectedDate;
          return (
            <button
              key={d.date}
              className={`month-cell ${isMin ? "cheapest" : ""} ${isSel ? "selected" : ""}`}
              style={{ background: heatColor(d.price, min, max) }}
              title={fmtMoney(d.price, currency)}
              onClick={() => onPick(d.date)}
            >
              <span className="month-day">
                {day}
                {isMin && <span className="star">★</span>}
              </span>
              <span className="month-price">{fmtShort(d.price)}</span>
            </button>
          );
        })}
      </div>

      <p className="muted matrix-hint">
        {real
          ? "Preços reais (Amadeus flight-dates) por dia de partida. Dias vazios = sem preço em cache. "
          : "Preço estimado por dia de partida. "}
        Clique num dia para buscar. ★ = dia mais barato do mês.
      </p>
    </div>
  );
}
