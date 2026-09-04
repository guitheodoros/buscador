import type { FareResult, SearchQuery } from "../types";
import { STRATEGIES } from "../strategies";

export interface AggregateResult {
  results: FareResult[];
  /** Estrategias que falharam (id -> mensagem). */
  errors: Record<string, string>;
  cheapest?: FareResult;
  tookMs: number;
}

/**
 * Roda todas as estrategias habilitadas em paralelo, agrega e ordena por preco.
 * Falha de uma estrategia nao derruba as demais.
 */
export async function aggregateSearch(query: SearchQuery): Promise<AggregateResult> {
  const t0 = performance.now();
  const enabled = query.enabledStrategies?.length
    ? STRATEGIES.filter((s) => query.enabledStrategies!.includes(s.id))
    : STRATEGIES;

  const errors: Record<string, string> = {};

  const settled = await Promise.allSettled(
    enabled.map(async (s) => {
      const r = await s.search(query);
      return r;
    })
  );

  const results: FareResult[] = [];
  settled.forEach((res, i) => {
    if (res.status === "fulfilled") {
      results.push(...res.value);
    } else {
      errors[enabled[i].id] = String(res.reason?.message ?? res.reason);
    }
  });

  results.sort((a, b) => a.price - b.price);

  return {
    results,
    errors,
    cheapest: results[0],
    tookMs: Math.round(performance.now() - t0),
  };
}
