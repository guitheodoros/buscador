import type { FareResult } from "../types";

// Valor atribuido a cada ponto/milha, em R$. Ex: 0.025 = 2,5 centavos/ponto.
// Programas domesticos costumam valer ~2 a 3 centavos; resgates bons passam disso.
export const DEFAULT_POINT_VALUE = 0.025;

/**
 * Custo efetivo de uma tarifa: dinheiro desembolsado + valor estimado dos
 * pontos gastos. Permite comparar tarifas em dinheiro, em milhas e mistas
 * (pontos + dinheiro) na mesma unidade (R$).
 */
export function effectiveCost(fare: FareResult, pointValue: number): number {
  return fare.price + (fare.points ?? 0) * pointValue;
}

/** True quando a tarifa envolve pontos (o custo efetivo difere do dinheiro). */
export function usesPoints(fare: FareResult): boolean {
  return (fare.points ?? 0) > 0;
}

/** Ordena por custo efetivo (crescente), sem mutar o array original. */
export function sortByEffectiveCost(fares: FareResult[], pointValue: number): FareResult[] {
  return [...fares].sort((a, b) => effectiveCost(a, pointValue) - effectiveCost(b, pointValue));
}
