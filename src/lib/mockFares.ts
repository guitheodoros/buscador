// Utilitarios para gerar tarifas MOCK plausiveis e deterministicas.
// Base: distancia great-circle -> preco-base; RNG semeada pela query.

import { getAirport } from "./airports";
import { bookingUrlFor, awardSearchUrl } from "./carriers";
import type { FareResult, SearchQuery, StrategyId, FareSegment } from "../types";

const CARRIERS = ["TP", "LA", "AD", "AA", "IB", "AF", "KL", "TK", "EK", "QR", "UX", "AZ", "G3", "JJ"];

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Distancia em km entre dois aeroportos (Haversine). */
export function distanceKm(a: string, b: string): number {
  const A = getAirport(a);
  const B = getAirport(b);
  if (!A || !B) return 8000; // fallback generico
  const R = 6371;
  const dLat = toRad(B.lat - A.lat);
  const dLon = toRad(B.lon - A.lon);
  const lat1 = toRad(A.lat);
  const lat2 = toRad(B.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** RNG deterministica (mulberry32) a partir de uma string. */
export function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cabinMultiplier: Record<string, number> = {
  ECONOMY: 1,
  PREMIUM_ECONOMY: 1.8,
  BUSINESS: 3.4,
  FIRST: 6,
};

/** Preco-base de referencia (ida) para a query, em BRL aproximado. */
export function basePrice(query: SearchQuery): number {
  const km = distanceKm(query.origin, query.destination);
  const perKm = 0.45; // R$/km aproximado
  const rt = query.returnDate ? 1.9 : 1; // ida e volta ~ 1.9x
  const cabin = cabinMultiplier[query.cabin] ?? 1;
  return Math.round((450 + km * perKm) * rt * cabin);
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export interface MockSpec {
  strategy: StrategyId;
  /** Multiplicador aplicado ao preco-base (0.4 = 60% off). */
  discount: number;
  tags: string[];
  rationale: string;
  confidence: FareResult["confidence"];
  bookingHint?: string;
  /** Opcional: pontos + dinheiro. */
  points?: { amount: number; program: string };
  /** Escala em cidade extra (hidden-city / combinacao / origem alternativa). */
  via?: string;
}

/** Gera 1..n resultados mock para uma estrategia, variando cia e preco. */
export function makeMockFares(
  query: SearchQuery,
  spec: MockSpec,
  count = 2
): FareResult[] {
  const base = basePrice(query);
  const results: FareResult[] = [];
  for (let i = 0; i < count; i++) {
    const rng = seededRng(`${spec.strategy}|${query.origin}${query.destination}|${i}`);
    const jitter = 0.9 + rng() * 0.2;
    const price = Math.round(base * spec.discount * jitter);
    const carrier = pick(rng, CARRIERS);
    const flightNo = () => String(100 + Math.floor(rng() * 899));
    const segments: FareSegment[] = spec.via
      ? [
          { from: query.origin, to: spec.via, carrier, flightNumber: flightNo() },
          { from: spec.via, to: query.destination, carrier: pick(rng, CARRIERS), flightNumber: flightNo() },
        ]
      : [{ from: query.origin, to: query.destination, carrier, flightNumber: flightNo() }];
    const carriers = Array.from(new Set(segments.map((s) => s.carrier)));
    results.push({
      id: `${spec.strategy}-${i}-${query.origin}${query.destination}`,
      strategy: spec.strategy,
      price,
      currency: query.currency,
      points: spec.points?.amount,
      pointsProgram: spec.points?.program,
      origin: query.origin,
      destination: query.destination,
      carriers,
      segments,
      departureDate: query.departureDate,
      returnDate: query.returnDate,
      cabin: query.cabin,
      tags: spec.tags,
      rationale: spec.rationale,
      confidence: spec.confidence,
      bookingHint: spec.bookingHint,
      // Tarifas com pontos -> busca de award; em dinheiro -> deep-link/site da cia.
      bookingUrl: spec.points
        ? awardSearchUrl(spec.points.program, query.origin, query.destination)
        : bookingUrlFor(carriers[0], {
            origin: query.origin,
            destination: query.destination,
            dep: query.departureDate,
            ret: query.returnDate,
            adults: query.adults,
            cabin: query.cabin,
          }),
    });
  }
  return results;
}
