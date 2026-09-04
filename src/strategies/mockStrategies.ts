import type { FareStrategy, SearchQuery } from "../types";
import { makeMockFares, seededRng } from "../lib/mockFares";
import { getAirport } from "../lib/airports";

// Hubs de conexao/emissao. A escolha VARIA por rota (semeada). Lisboa (LIS)
// nao entra como escala — segue valido apenas como destino.
const HUBS = ["MAD", "IST", "BOG", "MEX", "AMS", "DOH", "MIA", "FRA", "PTY"];
function pickVia(query: SearchQuery): string {
  const options = HUBS.filter(
    (h) => h !== query.origin && h !== query.destination && getAirport(h)
  );
  if (options.length === 0) return "MAD";
  const rng = seededRng(`via|${query.origin}${query.destination}`);
  return options[Math.floor(rng() * options.length)];
}

export const privateFareStrategy: FareStrategy = {
  id: "privateFare",
  label: "Tarifas privadas / corporativas",
  description: "Tarifas negociadas, privadas e acordos corporativos.",
  color: "#b06bff",
  async search(q) {
    return makeMockFares(q, {
      strategy: "privateFare",
      discount: 0.72,
      tags: ["tarifa privada", "acordo corporativo"],
      rationale:
        "Tarifas negociadas (PNR/CAT-35) e acordos corporativos ficam fora dos canais publicos. Requer credencial de agencia.",
      confidence: "media",
      bookingHint: "Requer codigo corporativo / conta de agencia com o contrato.",
    });
  },
};

export const combinationStrategy: FareStrategy = {
  id: "combination",
  label: "Combinacoes / hidden-city",
  description: "Combinacao de companhias, virtual interlining e hidden-city.",
  color: "#2dd4bf",
  async search(q) {
    return makeMockFares(q, {
      strategy: "combination",
      discount: 0.68,
      tags: ["virtual interlining", "hidden-city"],
      rationale:
        "Combinar bilhetes separados de cias diferentes (self-transfer) ou usar hidden-city pode sair mais barato. Atencao a bagagem e a risco de perda de conexao.",
      confidence: "baixa",
      bookingHint: "Bilhetes separados: sem protecao de conexao. Nao despache bagagem no hidden-city.",
      via: pickVia(q),
    });
  },
};

export const fareBasisStrategy: FareStrategy = {
  id: "fareBasis",
  label: "Fare basis especifico",
  description: "Classes tarifarias/fare basis especificos com regras favoraveis.",
  color: "#f472b6",
  async search(q) {
    return makeMockFares(q, {
      strategy: "fareBasis",
      discount: 0.82,
      tags: ["fare basis", "classe tarifaria"],
      rationale:
        "Certos fare basis (ex: classes promocionais com restricoes de estadia) liberam precos menores nao expostos por padrao.",
      confidence: "media",
      bookingHint: "Buscar por codigo de tarifa especifico no GDS.",
    });
  },
};

export const originMarketStrategy: FareStrategy = {
  id: "originMarket",
  label: "Mercado de origem / emissao por pais",
  description: "Emitir a partir de outro mercado de origem/pais costuma reduzir a tarifa.",
  color: "#a3e635",
  async search(q) {
    return makeMockFares(q, {
      strategy: "originMarket",
      discount: 0.64,
      tags: ["outro mercado", "point of sale"],
      rationale:
        "O mesmo voo tem precos diferentes conforme o pais de emissao (point of sale). Emitir via mercado mais barato + trecho de posicionamento pode compensar.",
      confidence: "media",
      bookingHint: "Considere trecho de posicionamento e moeda/point-of-sale de emissao.",
      via: pickVia(q),
    });
  },
};

export const pointsCashStrategy: FareStrategy = {
  id: "pointsCash",
  label: "Pontos/milhas + dinheiro",
  description: "Emissao combinando pontos com pagamento em dinheiro.",
  color: "#38bdf8",
  async search(q) {
    return makeMockFares(q, {
      strategy: "pointsCash",
      discount: 0.45,
      tags: ["pontos + cash", "cash & points"],
      rationale:
        "Modo 'cash & points': parte em pontos, parte em dinheiro. Bom quando faltam milhas para o resgate cheio.",
      confidence: "media",
      bookingHint: "Opcao cash&points no programa da cia/emissor.",
      points: { amount: 30000, program: "Cash & Points" },
    });
  },
};

export const flashPromoStrategy: FareStrategy = {
  id: "flashPromo",
  label: "Promocoes relampago",
  description: "Promocoes de curtissima duracao (flash sales).",
  color: "#ff6ec7",
  async search(q) {
    return makeMockFares(
      q,
      {
        strategy: "flashPromo",
        discount: 0.55,
        tags: ["flash sale", "janela curta"],
        rationale:
          "Promocoes-relampago duram horas. Dependem de monitoramento continuo e alerta em tempo real.",
        confidence: "media",
        bookingHint: "Ativar alertas; janela pode fechar em horas.",
      },
      1
    );
  },
};

export const mockStrategies: FareStrategy[] = [
  privateFareStrategy,
  combinationStrategy,
  fareBasisStrategy,
  originMarketStrategy,
  pointsCashStrategy,
  flashPromoStrategy,
];
