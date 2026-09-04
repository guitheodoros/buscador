// Cliente do BROWSER para award (milhas) via proxy /api/award-search.
// A chave do seats.aero fica no servidor. Sem chave/disponibilidade, retorna
// null e a estrategia de milhas cai no mock.

const API = "/api";

let seatsLive: boolean | null = null;

export function isSeatsLive(): boolean {
  return seatsLive === true;
}

/** Le /api/health e guarda se o seats.aero esta configurado no servidor. */
export async function checkSeatsHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${API}/health`);
    if (!r.ok) {
      seatsLive = false;
      return false;
    }
    const d = await r.json();
    seatsLive = Boolean(d.seats);
    return seatsLive;
  } catch {
    seatsLive = false;
    return false;
  }
}

export type SeatsCabin = "economy" | "premium" | "business" | "first";

export interface AwardOption {
  program: string;
  date: string;
  miles: number;
  direct: boolean;
  taxes: number;
  taxesCurrency: string;
  origin: string;
  destination: string;
}

/** Disponibilidade de award para UM trecho, numa data. null se indisponivel. */
export async function searchAwardLeg(params: {
  origin: string;
  destination: string;
  cabin: SeatsCabin;
  date: string;
}): Promise<AwardOption[] | null> {
  try {
    const q = new URLSearchParams({
      origin: params.origin,
      destination: params.destination,
      cabin: params.cabin,
      startDate: params.date,
      endDate: params.date,
    });
    const r = await fetch(`${API}/award-search?${q.toString()}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.awards || d.awards.length === 0) return null;
    return d.awards as AwardOption[];
  } catch {
    return null;
  }
}
