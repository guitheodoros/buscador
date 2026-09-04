// Helpers compartilhados de mapa de calor (matriz de datas e calendario do mes).

/** Cor do mapa de calor: verde (barato) -> vermelho (caro). */
export function heatColor(price: number, min: number, max: number): string {
  if (max <= min) return "hsl(140 60% 42%)";
  const t = (price - min) / (max - min);
  const hue = 140 * (1 - t); // 140 verde -> 0 vermelho
  return `hsl(${hue} 65% 42%)`;
}

/** Preco curto: 5.2k, 940. */
export function fmtShort(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}
