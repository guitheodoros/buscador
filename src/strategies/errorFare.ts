import type { FareStrategy, FareResult, SearchQuery } from "../types";
import { scanErrorFares, buildMockSample, type PricePoint } from "../lib/errorFareScanner";
import { searchFlightDates } from "../lib/amadeusClient";
import { addDays } from "../lib/flexMatrix";
import { seededRng } from "../lib/mockFares";
import { bookingUrlFor } from "../lib/carriers";

const CARRIERS = ["TP", "LA", "AD", "AA", "IB", "AF", "KL", "TK", "EK", "QR", "UX", "AZ", "G3"];

/** Amostra REAL de precos da rota via Amadeus flight-dates (+/- 14 dias). */
async function sampleReal(query: SearchQuery): Promise<PricePoint[] | null> {
  const from = addDays(query.departureDate, -14);
  const to = addDays(query.departureDate, 14);
  const oneWay = !query.returnDate;
  const tripLen = oneWay
    ? 0
    : Math.max(1, Math.round(
        (Date.parse(`${query.returnDate}T00:00:00Z`) - Date.parse(`${query.departureDate}T00:00:00Z`)) /
          86_400_000
      ));
  const resp = await searchFlightDates({
    origin: query.origin,
    destination: query.destination,
    departureDate: `${from},${to}`,
    oneWay,
    duration: oneWay ? undefined : `${tripLen},${tripLen}`,
  });
  if (!resp || resp.dates.length < 6) return null;
  return resp.dates.map((d) => ({ date: d.departureDate, returnDate: d.returnDate, price: d.price }));
}

/**
 * Error fares — SCANNER: amostra precos da rota numa janela e detecta outliers
 * (preco muito abaixo da mediana). Usa dados reais (flight-dates) quando ha
 * cobertura; senao, amostra estimada com anomalias sinteticas (demo).
 */
export const errorFareStrategy: FareStrategy = {
  id: "errorFare",
  label: "Error fares",
  description: "Scanner de outliers: precos muito abaixo do tipico da rota.",
  color: "#ff4d4d",
  async search(query: SearchQuery): Promise<FareResult[]> {
    const real = await sampleReal(query).catch(() => null);
    const source = real ? "real" : "mock";
    const points = real ?? buildMockSample(query);

    const anomalies = scanErrorFares(points);
    if (anomalies.length === 0) return [];

    return anomalies.slice(0, 3).map((a, i) => {
      const rng = seededRng(`ef|${query.origin}${query.destination}|${a.date}|${i}`);
      const carrier = CARRIERS[Math.floor(rng() * CARRIERS.length)];
      const flightNumber = String(100 + Math.floor(rng() * 899));
      return {
        id: `errorFare-${a.date}-${i}`,
        strategy: "errorFare",
        price: a.price,
        currency: query.currency,
        origin: query.origin,
        destination: query.destination,
        carriers: [carrier],
        segments: [{ from: query.origin, to: query.destination, carrier, flightNumber }],
        departureDate: a.date,
        returnDate: a.returnDate,
        cabin: query.cabin,
        tags: [
          "error fare",
          `${a.dropPct}% abaixo do normal`,
          source === "real" ? "scanner (real)" : "scanner (mock)",
          "risco de cancelamento",
        ],
        rationale: `Preco ${a.dropPct}% abaixo do tipico da rota (~${a.baseline} ${query.currency}) em ${a.date}. Possivel erro tarifario: emitir rapido e confirmar antes de planos nao-reembolsaveis.`,
        confidence: "baixa",
        bookingHint: "Emitir imediatamente; aguardar 24-72h antes de comprar hotel etc.",
        bookingUrl: bookingUrlFor(carrier, {
          origin: query.origin,
          destination: query.destination,
          dep: a.date,
          ret: a.returnDate,
          adults: query.adults,
          cabin: query.cabin,
        }),
      } satisfies FareResult;
    });
  },
};
