import { useEffect, useState } from "react";
import type { Trip } from "../lib/flightLinks";
import {
  airlineName,
  brl,
  duration,
  fetchPrices,
  shortDate,
  shortTime,
  stopsLabel,
  type PriceOffer,
  type PriceResult,
} from "../lib/prices";

// A API às vezes devolve o nome da própria Aviasales em russo.
const sellerName = (s: string) => (/[\u0400-\u04FF]/.test(s) ? "Aviasales" : s);

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function OfferCard({ o, best, adults }: { o: PriceOffer; best: boolean; adults: number }) {
  return (
    <article className={`fare-card${best ? " best" : ""}`}>
      <div className="fare-top">
        <span className="airline-name">{airlineName(o.airline)}</span>
        {best && <span className="best-badge">MAIS BARATO</span>}
      </div>

      <div className="fare-effective">{brl(o.price)}</div>
      <div className="fare-breakdown">
        {adults > 1 ? `por pessoa · ${brl(o.price * adults)} para ${adults}` : "por pessoa"}
        {o.returnAt ? " · ida e volta" : " · só ida"}
      </div>

      <div className="fare-flights">
        <div className="flight-line">
          <span className="leg">Ida {shortDate(o.departureAt)}</span>
          <span className="flight-no">
            {shortTime(o.departureAt)} · {o.originAirport}→{o.destinationAirport} · {stopsLabel(o.stops)} · {duration(o.durationTo)}
          </span>
        </div>
        {o.returnAt && (
          <div className="flight-line">
            <span className="leg">Volta {shortDate(o.returnAt)}</span>
            <span className="flight-no">
              {o.destinationAirport}→{o.originAirport} · {stopsLabel(o.returnStops)} · {duration(o.durationBack)}
            </span>
          </div>
        )}
      </div>

      <p className="fare-rationale">Vendido por {sellerName(o.seller)}</p>
      <a className="buy" href={o.url} target="_blank" rel="noopener noreferrer">
        Ver oferta ↗
      </a>
    </article>
  );
}

function OfferRow({ offers, adults, bestUrl }: { offers: PriceOffer[]; adults: number; bestUrl?: string }) {
  return (
    <div className="fare-list">
      {offers.map((o) => (
        <OfferCard key={o.url} o={o} adults={adults} best={o.url === bestUrl} />
      ))}
    </div>
  );
}

export function PriceCards({ trip }: { trip: Trip }) {
  const [result, setResult] = useState<PriceResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(false);
    fetchPrices(trip)
      .then((r) => !cancelled && setResult(r))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [trip]);

  const month = MONTHS[Number(trip.departure.slice(5, 7)) - 1];
  const all = result ? [...result.exact, ...result.otherDates] : [];
  const bestUrl = all.length ? all.reduce((a, b) => (b.price < a.price ? b : a)).url : undefined;

  return (
    <>
      <h2 className="section">Preços encontrados</h2>

      {error && <p className="muted">Não foi possível carregar os preços agora. Use os sites abaixo.</p>}
      {!error && !result && <p className="muted">Buscando preços…</p>}

      {result && all.length === 0 && (
        <p className="muted">Nenhum preço recente para essa rota. Use os sites abaixo para buscar.</p>
      )}

      {result && result.exact.length > 0 && (
        <>
          <h3 className="prices-subtitle">Nas suas datas</h3>
          <OfferRow offers={result.exact} adults={trip.adults} bestUrl={bestUrl} />
        </>
      )}

      {result && result.otherDates.length > 0 && (
        <>
          <h3 className="prices-subtitle">
            {result.exact.length > 0 ? `Outras datas em ${month}` : `Nada nas suas datas — opções em ${month}`}
          </h3>
          <OfferRow offers={result.otherDates} adults={trip.adults} bestUrl={bestUrl} />
        </>
      )}

      {result && all.length > 0 && (
        <p className="muted prices-note">
          Preços em reais, encontrados em buscas recentes na Aviasales
          {trip.cabin !== "economy" ? ", em classe econômica" : ""}. O valor final é confirmado no site.
        </p>
      )}
    </>
  );
}
