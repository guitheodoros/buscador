import type { FareStrategy, StrategyId } from "../types";
import { amadeusStrategy } from "./amadeus";
import { consolidatorStrategy } from "./consolidator";
import { errorFareStrategy } from "./errorFare";
import { milesStrategy } from "./miles";
import { mockStrategies } from "./mockStrategies";

/** Registro central de todas as estrategias disponiveis. */
export const STRATEGIES: FareStrategy[] = [
  amadeusStrategy,
  consolidatorStrategy,
  ...mockStrategies,
  errorFareStrategy,
  milesStrategy,
];

export const STRATEGY_MAP: Record<StrategyId, FareStrategy> = Object.fromEntries(
  STRATEGIES.map((s) => [s.id, s])
) as Record<StrategyId, FareStrategy>;

export function getStrategyColor(id: StrategyId): string {
  return STRATEGY_MAP[id]?.color ?? "#ffffff";
}
