import { useState } from "react";
import type { SearchQuery, StrategyId } from "../types";
import { STRATEGIES } from "../strategies";
import { AirportSelect } from "./AirportSelect";

interface SearchPanelProps {
  onSearch: (q: SearchQuery) => void;
  loading: boolean;
}

const DEFAULT_ENABLED: StrategyId[] = STRATEGIES.map((s) => s.id);

export function SearchPanel({ onSearch, loading }: SearchPanelProps) {
  const [origin, setOrigin] = useState("GRU");
  const [destination, setDestination] = useState("LIS");
  const [departureDate, setDepartureDate] = useState("2026-11-15");
  const [returnDate, setReturnDate] = useState("2026-11-29");
  const [roundTrip, setRoundTrip] = useState(true);
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState<SearchQuery["cabin"]>("ECONOMY");
  const [enabled, setEnabled] = useState<StrategyId[]>(DEFAULT_ENABLED);
  const [flexible, setFlexible] = useState(true);
  const [mode, setMode] = useState<"dates" | "month">("dates");
  const [month, setMonth] = useState("2026-11");
  const [nights, setNights] = useState(14);

  function toggle(id: StrategyId) {
    setEnabled((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    const base = {
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      adults,
      cabin,
      currency: "BRL",
      enabledStrategies: enabled,
    } as const;

    if (mode === "month") {
      // Datas provisorias (1o do mes); o App resolve o dia mais barato.
      onSearch({
        ...base,
        mode: "month",
        month,
        nights: roundTrip ? nights : undefined,
        departureDate: `${month}-01`,
        returnDate: roundTrip ? `${month}-01` : undefined,
      });
      return;
    }

    onSearch({
      ...base,
      mode: "dates",
      departureDate,
      returnDate: roundTrip ? returnDate : undefined,
      flexible,
      flexDays: 3,
    });
  }

  return (
    <div className="panel search-panel">
      <h2>Buscar passagem</h2>

      <div className="row">
        <AirportSelect label="Origem" value={origin} onChange={setOrigin} />
        <AirportSelect label="Destino" value={destination} onChange={setDestination} />
      </div>

      <div className="mode-toggle">
        <button
          className={mode === "dates" ? "on" : ""}
          onClick={() => setMode("dates")}
          type="button"
        >
          Datas exatas
        </button>
        <button
          className={mode === "month" ? "on" : ""}
          onClick={() => setMode("month")}
          type="button"
        >
          Por mês
        </button>
      </div>

      <div className="row">
        <label className="checkbox">
          <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} />
          Ida e volta
        </label>
        <label>
          Adultos
          <input
            type="number"
            min={1}
            max={9}
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
          />
        </label>
        <label>
          Cabine
          <select value={cabin} onChange={(e) => setCabin(e.target.value as SearchQuery["cabin"])}>
            <option value="ECONOMY">Economica</option>
            <option value="PREMIUM_ECONOMY">Premium Economy</option>
            <option value="BUSINESS">Executiva</option>
            <option value="FIRST">Primeira</option>
          </select>
        </label>
      </div>

      {mode === "dates" ? (
        <>
          <div className="row">
            <label>
              Ida
              <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
            </label>
            <label>
              Volta
              <input
                type="date"
                value={returnDate}
                disabled={!roundTrip}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </label>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} />
            Datas flexíveis (± 3 dias) · mapa de calor
          </label>
        </>
      ) : (
        <div className="row">
          <label>
            Mês
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <label>
            Noites
            <input
              type="number"
              min={1}
              max={60}
              value={nights}
              disabled={!roundTrip}
              onChange={(e) => setNights(Number(e.target.value))}
            />
          </label>
        </div>
      )}

      <div className="strategies">
        <div className="strategies-head">
          <span>Metodos ({enabled.length}/{STRATEGIES.length})</span>
          <button className="link" onClick={() => setEnabled(DEFAULT_ENABLED)}>
            todos
          </button>
        </div>
        {STRATEGIES.map((s) => (
          <label key={s.id} className="strategy-toggle" title={s.description}>
            <input
              type="checkbox"
              checked={enabled.includes(s.id)}
              onChange={() => toggle(s.id)}
            />
            <span className="dot" style={{ background: s.color }} />
            {s.label}
          </label>
        ))}
      </div>

      <button className="primary" onClick={submit} disabled={loading || enabled.length === 0}>
        {loading ? "Buscando..." : "Buscar em todos os metodos"}
      </button>
    </div>
  );
}
