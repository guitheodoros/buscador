// Cliente do BROWSER para ofertas Duffel via proxy /api/duffel-offers.
// A chave do Duffel fica no servidor. Sem chave/retorno, cai no mock.

const API = "/api";

let duffelLive: boolean | null = null;

export function isDuffelLive(): boolean {
  return duffelLive === true;
}

/** Le /api/health e guarda se o Duffel esta configurado no servidor. */
export async function checkDuffelHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${API}/health`);
    if (!r.ok) {
      duffelLive = false;
      return false;
    }
    const d = await r.json();
    duffelLive = Boolean(d.duffel);
    return duffelLive;
  } catch {
    duffelLive = false;
    return false;
  }
}

export interface DuffelSegment {
  from: string;
  to: string;
  carrier: string;
  flightNumber: string;
}

export interface DuffelOffer {
  id: string;
  price: number;
  currency: string;
  owner: string;
  ownerName: string;
  segments: DuffelSegment[];
}

/** Ofertas reais via Duffel. null se indisponivel/sem chave. */
export async function searchDuffelOffers(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  cabin: string;
}): Promise<DuffelOffer[] | null> {
  try {
    const r = await fetch(`${API}/duffel-offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.offers || d.offers.length === 0) return null;
    return d.offers as DuffelOffer[];
  } catch {
    return null;
  }
}
