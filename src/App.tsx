import { useEffect, useRef, useState } from "react";
import { AirportSelect } from "./components/AirportSelect";
import { buildLinkGroups, type Cabin, type Trip } from "./lib/flightLinks";

function isoInDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [dark, setDark] = useState(false);
  const [origin, setOrigin] = useState("GRU");
  const [destination, setDestination] = useState("LIS");
  const [departure, setDeparture] = useState(isoInDays(30));
  const [returnDate, setReturnDate] = useState(isoInDays(44));
  const [roundTrip, setRoundTrip] = useState(true);
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState<Cabin>("economy");
  const [trip, setTrip] = useState<Trip | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (trip) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [trip]);

  const invalid = !origin || !destination || origin === destination || !departure ||
    (roundTrip && (!returnDate || returnDate < departure));

  function search() {
    setTrip({ origin, destination, departure, returnDate: roundTrip ? returnDate : undefined, adults, cabin });
  }

  const groups = trip ? buildLinkGroups(trip) : [];

  return (
    <div className={`app${dark ? " dark" : ""}`}>
      <button className="theme-toggle" onClick={() => setDark((d) => !d)} title={dark ? "Modo claro" : "Modo noturno"}>
        {dark ? "☀" : "☾"}
      </button>

      <main className="bento">
        <section className="tile tile-search">
          {/* Um único filho do tile: senão cada linha vira uma camada própria e cobre a lista de aeroportos */}
          <div>
            <h2 className="section">Buscar passagem</h2>

            <div className="row">
              <AirportSelect label="Origem" value={origin} onChange={setOrigin} />
              <AirportSelect label="Destino" value={destination} onChange={setDestination} />
            </div>

            <div className="row">
              <label className="checkbox">
                <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} />
                Ida e volta
              </label>
              <label>
                Adultos
                <input type="number" min={1} max={9} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))} />
              </label>
              <label>
                Cabine
                <select value={cabin} onChange={(e) => setCabin(e.target.value as Cabin)}>
                  <option value="economy">Econômica</option>
                  <option value="premium">Premium</option>
                  <option value="business">Executiva</option>
                  <option value="first">Primeira</option>
                </select>
              </label>
            </div>

            <div className="row">
              <label>
                Ida
                <input type="date" value={departure} onChange={(e) => setDeparture(e.target.value)} />
              </label>
              <label>
                Volta
                <input type="date" value={returnDate} disabled={!roundTrip} min={departure} onChange={(e) => setReturnDate(e.target.value)} />
              </label>
            </div>

            <button className="primary" onClick={search} disabled={invalid}>
              Buscar preços
            </button>
          </div>
        </section>

        <section className="tile tile-results" ref={resultsRef}>
          {trip ? (
            <>
              <h2 className="section">
                {trip.origin} → {trip.destination}
              </h2>
              <p className="muted" style={{ margin: "0 0 14px" }}>
                Abra cada site e compare — os preços mudam entre eles.
              </p>
              {groups.map((g, i) => (
                <details key={g.title} className="site-group" open={i === 0}>
                  <summary className="site-group-title">
                    <span>
                      {g.title} <span className="site-group-count">{g.links.length}</span>
                    </span>
                    <span className="chevron">⌄</span>
                  </summary>
                  <div className="site-list">
                    {g.links.map((l) => (
                      <a key={l.id} className="site-link" href={l.url} target="_blank" rel="noopener noreferrer">
                        <span>
                          <strong>{l.name}</strong>
                          <span className="muted">{l.hint}</span>
                        </span>
                        <span className="site-arrow">↗</span>
                      </a>
                    ))}
                  </div>
                </details>
              ))}
            </>
          ) : (
            <>
              <h2 className="section">Onde procurar</h2>
              <p className="muted" style={{ margin: 0 }}>
                Preencha a viagem e clique em “Buscar preços” para abrir a mesma busca nos comparadores (Google Flights,
                Skyscanner, Kayak, Momondo, Tickets), nos sites das companhias aéreas e nos programas de milhas.
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
