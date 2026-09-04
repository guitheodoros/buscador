// ---------------------------------------------------------------------------
// Matriz de datas flexiveis (ida x volta) com preco por celula.
//
// Fonte primaria: "Flight Cheapest Date Search" da Amadeus (via /api/flight-dates)
// — retorna a grade de datas mais baratas numa chamada. Cobertura limitada
// (rotas em cache; test env e restrito), entao caimos num ESTIMADOR sensivel a
// data (fim de semana, alta temporada) quando nao ha dado real. A matriz carrega
// `source` para a UI mostrar qual fonte esta ativa. Nao misturamos as escalas.
// ---------------------------------------------------------------------------

import { distanceKm, seededRng } from "./mockFares";
import { searchFlightDates } from "./amadeusClient";
import type { SearchQuery } from "../types";

const cabinMultiplier: Record<string, number> = {
  ECONOMY: 1,
  PREMIUM_ECONOMY: 1.8,
  BUSINESS: 3.4,
  FIRST: 6,
};

// "Melhor tarifa em dinheiro" estimada entre os metodos (consolidador/origem).
const BEST_CASH_DISCOUNT = 0.6;

export type MatrixSource = "amadeus" | "estimado";

export interface MatrixCell {
  depDate: string;
  retDate?: string;
  /** null = combinacao invalida (volta <= ida) ou sem dado real. */
  price: number | null;
}

export interface DateMatrix {
  depDates: string[];
  retDates: string[]; // vazio quando so-ida
  cells: MatrixCell[][]; // [depIdx][retIdx]
  min: number;
  max: number;
  currency: string;
  oneWay: boolean;
  source: MatrixSource;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}

/** Fator de preco por data: fim de semana e alta temporada encarecem. */
function dateFactor(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 Dom .. 6 Sab
  const weekend = dow === 5 || dow === 6 || dow === 0 ? 1.12 : 1.0;
  const month = d.getUTCMonth(); // 0..11
  const highSeason = month === 11 || month === 0 || month === 6 ? 1.18 : 1.0; // Dez/Jan/Jul
  const rng = seededRng(iso);
  const jitter = 0.9 + rng() * 0.2;
  return weekend * highSeason * jitter;
}

function legPrice(km: number, cabin: string, iso: string): number {
  const oneWayBase = 450 + km * 0.45;
  const cab = cabinMultiplier[cabin] ?? 1;
  return oneWayBase * cab * dateFactor(iso);
}

/** Preco estimado da "melhor tarifa em dinheiro" para um par de datas. */
export function estimateRoutePrice(query: SearchQuery, depDate: string, retDate?: string): number {
  const km = distanceKm(query.origin, query.destination);
  const dep = legPrice(km, query.cabin, depDate);
  const ret = retDate ? legPrice(km, query.cabin, retDate) : 0;
  return Math.round((dep + ret) * BEST_CASH_DISCOUNT);
}

function range(center: string, radius: number): string[] {
  const out: string[] = [];
  for (let i = -radius; i <= radius; i++) out.push(addDays(center, i));
  return out;
}

function emptyCells(depDates: string[], retDates: string[], oneWay: boolean): MatrixCell[][] {
  return depDates.map((dep) =>
    oneWay
      ? [{ depDate: dep, price: null }]
      : retDates.map((ret) => ({ depDate: dep, retDate: ret, price: null }))
  );
}

function minMax(cells: MatrixCell[][]): { min: number; max: number; filled: number } {
  let min = Infinity;
  let max = -Infinity;
  let filled = 0;
  for (const row of cells)
    for (const c of row)
      if (c.price !== null) {
        min = Math.min(min, c.price);
        max = Math.max(max, c.price);
        filled++;
      }
  if (!isFinite(min)) return { min: 0, max: 0, filled: 0 };
  return { min, max, filled };
}

/** Matriz ESTIMADA (fallback). Sempre preenchida. */
export function buildEstimatedMatrix(query: SearchQuery, radius = 3): DateMatrix {
  const km = distanceKm(query.origin, query.destination);
  const oneWay = !query.returnDate;
  const depDates = range(query.departureDate, radius);
  const retDates = oneWay ? [] : range(query.returnDate!, radius);

  const cells: MatrixCell[][] = depDates.map((dep) => {
    if (oneWay) {
      return [{ depDate: dep, price: Math.round(legPrice(km, query.cabin, dep) * BEST_CASH_DISCOUNT) }];
    }
    return retDates.map((ret) => {
      if (ret <= dep) return { depDate: dep, retDate: ret, price: null };
      const total = legPrice(km, query.cabin, dep) + legPrice(km, query.cabin, ret);
      return { depDate: dep, retDate: ret, price: Math.round(total * BEST_CASH_DISCOUNT) };
    });
  });

  const { min, max } = minMax(cells);
  return { depDates, retDates, cells, min, max, currency: query.currency, oneWay, source: "estimado" };
}

