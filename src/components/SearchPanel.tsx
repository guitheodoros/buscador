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
  const [methodsOpen, setMethodsOpen] = useState(false);
  const [mode, setMode] = useState<"dates" | "month" | "flight">("dates");
  const [month, setMonth] = useState("2026-11");
  const [nights, setNights] = useState(14);
  const [airline, setAirline] = useState("");
  const [flightNum, setFlightNum] = useState("");
  const [flightDate, setFlightDate] = useState("2026-11-15");

  function toggle(id: StrategyId) {
    setEnabled((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    if (mode === "flight") {
      onSearch({
        origin: "",
        destination: "",
        adults,
        cabin,
        currency: "BRL",
        enabledStrategies: enabled,
        mode: "flight",
        airline: airline.toUpperCase(),
        flightNumber: flightNum,
        departureDate: flightDate,
      });
      return;
    }

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
    <div className="search-panel">
      <h2 className="section">Buscar passagem</h2>

      <div className="mode-toggle">
        <button className={mode === "dates" ? "on" : ""} onClick={() => setMode("dates")} type="button">
          Datas exatas
        </button>
        <button className={mode === "month" ? "on" : ""} onClick={() => setMode("month")} type="button">
          Por mês
        </button>
        <button className={mode === "flight" ? "on" : ""} onClick={() => setMode("flight")} type="button">
          N° do voo
        </button>
      </div>

      {mode !== "flight" && (
        <div className="row">
          <AirportSelect label="Origem" value={origin} onChange={setOrigin} />
          <AirportSelect label="Destino" value={destination} onChange={setDestination} />
        </div>
      )}

      {mode !== "flight" && (
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
      )}

      {mode === "flight" ? (
        <>
          <div className="row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
            <label style={{ flex: "1 1 0", minWidth: 0 }}>
              Companhia
              <select value={airline} onChange={(e) => setAirline(e.target.value)}>
                <option value="">Selecione…</option>
                <optgroup label="Brasil">
                  <option value="LA">LA · LATAM Brasil</option>
                  <option value="G3">G3 · Gol</option>
                  <option value="AD">AD · Azul</option>
                </optgroup>
                <optgroup label="América Latina">
                  <option value="AR">AR · Aerolíneas Argentinas</option>
                  <option value="AV">AV · Avianca</option>
                  <option value="CM">CM · Copa Airlines</option>
                  <option value="H2">H2 · Sky Airline</option>
                  <option value="JJ">JJ · LATAM (intl)</option>
                </optgroup>
                <optgroup label="Europa">
                  <option value="TP">TP · TAP Air Portugal</option>
                  <option value="AF">AF · Air France</option>
                  <option value="KL">KL · KLM</option>
                  <option value="IB">IB · Iberia</option>
                  <option value="BA">BA · British Airways</option>
                  <option value="LH">LH · Lufthansa</option>
                  <option value="LX">LX · Swiss</option>
                  <option value="AZ">AZ · ITA Airways</option>
                  <option value="SK">SK · SAS</option>
                  <option value="AY">AY · Finnair</option>
                </optgroup>
                <optgroup label="América do Norte">
                  <option value="AA">AA · American Airlines</option>
                  <option value="UA">UA · United Airlines</option>
                  <option value="DL">DL · Delta Air Lines</option>
                  <option value="AC">AC · Air Canada</option>
                  <option value="WS">WS · WestJet</option>
                </optgroup>
                <optgroup label="Oriente Médio / Ásia">
                  <option value="EK">EK · Emirates</option>
                  <option value="QR">QR · Qatar Airways</option>
                  <option value="EY">EY · Etihad</option>
                  <option value="TK">TK · Turkish Airlines</option>
                  <option value="SQ">SQ · Singapore Airlines</option>
                  <option value="CX">CX · Cathay Pacific</option>
                  <option value="JL">JL · Japan Airlines</option>
                  <option value="NH">NH · ANA</option>
                </optgroup>
                <optgroup label="África / Oceania">
                  <option value="ET">ET · Ethiopian Airlines</option>
                  <option value="SA">SA · South African</option>
                  <option value="QF">QF · Qantas</option>
                </optgroup>
              </select>
            </label>
            <label style={{ flex: "0 0 100px", minWidth: 0 }}>
              N° do voo
              <input
                type="text"
                placeholder="8080"
                value={flightNum}
                onChange={(e) => setFlightNum(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          </div>
          <div className="row">
            <label>
              Data
              <input type="date" value={flightDate} onChange={(e) => setFlightDate(e.target.value)} />
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
          <p className="muted" style={{ margin: "0 0 8px", lineHeight: 1.4 }}>
            Busca disponibilidade e tarifas para um voo específico em todas as fontes ativas.
          </p>
        </>
      ) : mode === "dates" ? (
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
        <button
          className="strategies-head"
          type="button"
          onClick={() => setMethodsOpen((o) => !o)}
          aria-expanded={methodsOpen}
        >
          <span>
            Métodos <strong>{enabled.length}/{STRATEGIES.length}</strong>
          </span>
          <span className={`chevron ${methodsOpen ? "open" : ""}`}>⌄</span>
        </button>

        {methodsOpen && (
          <div className="strategies-list">
            <div className="strategies-actions">
              <button className="link" onClick={() => setEnabled(DEFAULT_ENABLED)}>
                selecionar todos
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
        )}
      </div>

      <button
        className="primary"
        onClick={submit}
        disabled={loading || enabled.length === 0 || (mode === "flight" && (!airline || airline === "" || !flightNum))}
      >
        {loading ? "Buscando..." : "Buscar em todos os metodos"}
      </button>
    </div>
  );
}
