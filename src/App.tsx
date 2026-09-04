import { useEffect, useMemo, useState } from "react";
import { Globe } from "./components/Globe";
import { SearchPanel } from "./components/SearchPanel";
import { ResultsList } from "./components/ResultsList";
import { DateMatrix } from "./components/DateMatrix";
import { MonthCalendar } from "./components/MonthCalendar";
import { aggregateSearch } from "./lib/aggregate";
import { checkAmadeusHealth } from "./lib/amadeusClient";
import { checkSeatsHealth } from "./lib/seatsClient";
import { checkDuffelHealth } from "./lib/duffelClient";
import { DEFAULT_POINT_VALUE, sortByEffectiveCost } from "./lib/pricing";
import {
  buildFlexMatrix,
  buildMonthMatrix,
  cheapestMonthDay,
  addDays,
  type DateMatrix as Matrix,
  type MonthMatrix,
} from "./lib/flexMatrix";
import type { FareResult, SearchQuery } from "./types";

export default function App() {
  const [rawResults, setRawResults] = useState<FareResult[]>([]);
  const [tookMs, setTookMs] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [amadeusLive, setAmadeusLive] = useState(false);
  const [seatsLive, setSeatsLive] = useState(false);
  const [duffelLive, setDuffelLive] = useState(false);
  const [pointValue, setPointValue] = useState(DEFAULT_POINT_VALUE);
  const [baseQuery, setBaseQuery] = useState<SearchQuery | null>(null);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [monthMatrix, setMonthMatrix] = useState<MonthMatrix | null>(null);
  const [searchCount, setSearchCount] = useState(0);

  useEffect(() => {
    checkAmadeusHealth().then(setAmadeusLive);
    checkSeatsHealth().then(setSeatsLive);
    checkDuffelHealth().then(setDuffelLive);
  }, []);

  // Ordena por custo efetivo (dinheiro + pontos*valor). Recomputa quando o
  // usuario ajusta o valor do ponto, sem refazer a busca.
  const results = useMemo(
    () => sortByEffectiveCost(rawResults, pointValue),
    [rawResults, pointValue]
  );
  const cheapestId = results[0]?.id;

  async function aggregateFor(q: SearchQuery) {
    const agg = await aggregateSearch(q);
    setRawResults(agg.results);
    setTookMs(agg.tookMs);
  }

  async function runSearch(q: SearchQuery) {
    setSearchCount((c) => c + 1);
    setLoading(true);
    setRawResults([]);
    setBaseQuery(q);
    setMatrix(null);
    setMonthMatrix(null);
    try {
      if (q.mode === "month") {
        // Monta o calendario do mes, escolhe o dia mais barato e busca nele.
        const mm = await buildMonthMatrix(q);
        setMonthMatrix(mm);
        const day = cheapestMonthDay(mm) ?? `${q.month}-01`;
        const effQ = { ...q, departureDate: day, returnDate: q.nights ? addDays(day, q.nights) : undefined };
        setBaseQuery(effQ);
        await aggregateFor(effQ);
      } else {
        // Datas exatas: matriz ida x volta assincrona (nao bloqueia resultados).
        if (q.flexible) buildFlexMatrix(q, q.flexDays ?? 3).then(setMatrix);
        await aggregateFor(q);
      }
    } finally {
      setLoading(false);
    }
  }

  // Clique numa celula da matriz ida x volta: busca aquele par e recentra.
  function pickDates(dep: string, ret?: string) {
    if (!baseQuery) return;
    runSearch({ ...baseQuery, departureDate: dep, returnDate: ret });
  }

  // Clique num dia do calendario: busca aquele dia (mantendo o calendario).
  async function pickDay(date: string) {
    if (!baseQuery) return;
    const effQ = {
      ...baseQuery,
      departureDate: date,
      returnDate: baseQuery.nights ? addDays(date, baseQuery.nights) : undefined,
    };
    setBaseQuery(effQ);
    setLoading(true);
    try {
      await aggregateFor(effQ);
    } finally {
      setLoading(false);
    }
  }

  const hasMatrix = Boolean(monthMatrix || matrix);

  return (
    <div className="app">
      <div className="globe-bg">
        <Globe results={results} cheapestId={cheapestId} zoomKey={searchCount} />
      </div>

      <main className={`bento ${hasMatrix ? "has-matrix" : ""}`}>
        <div className="bg-title" aria-hidden="true">
          <span>Buscador</span>
          <span>de Sonhos</span>
        </div>

        <section className="tile tile-search">
          <SearchPanel onSearch={runSearch} loading={loading} />
        </section>

        {monthMatrix ? (
          <section className="tile tile-matrix">
            <MonthCalendar
              matrix={monthMatrix}
              selectedDate={baseQuery?.departureDate}
              onPick={pickDay}
              onClose={() => setMonthMatrix(null)}
            />
          </section>
        ) : matrix ? (
          <section className="tile tile-matrix">
            <DateMatrix
              matrix={matrix}
              selectedDep={baseQuery?.departureDate}
              selectedRet={baseQuery?.returnDate}
              onPick={pickDates}
              onClose={() => setMatrix(null)}
            />
          </section>
        ) : null}

        <section className="tile tile-results">
          <ResultsList
            results={results}
            cheapestId={cheapestId}
            tookMs={tookMs}
            loading={loading}
            pointValue={pointValue}
            onPointValueChange={setPointValue}
          />
        </section>
      </main>

      <footer className="statusbar">
        <span className={`data-mode ${amadeusLive ? "live" : "mock"}`}>
          {amadeusLive ? "Amadeus ao vivo" : "Amadeus mock"}
        </span>
        <span className={`data-mode ${seatsLive ? "live" : "mock"}`}>
          {seatsLive ? "seats.aero ao vivo" : "milhas mock"}
        </span>
        <span className={`data-mode ${duffelLive ? "live" : "mock"}`}>
          {duffelLive ? "Duffel ao vivo" : "consolidador mock"}
        </span>
      </footer>
    </div>
  );
}