/** Matriz REAL via Amadeus flight-dates. null se nao houver dado utilizavel. */
export async function buildRealMatrix(query: SearchQuery, radius = 3): Promise<DateMatrix | null> {
  const oneWay = !query.returnDate;
  const depDates = range(query.departureDate, radius);
  const retDates = oneWay ? [] : range(query.returnDate!, radius);
  const depFrom = depDates[0];
  const depTo = depDates[depDates.length - 1];

  // Restringe a duracao para que as voltas caiam na janela da grade.
  let duration: string | undefined;
  if (!oneWay) {
    const durMin = Math.max(1, daysBetween(depTo, retDates[0]));
    const durMax = Math.max(durMin, daysBetween(depFrom, retDates[retDates.length - 1]));
    duration = `${durMin},${durMax}`;
  }

  const resp = await searchFlightDates({
    origin: query.origin,
    destination: query.destination,
    departureDate: `${depFrom},${depTo}`,
    oneWay,
    duration,
  });
  if (!resp) return null;

  const cells = emptyCells(depDates, retDates, oneWay);
  for (const pt of resp.dates) {
    const di = depDates.indexOf(pt.departureDate);
    if (di < 0) continue;
    const ci = oneWay ? 0 : pt.returnDate ? retDates.indexOf(pt.returnDate) : -1;
    if (ci < 0) continue;
    const cell = cells[di][ci];
    if (cell.price === null || pt.price < cell.price) cell.price = pt.price;
  }

  const { min, max, filled } = minMax(cells);
  if (filled === 0) return null;
  return {
    depDates,
    retDates,
    cells,
    min,
    max,
    currency: resp.currency ?? query.currency,
    oneWay,
    source: "amadeus",
  };
}

/** Tenta a grade real; cai no estimador se nao houver dado. */
export async function buildFlexMatrix(query: SearchQuery, radius = 3): Promise<DateMatrix> {
  const real = await buildRealMatrix(query, radius).catch(() => null);
  return real ?? buildEstimatedMatrix(query, radius);
}

// ---------------------------------------------------------------------------
// Modo "por mes": preco mais barato por dia do mes (calendario heat map).
// ---------------------------------------------------------------------------

export interface MonthDay {
  date: string; // "YYYY-MM-DD"
  price: number | null; // null = sem dado real
}

export interface MonthMatrix {
  year: number;
  month: number; // 0-11
  days: MonthDay[]; // dia 1..N do mes
  min: number;
  max: number;
  currency: string;
  source: MatrixSource;
  nights: number | null; // null = so ida
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function ymd(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface MonthOpts {
  year: number;
  month: number; // 0-11
  nights: number;
  oneWay: boolean;
}

function monthOptsFromQuery(q: SearchQuery): MonthOpts {
  const [y, m] = (q.month ?? "2026-11").split("-").map(Number);
  const oneWay = !q.nights;
  return { year: y, month: (m || 1) - 1, nights: q.nights ?? 0, oneWay };
}

/** Calendario ESTIMADO do mes (fallback). Sempre preenchido. */
export function buildMonthEstimated(query: SearchQuery, opts: MonthOpts): MonthMatrix {
  const km = distanceKm(query.origin, query.destination);
  const n = daysInMonth(opts.year, opts.month);
  const days: MonthDay[] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let d = 1; d <= n; d++) {
    const dep = ymd(opts.year, opts.month, d);
    let price: number;
    if (opts.oneWay) {
      price = Math.round(legPrice(km, query.cabin, dep) * BEST_CASH_DISCOUNT);
    } else {
      const ret = addDays(dep, opts.nights);
      price = Math.round((legPrice(km, query.cabin, dep) + legPrice(km, query.cabin, ret)) * BEST_CASH_DISCOUNT);
    }
    min = Math.min(min, price);
    max = Math.max(max, price);
    days.push({ date: dep, price });
  }
  return {
    year: opts.year,
    month: opts.month,
    days,
    min,
    max,
    currency: query.currency,
    source: "estimado",
    nights: opts.oneWay ? null : opts.nights,
  };
}

/** Calendario REAL do mes via Amadeus flight-dates. null se sem dado. */
export async function buildMonthReal(query: SearchQuery, opts: MonthOpts): Promise<MonthMatrix | null> {
  const n = daysInMonth(opts.year, opts.month);
  const first = ymd(opts.year, opts.month, 1);
  const last = ymd(opts.year, opts.month, n);
  const resp = await searchFlightDates({
    origin: query.origin,
    destination: query.destination,
    departureDate: `${first},${last}`,
    oneWay: opts.oneWay,
    duration: opts.oneWay ? undefined : `${opts.nights},${opts.nights}`,
  });
  if (!resp) return null;

  const priceByDate = new Map<string, number>();
  for (const pt of resp.dates) {
    const cur = priceByDate.get(pt.departureDate);
    if (cur === undefined || pt.price < cur) priceByDate.set(pt.departureDate, pt.price);
  }
  if (priceByDate.size === 0) return null;

  const days: MonthDay[] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let d = 1; d <= n; d++) {
    const date = ymd(opts.year, opts.month, d);
    const price = priceByDate.has(date) ? priceByDate.get(date)! : null;
    if (price !== null) {
      min = Math.min(min, price);
      max = Math.max(max, price);
    }
    days.push({ date, price });
  }
  if (!isFinite(min)) return null;
  return {
    year: opts.year,
    month: opts.month,
    days,
    min,
    max,
    currency: resp.currency ?? query.currency,
    source: "amadeus",
    nights: opts.oneWay ? null : opts.nights,
  };
}

/** Tenta o calendario real; cai no estimador. */
export async function buildMonthMatrix(query: SearchQuery): Promise<MonthMatrix> {
  const opts = monthOptsFromQuery(query);
  const real = await buildMonthReal(query, opts).catch(() => null);
  return real ?? buildMonthEstimated(query, opts);
}

/** Data mais barata do calendario (null se vazio). */
export function cheapestMonthDay(mm: MonthMatrix): string | null {
  let best: string | null = null;
  let bestPrice = Infinity;
  for (const d of mm.days) {
    if (d.price !== null && d.price < bestPrice) {
      bestPrice = d.price;
      best = d.date;
    }
  }
  return best;
}
