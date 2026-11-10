export type Cabin = "economy" | "premium" | "business" | "first";

export interface Trip {
  origin: string;
  destination: string;
  departure: string; // YYYY-MM-DD
  returnDate?: string; // ausente = só ida
  adults: number;
  cabin: Cabin;
}

export interface SiteLink {
  id: string;
  name: string;
  hint: string;
  url: string;
}

export interface LinkGroup {
  title: string;
  links: SiteLink[];
}

const yymmdd = (d: string) => d.slice(2).replaceAll("-", "");
function mmddyyyy(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}
function ddmmyyyy(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

const KAYAK_CABIN: Record<Cabin, string> = { economy: "", premium: "/premium", business: "/business", first: "/first" };
const SKY_CABIN: Record<Cabin, string> = { economy: "economy", premium: "premiumeconomy", business: "business", first: "first" };
const TICKETS_CABIN: Record<Cabin, string> = { economy: "economy", premium: "premium_economy", business: "business_class", first: "first_class" };
const GOOGLE_CABIN: Record<Cabin, string> = { economy: "", premium: " premium economy", business: " business class", first: " first class" };

function kayakPath(t: Trip) {
  const dates = t.returnDate ? `${t.departure}/${t.returnDate}` : t.departure;
  const pax = t.adults > 1 ? `/${t.adults}adults` : "";
  return `${t.origin}-${t.destination}/${dates}${KAYAK_CABIN[t.cabin]}${pax}`;
}

function comparators(t: Trip): SiteLink[] {
  const google = `Flights from ${t.origin} to ${t.destination} on ${t.departure}` +
    (t.returnDate ? ` through ${t.returnDate}` : " one way") +
    (t.adults > 1 ? ` for ${t.adults} adults` : "") +
    GOOGLE_CABIN[t.cabin];

  const sky = `https://www.skyscanner.com.br/transporte/passagens-aereas/${t.origin.toLowerCase()}/${t.destination.toLowerCase()}/${yymmdd(t.departure)}/` +
    (t.returnDate ? `${yymmdd(t.returnDate)}/` : "") +
    `?adultsv2=${t.adults}&cabinclass=${SKY_CABIN[t.cabin]}&rtn=${t.returnDate ? 1 : 0}`;

  const tickets = new URLSearchParams({
    from: t.origin, to: t.destination, depart: t.departure,
    ...(t.returnDate && { return: t.returnDate }),
    adults: String(t.adults), classType: TICKETS_CABIN[t.cabin],
  });

  return [
    { id: "google", name: "Google Flights", hint: "Calendário de preços e alertas", url: `https://www.google.com/travel/flights?q=${encodeURIComponent(google)}&curr=BRL&hl=pt-BR` },
    { id: "skyscanner", name: "Skyscanner", hint: "Compara agências e companhias", url: sky },
    { id: "kayak", name: "Kayak", hint: "Ordenado pelo menor preço", url: `https://www.kayak.com.br/flights/${kayakPath(t)}?sort=price_a` },
    { id: "momondo", name: "Momondo", hint: "Costuma achar tarifas de agências menores", url: `https://www.momondo.com.br/flight-search/${kayakPath(t)}?sort=price_a` },
    { id: "tickets", name: "Tickets", hint: "Calendário de preços e autoconexões", url: `https://tickets.com.br/flights?${tickets}#results` },
    { id: "explore", name: `Para onde ir saindo de ${t.origin}?`, hint: "Google Flights · mapa com os destinos mais baratos", url: `https://www.google.com/travel/explore?q=${encodeURIComponent(`Flights from ${t.origin}`)}&curr=BRL&hl=pt-BR` },
  ];
}

function latamParams(t: Trip, miles: boolean) {
  return new URLSearchParams({
    origin: t.origin,
    outbound: `${t.departure}T12:00:00.000Z`,
    destination: t.destination,
    ...(t.returnDate && { inbound: `${t.returnDate}T12:00:00.000Z` }),
    adt: String(t.adults), chd: "0", inf: "0",
    trip: t.returnDate ? "RT" : "OW",
    ...(t.cabin === "economy" && { cabin: "Economy" }),
    redemption: String(miles),
    sort: "RECOMMENDED",
  });
}

function azulParams(t: Trip, miles: boolean) {
  return new URLSearchParams({
    "c[0].ds": t.origin, "c[0].std": mmddyyyy(t.departure), "c[0].as": t.destination,
    ...(t.returnDate && { "c[1].ds": t.destination, "c[1].std": mmddyyyy(t.returnDate), "c[1].as": t.origin }),
    "p[0].t": "ADT", "p[0].c": String(t.adults), "p[0].cp": "false",
    "f.dl": "3", "f.dr": "3", cc: miles ? "PTS" : "BRL",
  });
}

const noonUtcMs = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

function milesPrograms(t: Trip): SiteLink[] {
  const smiles = new URLSearchParams({
    adults: String(t.adults), children: "0", infants: "0", cabin: "ALL",
    departureDate: String(noonUtcMs(t.departure)),
    ...(t.returnDate && { returnDate: String(noonUtcMs(t.returnDate)) }),
    tripType: t.returnDate ? "1" : "2",
    originAirport: t.origin, destinationAirport: t.destination,
    originAirportIsAny: "false", destinAirportIsAny: "false",
    isFlexibleDateChecked: "false", searchType: "g3", segments: "1",
  });

  return [
    { id: "smiles", name: "Smiles", hint: "Milhas da Gol e parceiras", url: `https://www.smiles.com.br/mfe/emissao-passagem/?${smiles}` },
    { id: "latampass", name: "LATAM Pass", hint: "Milhas da LATAM", url: `https://www.latamairlines.com/br/pt/oferta-voos?${latamParams(t, true)}` },
    { id: "tudoazul", name: "TudoAzul", hint: "Pontos da Azul", url: `https://www.voeazul.com.br/br/pt/home/selecao-voo?${azulParams(t, true)}` },
  ];
}

// Nos sites das companhias a cabine é escolhida na própria página de resultados.
function airlines(t: Trip): SiteLink[] {
  const rt = Boolean(t.returnDate);
  const adults = String(t.adults);

  const gol = new URLSearchParams({
    pv: "br", tipo: "DF", de: t.origin, para: t.destination, ida: ddmmyyyy(t.departure),
    ...(t.returnDate && { volta: ddmmyyyy(t.returnDate) }),
    ADT: adults, CHD: "0", INF: "0",
  });

  const copa = new URLSearchParams({
    roundtrip: String(rt), adults, children: "0", infants: "0",
    date1: t.departure, ...(t.returnDate && { date2: t.returnDate }),
    area1: t.origin, area2: t.destination,
    flexible_dates_v2: "false", language: "pt", advanced_air_search: "false",
  });

  const slice = (orig: string, dest: string, date: string) => ({ orig, origNearby: false, dest, destNearby: false, date });
  const american = new URLSearchParams({
    locale: "pt_BR", pax: adults, adult: adults, child: "0",
    type: rt ? "RoundTrip" : "OneWay", searchType: "Revenue", cabin: "", carriers: "ALL",
    slices: JSON.stringify([
      slice(t.origin, t.destination, t.departure),
      ...(t.returnDate ? [slice(t.destination, t.origin, t.returnDate)] : []),
    ]),
  });

  const united = new URLSearchParams({
    f: t.origin, t: t.destination, d: t.departure, ...(t.returnDate && { r: t.returnDate }),
    px: adults, taxng: "1", clm: "7", st: "bestmatches", tqp: rt ? "R" : "O",
  });

  const delta = new URLSearchParams({
    tripType: rt ? "ROUND_TRIP" : "ONE_WAY",
    fromAirportCode: t.origin, toAirportCode: t.destination,
    originCity: t.origin, destinationCity: t.destination,
    departureDate: t.departure, ...(t.returnDate && { returnDate: t.returnDate }),
    paxCount: adults,
  });

  return [
    { id: "latam", name: "LATAM", hint: "Nacionais e internacionais", url: `https://www.latamairlines.com/br/pt/oferta-voos?${latamParams(t, false)}` },
    { id: "gol", name: "Gol", hint: "Nacionais e América do Sul", url: `https://b2c.voegol.com.br/compra/busca-parceiros?${gol}` },
    { id: "azul", name: "Azul", hint: "Nacionais, EUA e Europa", url: `https://www.voeazul.com.br/br/pt/home/selecao-voo?${azulParams(t, false)}` },
    { id: "copa", name: "Copa Airlines", hint: "Via Panamá · preços em dólar", url: `https://shopping.copaair.com/?${copa}` },
    { id: "american", name: "American Airlines", hint: "EUA, via Miami e Dallas", url: `https://www.aa.com/booking/search?${american}` },
    { id: "united", name: "United", hint: "EUA, via Houston, Newark e Chicago", url: `https://www.united.com/pt/br/fsr/choose-flights?${united}` },
    { id: "delta", name: "Delta", hint: "EUA, via Atlanta · clique em “Find Flights”", url: `https://www.delta.com/flightsearch/book-a-flight?${delta}` },
  ];
}

export function buildLinkGroups(t: Trip): LinkGroup[] {
  return [
    { title: "Comparadores", links: comparators(t) },
    { title: "Companhias aéreas", links: airlines(t) },
    { title: "Milhas", links: milesPrograms(t) },
  ];
}
