// ---------------------------------------------------------------------------
// Tipos de dominio compartilhados por todo o app.
// ---------------------------------------------------------------------------

/** Identificador de cada metodo de busca (as 13 estrategias do escopo). */
export type StrategyId =
  | "amadeus" // busca padrao GDS (Amadeus Self-Service)
  | "consolidator" // consolidadores internacionais / agencias IATA
  | "privateFare" // tarifas privadas / negociadas / acordos corporativos
  | "combination" // combinacoes de companhias / hidden-city / virtual interlining
  | "fareBasis" // fare basis especificos
  | "originMarket" // mercados de origem / emissao por determinado pais
  | "miles" // programas de milhas
  | "pointsCash" // pontos/milhas + dinheiro
  | "errorFare" // erros tarifarios (error fares)
  | "flashPromo"; // promocoes de curtissima duracao

export interface SearchQuery {
  origin: string; // IATA, ex: "GRU"
  destination: string; // IATA, ex: "LIS"
  departureDate: string; // ISO yyyy-mm-dd
  returnDate?: string; // ISO yyyy-mm-dd (opcional -> so ida)
  adults: number;
  cabin: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
  currency: string; // ex: "BRL"
  /** Estrategias ativas; se vazio, roda todas. */
  enabledStrategies?: StrategyId[];
  /** Dica de UI: montar matriz de datas flexiveis. Ignorado pelas estrategias. */
  flexible?: boolean;
  /** Raio da matriz de datas (dias para cada lado). */
  flexDays?: number;
  /** Modo de busca: datas exatas ou o mes inteiro. */
  mode?: "dates" | "month";
  /** Mes escolhido no modo "month" (formato "YYYY-MM"). */
  month?: string;
  /** Duracao em noites no modo "month" (ida e volta); ausente = so ida. */
  nights?: number;
}

export interface FareSegment {
  from: string; // IATA
  to: string; // IATA
  carrier: string; // codigo IATA da cia, ex: "TP"
  flightNumber?: string;
}

export interface FareResult {
  id: string;
  strategy: StrategyId;
  price: number;
  currency: string;
  /** Para "pontos+dinheiro": pontos/milhas alem do valor em dinheiro. */
  points?: number;
  pointsProgram?: string;
  origin: string;
  destination: string;
  carriers: string[]; // cias envolvidas (codigos IATA)
  segments: FareSegment[];
  departureDate: string;
  returnDate?: string;
  cabin: string;
  /** Rotulos curtos que explicam o "truque" da tarifa. */
  tags: string[];
  /** Explicacao legivel do metodo usado. */
  rationale: string;
  /** Confianca/estabilidade da tarifa (error fares sao baixos). */
  confidence: "alta" | "media" | "baixa";
  bookingHint?: string; // onde/como emitir
  bookingUrl?: string; // link externo para comprar/pesquisar
}

/** Contrato que toda estrategia de busca precisa implementar. */
export interface FareStrategy {
  id: StrategyId;
  label: string;
  description: string;
  /** Cor usada no globo/legenda (hex). */
  color: string;
  search(query: SearchQuery): Promise<FareResult[]>;
}
