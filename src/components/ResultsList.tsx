import type { FareResult } from "../types";
import { STRATEGY_MAP } from "../strategies";
import { effectiveCost, usesPoints } from "../lib/pricing";
import { airlineName, airlineSite } from "../lib/carriers";

function fmtMoney(v: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
  } catch {
    return `${currency} ${v}`;
  }
}

const confidenceLabel: Record<FareResult["confidence"], string> = {
  alta: "estavel",
  media: "moderada",
  baixa: "arriscada",
};

function FareCard({
  fare,
  best,
  pointValue,
}: {
  fare: FareResult;
  best: boolean;
  pointValue: number;
}) {
  const strat = STRATEGY_MAP[fare.strategy];
  const route = fare.segments.map((s) => s.from).concat(fare.segments.at(-1)!.to).join(" → ");
  const withPoints = usesPoints(fare);
  const eff = effectiveCost(fare, pointValue);

  // Companhia principal (primeiro trecho) para rotular o link de compra.
  const primaryCarrier = fare.segments.find((s) => s.carrier)?.carrier ?? fare.carriers[0] ?? "";
  const hasSite = Boolean(airlineSite(primaryCarrier));
  const buyLabel = withPoints
    ? "Buscar award ↗"
    : hasSite
      ? `Comprar na ${airlineName(primaryCarrier)} ↗`
      : "Comprar ↗";

  return (
    <div className={`fare-card ${best ? "best" : ""}`} style={{ borderLeftColor: strat.color }}>
      <div className="fare-top">
        <span className="badge" style={{ background: strat.color }}>
          {strat.label}
        </span>
        {best && <span className="best-badge">MELHOR CUSTO</span>}
        <span className={`conf conf-${fare.confidence}`}>{confidenceLabel[fare.confidence]}</span>
      </div>

      {/* Custo efetivo e a base de comparacao (destaque). */}
      <div className="fare-effective">
        {fmtMoney(eff, fare.currency)}
        <span className="eff-label">custo efetivo</span>
      </div>

      {/* Composicao: dinheiro (+ pontos, quando houver). */}
      <div className="fare-breakdown">
        {fmtMoney(fare.price, fare.currency)} em dinheiro
        {withPoints ? (
          <span className="points">
            {" + "}
            {fare.points!.toLocaleString("pt-BR")} pts
            {fare.pointsProgram ? ` · ${fare.pointsProgram}` : ""}
          </span>
        ) : null}
      </div>

      <div className="fare-route">{route}</div>

      {/* Voos: trecho + companhia + numero do voo. */}
      <div className="fare-flights">
        {fare.segments.some((s) => s.carrier)
          ? fare.segments.map((s, i) => (
              <div key={i} className="flight-line">
                <span className="leg">
                  {s.from}→{s.to}
                </span>
                {s.carrier && (
                  <span className="flight-no">
                    {airlineName(s.carrier)} · {s.carrier}
                    {s.flightNumber ? ` ${s.flightNumber}` : ""}
                  </span>
                )}
              </div>
            ))
          : fare.carriers.length > 0 && (
              <div className="flight-line">
                <span className="flight-no">{fare.carriers.join(", ")}</span>
              </div>
            )}
      </div>

      <div className="fare-tags">
        {fare.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
      <p className="fare-rationale">{fare.rationale}</p>
      {fare.bookingHint && <p className="fare-hint">Emissao: {fare.bookingHint}</p>}
      {fare.bookingUrl && (
        <a className="buy" href={fare.bookingUrl} target="_blank" rel="noopener noreferrer">
          {buyLabel}
        </a>
      )}
    </div>
  );
}

interface ResultsListProps {
  results: FareResult[];
  cheapestId?: string;
  tookMs?: number;
  loading: boolean;
  pointValue: number;
  onPointValueChange: (v: number) => void;
}

export function ResultsList({
  results,
  cheapestId,
  tookMs,
  loading,
  pointValue,
  onPointValueChange,
}: ResultsListProps) {
  const pointValueLabel = pointValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  const hasPointsFares = results.some(usesPoints);

  return (
    <div className="results-panel">
      <div className="results-head">
        <h2>Resultados</h2>
        {results.length > 0 && (
          <span className="muted">
            {results.length} ofertas · {tookMs}ms
          </span>
        )}
      </div>

      {/* Controle do valor do ponto: reordena por custo efetivo na hora. */}
      {(results.length > 0 || hasPointsFares) && (
        <div className="point-value">
          <div className="pv-head">
            <span>Valor do ponto</span>
            <strong>{pointValueLabel} /pt</strong>
          </div>
          <input
            type="range"
            min={0.005}
            max={0.08}
            step={0.005}
            value={pointValue}
            onChange={(e) => onPointValueChange(Number(e.target.value))}
          />
          <p className="muted pv-hint">
            Custo efetivo = dinheiro + pontos × valor. Suba o valor para “penalizar”
            tarifas de milhas; abaixe para favorecê-las.
          </p>
        </div>
      )}

      {loading && <p className="muted">Consultando todos os metodos em paralelo…</p>}
      {!loading && results.length === 0 && (
        <p className="muted">
          Configure a busca e clique em “Buscar”. Cada metodo aparece com sua cor no globo.
        </p>
      )}

      <div className="fare-list">
        {results.map((f) => (
          <FareCard key={f.id} fare={f} best={f.id === cheapestId} pointValue={pointValue} />
        ))}
      </div>
    </div>
  );
}
