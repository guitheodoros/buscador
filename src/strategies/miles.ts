import type { FareStrategy, FareResult, SearchQuery, FareSegment } from "../types";
import { searchAwardLeg, isSeatsLive, type AwardOption, type SeatsCabin } from "../lib/seatsClient";
import { makeMockFares } from "../lib/mockFares";
import { awardSearchUrl } from "../lib/carriers";

const CABIN_MAP: Record<SearchQuery["cabin"], SeatsCabin> = {
  ECONOMY: "economy",
  PREMIUM_ECONOMY: "premium",
  BUSINESS: "business",
  FIRST: "first",
};

// Cambio aproximado para BRL (taxas do seats vem em moeda estrangeira).
const FX: Record<string, number> = { USD: 5.0, EUR: 5.5, GBP: 6.4, CAD: 3.7, AUD: 3.3, BRL: 1 };
function toBRL(value: number, currency: string): number {
  return Math.round(value * (FX[currency] ?? 5.0));
}

// Nomes amigaveis dos programas (Source do seats.aero).
const PROGRAMS: Record<string, string> = {
  aeroplan: "Aeroplan",
  united: "United MileagePlus",
  delta: "Delta SkyMiles",
  alaska: "Alaska Mileage Plan",
  americanairlines: "AAdvantage",
  american: "AAdvantage",
  virginatlantic: "Virgin Atlantic",
  flyingblue: "Flying Blue",
  aeromexico: "Aeromexico Rewards",
  emirates: "Emirates Skywards",
  etihad: "Etihad Guest",
  qantas: "Qantas FF",
  velocity: "Virgin Australia",
  lifemiles: "Avianca LifeMiles",
  smiles: "Smiles",
  azul: "TudoAzul",
  qatar: "Qatar Privilege Club",
  singapore: "KrisFlyer",
  turkish: "Miles&Smiles",
  jetblue: "JetBlue TrueBlue",
};
const pretty = (code: string) => PROGRAMS[code.toLowerCase()] ?? code;

/** Melhor opcao (menos milhas) por programa. */
function bestPerProgram(opts: AwardOption[]): Map<string, AwardOption> {
  const m = new Map<string, AwardOption>();
  for (const o of opts) {
    const cur = m.get(o.program);
    if (!cur || o.miles < cur.miles) m.set(o.program, o);
  }
  return m;
}

/** Constroi tarifas de award a partir das pernas. [] se nao houver combinacao. */
function buildAwardFares(
  query: SearchQuery,
  out: AwardOption[] | null,
  back: AwardOption[] | null
): FareResult[] {
  if (!out || out.length === 0) return [];
  const roundTrip = Boolean(query.returnDate);
  if (roundTrip && (!back || back.length === 0)) return []; // sem volta em award -> mock

  const bestOut = bestPerProgram(out);
  const bestBack = roundTrip ? bestPerProgram(back!) : null;

  type Combo = { program: string; miles: number; taxes: number; foreign: boolean; direct: boolean };
  const combos: Combo[] = [];

  for (const [program, o] of bestOut) {
    if (roundTrip) {
      const b = bestBack!.get(program);
      if (!b) continue; // programa nao tem volta -> ignora
      combos.push({
        program,
        miles: o.miles + b.miles,
        taxes: toBRL(o.taxes, o.taxesCurrency) + toBRL(b.taxes, b.taxesCurrency),
        foreign: o.taxesCurrency !== "BRL" || b.taxesCurrency !== "BRL",
        direct: o.direct && b.direct,
      });
    } else {
      combos.push({
        program,
        miles: o.miles,
        taxes: toBRL(o.taxes, o.taxesCurrency),
        foreign: o.taxesCurrency !== "BRL",
        direct: o.direct,
      });
    }
  }

  combos.sort((a, b) => a.miles - b.miles);

  return combos.slice(0, 4).map((c, i) => {
    const segments: FareSegment[] = roundTrip
      ? [
          { from: query.origin, to: query.destination, carrier: "" },
          { from: query.destination, to: query.origin, carrier: "" },
        ]
      : [{ from: query.origin, to: query.destination, carrier: "" }];
    const tags = [
      "award real",
      "seats.aero",
      c.direct ? "direto" : "com conexao",
      roundTrip ? "ida+volta" : "somente ida",
    ];
    if (c.foreign) tags.push("taxas ~BRL (cambio aprox)");
    return {
      id: `miles-award-${c.program}-${i}`,
      strategy: "miles",
      price: c.taxes,
      currency: "BRL",
      points: c.miles,
      pointsProgram: pretty(c.program),
      origin: query.origin,
      destination: query.destination,
      carriers: [pretty(c.program)],
      segments,
      departureDate: query.departureDate,
      returnDate: query.returnDate,
      cabin: query.cabin,
      tags,
      rationale: `Disponibilidade real de award (seats.aero) via ${pretty(
        c.program
      )}. Paga ${c.miles.toLocaleString("pt-BR")} milhas + taxas. Disponibilidade muda em tempo real.`,
      confidence: "media",
      bookingHint: `Emitir no programa ${pretty(c.program)} — assento de award pode sumir rapido.`,
      bookingUrl: awardSearchUrl(pretty(c.program), query.origin, query.destination),
    } satisfies FareResult;
  });
}

export const milesStrategy: FareStrategy = {
  id: "miles",
  label: "Programas de milhas",
  description: "Disponibilidade real de award via seats.aero (ou mock sem chave).",
  color: "#fbbf24",
  async search(query: SearchQuery): Promise<FareResult[]> {
    const cabin = CABIN_MAP[query.cabin] ?? "economy";
    const out = await searchAwardLeg({
      origin: query.origin,
      destination: query.destination,
      cabin,
      date: query.departureDate,
    });
    const back = query.returnDate
      ? await searchAwardLeg({
          origin: query.destination,
          destination: query.origin,
          cabin,
          date: query.returnDate,
        })
      : null;

    const real = buildAwardFares(query, out, back);
    if (real.length > 0) return real;

    // Fallback mock (sem chave ou sem disponibilidade real).
    return makeMockFares(query, {
      strategy: "miles",
      discount: 0.12, // taxas em dinheiro
      tags: [isSeatsLive() ? "mock (sem award)" : "mock (sem chave)"],
      rationale:
        "Emissao 100% em milhas: paga so as taxas em dinheiro. Configure SEATS_AERO_API_KEY para disponibilidade real de award.",
      confidence: "media",
      bookingHint: "Verificar disponibilidade de award no programa (seats.aero).",
      points: { amount: 65000, program: "Smiles/LATAM Pass/TudoAzul" },
    });
  },
};
