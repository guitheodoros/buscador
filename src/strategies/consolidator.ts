import type { FareStrategy, FareResult, SearchQuery } from "../types";
import { searchDuffelOffers, isDuffelLive } from "../lib/duffelClient";
import { makeMockFares } from "../lib/mockFares";
import { bookingUrlFor } from "../lib/carriers";

/**
 * Consolidadores / IATA — ofertas reais via Duffel (conteudo de cia + NDC +
 * agencias). Sem chave ou sem retorno, cai no mock de consolidador.
 */
export const consolidatorStrategy: FareStrategy = {
  id: "consolidator",
  label: "Consolidadores / IATA",
  description: "Ofertas reais via Duffel (cia + NDC + agencias) ou mock sem chave.",
  color: "#ff9f40",
  async search(query: SearchQuery): Promise<FareResult[]> {
    const offers = await searchDuffelOffers({
      origin: query.origin,
      destination: query.destination,
      departureDate: query.departureDate,
      returnDate: query.returnDate,
      adults: query.adults,
      cabin: query.cabin,
    });

    if (offers && offers.length > 0) {
      return offers.slice(0, 4).map((o) => {
        const carriers = Array.from(new Set(o.segments.map((s) => s.carrier).filter(Boolean)));
        const primary = o.owner || carriers[0] || "";
        return {
          id: `duffel-${o.id}`,
          strategy: "consolidator",
          price: o.price,
          currency: o.currency,
          origin: query.origin,
          destination: query.destination,
          carriers: carriers.length ? carriers : o.owner ? [o.owner] : [],
          segments: o.segments,
          departureDate: query.departureDate,
          returnDate: query.returnDate,
          cabin: query.cabin,
          tags: ["Duffel", "oferta real", ...(o.ownerName ? [o.ownerName] : [])],
          rationale: `Oferta real via Duffel${o.ownerName ? ` (${o.ownerName})` : ""} — conteudo de companhia, NDC e agencias num so lugar.`,
          confidence: "alta",
          bookingHint: "Emissivel via Duffel / agencia parceira.",
          bookingUrl: bookingUrlFor(primary, {
            origin: query.origin,
            destination: query.destination,
            dep: query.departureDate,
            ret: query.returnDate,
            adults: query.adults,
            cabin: query.cabin,
          }),
        } satisfies FareResult;
      });
    }

    // Fallback mock (sem chave ou sem retorno).
    return makeMockFares(query, {
      strategy: "consolidator",
      discount: 0.78,
      tags: [isDuffelLive() ? "mock (sem retorno)" : "mock (sem chave)", "estoque de bloco"],
      rationale:
        "Consolidadores compram assentos em bloco e repassam abaixo do balcao. Configure DUFFEL_ACCESS_TOKEN para ofertas reais.",
      confidence: "media",
      bookingHint: "Emissao por consolidador/agencia IATA parceira.",
    });
  },
};
