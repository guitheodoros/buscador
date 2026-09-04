// ---------------------------------------------------------------------------
// Scanner de error fares: detecta precos anomalamente baratos numa amostra de
// precos da rota (por data). A deteccao e por OUTLIER vs mediana robusta —
// funciona com dados reais (flight-dates) ou com a amostra estimada. Para o
// modo demo (sem credenciais), injetamos anomalias sinteticas na amostra.
// ---------------------------------------------------------------------------

import { addDays, estimateRoutePrice } from "./flexMatrix";
import { seededRng } from "./mockFares";
import type { SearchQuery } from "../types";

export interface PricePoint {
  date: string; // ida (YYYY-MM-DD)
  returnDate?: string;
  price: number;
}

export interface Anomaly {
  date: string;
  returnDate?: string;
  price: number;
  baseline: number; // mediana da rota
  dropPct: number; // % abaixo do normal
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Detecta pontos anomalamente baratos: preco < threshold * mediana.
 * threshold 0.55 = pelo menos 45% abaixo do tipico da rota.
 */
export function scanErrorFares(points: PricePoint[], threshold = 0.55): Anomaly[] {
  const prices = points.map((p) => p.price).filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length < 4) return [];
  const base = median(prices);
  if (base <= 0) return [];
  const out: Anomaly[] = [];
  for (const p of points) {
    if (p.price > 0 && p.price < base * threshold) {
      out.push({
        date: p.date,
        returnDate: p.returnDate,
        price: p.price,
        baseline: Math.round(base),
        dropPct: Math.round((1 - p.price / base) * 100),
      });
    }
  }
  return out.sort((a, b) => a.price - b.price);
}

/**
 * Amostra estimada de precos da rota (+/- `days` em torno da ida), com 1-2
 * anomalias sinteticas injetadas de forma deterministica (modo demo).
 */
export function buildMockSample(query: SearchQuery, days = 14): PricePoint[] {
  const tripLen = query.returnDate
    ? Math.max(1, Math.round(
        (Date.parse(`${query.returnDate}T00:00:00Z`) - Date.parse(`${query.departureDate}T00:00:00Z`)) /
          86_400_000
      ))
    : 0;

  const points: PricePoint[] = [];
  for (let i = -days; i <= days; i++) {
    const dep = addDays(query.departureDate, i);
    const ret = tripLen ? addDays(dep, tripLen) : undefined;
    points.push({ date: dep, returnDate: ret, price: estimateRoutePrice(query, dep, ret) });
  }

  // Injeta 1-2 error fares (32%-44% do normal), seed por rota.
  const rng = seededRng(`errorfare|${query.origin}${query.destination}|${query.departureDate}`);
  const n = 1 + Math.floor(rng() * 2);
  for (let k = 0; k < n; k++) {
    const idx = Math.floor(rng() * points.length);
    points[idx] = { ...points[idx], price: Math.round(points[idx].price * (0.32 + rng() * 0.12)) };
  }
  return points;
}
