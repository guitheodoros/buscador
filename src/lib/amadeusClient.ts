// Cliente do BROWSER: fala apenas com o proxy backend (/api).
// As credenciais Amadeus ficam no servidor (server/index.js) — o browser
// nunca ve o segredo e nao ha problema de CORS. Se o proxy responder que nao
// ha credenciais/retorno, o chamador cai no modo MOCK.

const API = "/api";

let amadeusLive: boolean | null = null;

/** Estado em cache do ultimo health-check (usado por badges/tags). */
export function isAmadeusLive(): boolean {
  return amadeusLive === true;
}

/** Consulta o proxy para saber se ha credenciais configuradas no servidor. */
export async function checkAmadeusHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${API}/health`);
    if (!r.ok) {
      amadeusLive = false;
      return false;
    }
    const d = await r.json();
    amadeusLive = Boolean(d.amadeus);
    return amadeusLive;
  } catch {
    amadeusLive = false;
    return false;
  }
}

export interface AmadeusFlightOffer {
  id: string;
  price: { total: string; currency: string };
  itineraries: {
    segments: {
      departure: { iataCode: string };
      arrival: { iataCode: string };
      carrierCode: string;
      number: string;
    }[];
  }[];
  validatingAirlineCodes?: string[];
}

/** Busca ofertas reais via proxy. Retorna null para cair no mock. */
export async function searchFlightOffers(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  cabin: string;
  currency: string;
  max?: number;
}): Promise<AmadeusFlightOffer[] | null> {
  try {
    const r = await fetch(`${API}/flight-offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return (d.offers as AmadeusFlightOffer[] | null) ?? null;
  } catch {
    return null;
  }
}

export interface FlightDatePoint {
  departureDate: string;
  returnDate?: string;
  price: number;
}

export interface FlightDatesResult {
  dates: FlightDatePoint[];
  currency: string | null;
}

/** Grade de datas mais baratas (Flight Cheapest Date Search) via proxy. */
export async function searchFlightDates(params: {
  origin: string;
  destination: string;
  departureDate: string; // "YYYY-MM-DD" ou range "d1,d2"
  oneWay?: boolean;
  duration?: string; // "dMin,dMax" em dias (round trip)
}): Promise<FlightDatesResult | null> {
  try {
    const q = new URLSearchParams({
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departureDate,
    });
    if (params.oneWay !== undefined) q.set("oneWay", String(params.oneWay));
    if (params.duration) q.set("duration", params.duration);

    const r = await fetch(`${API}/flight-dates?${q.toString()}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.dates || d.dates.length === 0) return null;
    const dates = (d.dates as FlightDatePoint[]).filter((p) => Number.isFinite(p.price));
    if (dates.length === 0) return null;
    return { dates, currency: d.currency ?? null };
  } catch {
    return null;
  }
}
