// Nomes de companhias por codigo IATA + geradores de link de compra.

export const AIRLINES: Record<string, string> = {
  TP: "TAP Air Portugal",
  LA: "LATAM",
  JJ: "LATAM Brasil",
  AD: "Azul",
  G3: "GOL",
  AA: "American Airlines",
  UA: "United",
  DL: "Delta",
  IB: "Iberia",
  AF: "Air France",
  KL: "KLM",
  BA: "British Airways",
  LH: "Lufthansa",
  TK: "Turkish Airlines",
  EK: "Emirates",
  QR: "Qatar Airways",
  EY: "Etihad",
  UX: "Air Europa",
  AZ: "ITA Airways",
  AV: "Avianca",
  CM: "Copa Airlines",
  AM: "Aeromexico",
  AR: "Aerolineas Argentinas",
};

export function airlineName(code: string): string {
  if (!code) return "";
  return AIRLINES[code.toUpperCase()] ?? code.toUpperCase();
}

// Site oficial de compra por companhia (codigo IATA -> URL).
export const AIRLINE_SITES: Record<string, string> = {
  TP: "https://www.flytap.com",
  LA: "https://www.latamairlines.com",
  JJ: "https://www.latamairlines.com",
  AD: "https://www.voeazul.com.br",
  G3: "https://www.voegol.com.br",
  AA: "https://www.aa.com",
  UA: "https://www.united.com",
  DL: "https://www.delta.com",
  IB: "https://www.iberia.com",
  AF: "https://www.airfrance.com",
  KL: "https://www.klm.com",
  BA: "https://www.britishairways.com",
  LH: "https://www.lufthansa.com",
  TK: "https://www.turkishairlines.com",
  EK: "https://www.emirates.com",
  QR: "https://www.qatarairways.com",
  EY: "https://www.etihad.com",
  UX: "https://www.aireuropa.com",
  AZ: "https://www.ita-airways.com",
  AV: "https://www.avianca.com",
  CM: "https://www.copaair.com",
  AM: "https://www.aeromexico.com",
  AR: "https://www.aerolineas.com.ar",
};

/** Site oficial da companhia, se conhecido. */
export function airlineSite(code: string): string | undefined {
  return code ? AIRLINE_SITES[code.toUpperCase()] : undefined;
}

/** Link de busca de voos (dinheiro) na Kayak, por rota e datas (fallback). */
export function kayakUrl(origin: string, destination: string, dep: string, ret?: string): string {
  const base = `https://www.kayak.com/flights/${origin}-${destination}/${dep}`;
  return ret ? `${base}/${ret}` : base;
}

// --- Deep-links prefilled por companhia (rota/datas/pax/cabine) ------------
// Apenas companhias com formato ESTAVEL e VERIFICADO entram aqui. Cada builder
// gera um link que ja abre a busca preenchida. Adicionar uma cia = 1 entrada,
// depois de verificar o formato dela ao vivo.

export interface BookingParams {
  origin: string;
  destination: string;
  dep: string; // "YYYY-MM-DD"
  ret?: string; // "YYYY-MM-DD"
  adults: number;
  cabin: string; // ECONOMY | PREMIUM_ECONOMY | BUSINESS | FIRST
}

// LATAM (verificado): oferta-voos abre a busca com rota/datas/pax/cabine.
function latamDeepLink(p: BookingParams): string {
  const cabin = p.cabin === "BUSINESS" || p.cabin === "FIRST" ? "Business" : "Economy";
  const q = new URLSearchParams({
    origin: p.origin,
    destination: p.destination,
    outbound: `${p.dep}T15:00:00.000Z`,
    adt: String(p.adults),
    chd: "0",
    inf: "0",
    trip: p.ret ? "RT" : "OW",
    cabin,
    redemption: "false",
    sort: "RECOMMENDED",
  });
  if (p.ret) q.set("inbound", `${p.ret}T15:00:00.000Z`);
  return `https://www.latamairlines.com/br/pt/oferta-voos?${q.toString()}`;
}

const DEEPLINKS: Record<string, (p: BookingParams) => string> = {
  LA: latamDeepLink,
  JJ: latamDeepLink,
};

/** Deep-link prefilled da companhia, se houver formato verificado. */
export function airlineDeepLink(code: string, p: BookingParams): string | undefined {
  const build = code ? DEEPLINKS[code.toUpperCase()] : undefined;
  return build ? build(p) : undefined;
}

/**
 * Link de compra, em ordem de preferencia:
 *  1. deep-link prefilled da cia (rota/datas ja preenchidas) — se verificado;
 *  2. site oficial da cia (home de reserva);
 *  3. Kayak por rota/datas (fallback para cia desconhecida).
 */
export function bookingUrlFor(carrier: string, p: BookingParams): string {
  return (
    airlineDeepLink(carrier, p) ??
    airlineSite(carrier) ??
    kayakUrl(p.origin, p.destination, p.dep, p.ret)
  );
}

/** Link de busca para award de milhas (pesquisa do programa). */
export function awardSearchUrl(program: string, origin: string, destination: string): string {
  const q = encodeURIComponent(`${program} award ${origin} ${destination}`);
  return `https://www.google.com/search?q=${q}`;
}
