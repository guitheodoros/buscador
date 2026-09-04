// Base de aeroportos comerciais do mundo (OurAirports: type large/medium com
// codigo IATA e servico regular). Gerada por scripts/gen-airports (ver README).
// ~3200 aeroportos com coordenadas para o globo e as rotas.

import data from "./airports.data.json";

export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

// Apelidos curtos para os principais aeroportos (sobrescrevem o nome longo do
// OurAirports). So afeta a exibicao; coordenadas/IATA continuam da base.
const NAME_OVERRIDES: Record<string, string> = {
  // Brasil
  GRU: "Guarulhos", CGH: "Congonhas", VCP: "Viracopos", GIG: "Galeão",
  SDU: "Santos Dumont", BSB: "Brasília", CNF: "Confins", SSA: "Salvador",
  REC: "Recife", FOR: "Fortaleza", POA: "Porto Alegre", CWB: "Curitiba",
  FLN: "Florianópolis", MAO: "Manaus", BEL: "Belém", NAT: "Natal",
  MCZ: "Maceió", VIX: "Vitória", GYN: "Goiânia", CGB: "Cuiabá",
  CGR: "Campo Grande", IGU: "Foz do Iguaçu",
  // Américas
  JFK: "Nova York (JFK)", EWR: "Newark", LGA: "LaGuardia", MIA: "Miami",
  MCO: "Orlando", FLL: "Fort Lauderdale", LAX: "Los Angeles", SFO: "San Francisco",
  ORD: "Chicago O'Hare", ATL: "Atlanta", DFW: "Dallas/Fort Worth", IAH: "Houston",
  BOS: "Boston", LAS: "Las Vegas", SEA: "Seattle", IAD: "Washington (Dulles)",
  YYZ: "Toronto", YUL: "Montreal", MEX: "Cidade do México", CUN: "Cancún",
  PTY: "Panamá", BOG: "Bogotá", LIM: "Lima", SCL: "Santiago",
  EZE: "Buenos Aires (Ezeiza)", AEP: "Buenos Aires (Aeroparque)", MVD: "Montevidéu",
  ASU: "Assunção",
  // Europa
  LIS: "Lisboa", OPO: "Porto", MAD: "Madri", BCN: "Barcelona",
  CDG: "Paris (CDG)", ORY: "Paris (Orly)", LHR: "Londres (Heathrow)",
  LGW: "Londres (Gatwick)", FRA: "Frankfurt", MUC: "Munique", AMS: "Amsterdã",
  FCO: "Roma (Fiumicino)", MXP: "Milão (Malpensa)", ZRH: "Zurique", GVA: "Genebra",
  VIE: "Viena", BRU: "Bruxelas", CPH: "Copenhague", ARN: "Estocolmo",
  DUB: "Dublin", IST: "Istambul", ATH: "Atenas",
  // Oriente Médio / Ásia / África / Oceania
  DXB: "Dubai", DOH: "Doha", AUH: "Abu Dhabi", TLV: "Tel Aviv",
  DEL: "Délhi", BOM: "Mumbai", SIN: "Singapura", BKK: "Bangkok",
  HKG: "Hong Kong", NRT: "Tóquio (Narita)", HND: "Tóquio (Haneda)", ICN: "Seul",
  PEK: "Pequim", PVG: "Xangai", JNB: "Joanesburgo", CPT: "Cidade do Cabo",
  CAI: "Cairo", SYD: "Sydney", MEL: "Melbourne", AKL: "Auckland",
};

export const AIRPORT_LIST: Airport[] = (data as Airport[]).map((a) =>
  NAME_OVERRIDES[a.iata] ? { ...a, name: NAME_OVERRIDES[a.iata] } : a
);

const BY_IATA: Record<string, Airport> = {};
for (const a of AIRPORT_LIST) BY_IATA[a.iata] = a;

/** Mapa IATA -> aeroporto. */
export const AIRPORTS = BY_IATA;

export function getAirport(iata: string): Airport | undefined {
  return iata ? BY_IATA[iata.toUpperCase()] : undefined;
}
