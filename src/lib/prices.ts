import { API_BASE } from "./apiBase";
import type { Trip } from "./flightLinks";

export interface PriceOffer {
  price: number;
  airline: string;
  flightNumber: string;
  seller: string;
  originAirport: string;
  destinationAirport: string;
  departureAt: string;
  returnAt: string | null;
  stops: number;
  returnStops: number;
  durationTo: number;
  durationBack: number;
  url: string;
}

export interface PriceResult {
  exact: PriceOffer[];
  otherDates: PriceOffer[];
}

export async function fetchPrices(t: Trip): Promise<PriceResult> {
  const q = new URLSearchParams({
    origin: t.origin,
    destination: t.destination,
    departure: t.departure,
    ...(t.returnDate && { returnDate: t.returnDate }),
  });
  const r = await fetch(`${API_BASE}/prices?${q}`);
  const body = await r.json();
  if (!body.exact) throw new Error(body.reason ?? `HTTP ${r.status}`);
  return body as PriceResult;
}

const AIRLINES: Record<string, string> = {
  LA: "LATAM", JJ: "LATAM", G3: "Gol", AD: "Azul", TP: "TAP", AA: "American", UA: "United", DL: "Delta",
  CM: "Copa", AV: "Avianca", AR: "Aerolíneas Argentinas", H2: "Sky", JA: "JetSMART", AM: "Aeroméxico",
  IB: "Iberia", UX: "Air Europa", AF: "Air France", KL: "KLM", LH: "Lufthansa", LX: "Swiss", BA: "British Airways",
  AZ: "ITA Airways", TK: "Turkish", EK: "Emirates", QR: "Qatar", EY: "Etihad", ET: "Ethiopian", SA: "South African",
  AT: "Royal Air Maroc", CA: "Air China", VY: "Vueling", FR: "Ryanair", U2: "easyJet", OS: "Austrian",
  SN: "Brussels", SK: "SAS", AY: "Finnair", AC: "Air Canada", B6: "JetBlue", NK: "Spirit", F9: "Frontier",
  WN: "Southwest", AS: "Alaska",
};

export const airlineName = (code: string) => AIRLINES[code] ?? code;

/** "2026-12-14T22:15:00-03:00" -> "14/12" (usa a data local do voo, sem converter fuso). */
export const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const shortTime = (iso: string) => iso.slice(11, 16);

export function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export const stopsLabel = (n: number) => (n === 0 ? "direto" : n === 1 ? "1 parada" : `${n} paradas`);

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
