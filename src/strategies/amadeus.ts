import type { FareStrategy, FareResult, SearchQuery } from "../types";
import { searchFlightOffers, isAmadeusLive } from "../lib/amadeusClient";
import { makeMockFares } from "../lib/mockFares";
import { bookingUrlFor } from "../lib/carriers";

/**
 * Estrategia base: busca GDS via Amadeus Self-Service.
 * Se houver credenciais e a chamada funcionar, usa dados REAIS.
 * Caso contrario, cai em mock (marcado como referencia de mercado).
 */
export const amadeusStrategy: FareStrategy = {
  id: "amadeus",
  label: "Busca padrao (GDS)",
  description: "Ofertas reais via Amadeus Self-Service. Referencia de mercado.",
  color: "#4aa3ff",
  async search(query: SearchQuery): Promise<FareResult[]> {
    const offers = await searchFlightOffers({
      origin: query.origin,
      destination: query.destination,
      departureDate: query.departureDate,
      returnDate: query.returnDate,
      adults: query.adults,
      cabin: query.cabin,
      currency: query.currency,
      max: 8,
    });

    if (offers && offers.length > 0) {
      return offers.map((o, idx) => {
        const segs = o.itineraries.flatMap((it) =>
          it.segments.map((s) => ({
            from: s.departure.iataCode,
            to: s.arrival.iataCode,
            carrier: s.carrierCode,
            flightNumber: s.number,
          }))
        );
        const carriers = Array.from(new Set(segs.map((s) => s.carrier)));
        return {
          id: `amadeus-real-${o.id}-${idx}`,
          strategy: "amadeus",
          price: Math.round(parseFloat(o.price.total)),
          currency: o.price.currency,
          origin: query.origin,
          destination: query.destination,
          carriers,
          segments: segs,
          departureDate: query.departureDate,
          returnDate: query.returnDate,
          cabin: query.cabin,
          tags: ["dados reais", "GDS"],
          rationale: "Oferta real retornada pela Amadeus Self-Service API.",
          confidence: "alta",
          bookingHint: "Emissivel via GDS / OTA / cia aerea.",
          bookingUrl: bookingUrlFor(o.validatingAirlineCodes?.[0] ?? carriers[0], {
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

    // Fallback mock
    return makeMockFares(
      query,
      {
        strategy: "amadeus",
        discount: 1.0,
        tags: isAmadeusLive() ? ["mock (sem retorno)"] : ["mock (sem chave)"],
        rationale:
          "Referencia de mercado simulada (sem credenciais Amadeus ou sem CORS/retorno). Configure .env para dados reais.",
        confidence: "media",
        bookingHint: "Emissivel via GDS / OTA / cia aerea.",
      },
      3
    );
  },
};
