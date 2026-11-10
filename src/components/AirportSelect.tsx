import { useEffect, useRef, useState } from "react";
import { getAirport, searchAirports } from "../lib/airports";

interface AirportSelectProps {
  label: string;
  value: string; // IATA
  onChange: (iata: string) => void;
}

/** Combobox de aeroporto: filtra por cidade, nome do aeroporto ou codigo IATA. */
export function AirportSelect({ label, value, onChange }: AirportSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = getAirport(value);
  const matches = searchAirports(query);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(iata: string) {
    onChange(iata);
    setQuery("");
    setOpen(false);
  }

  const display = open ? query : selected ? `${selected.city} · ${selected.name} (${selected.iata})` : value;

  return (
    <div className="airport-select" ref={ref}>
      <span className="as-label">{label}</span>
      <input
        value={display}
        placeholder="cidade, aeroporto ou IATA"
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && open && matches[0]) {
            e.preventDefault();
            choose(matches[0].iata);
            e.currentTarget.blur();
          }
        }}
      />
      {open && matches.length > 0 && (
        <ul className="airport-list">
          {matches.map((a) => (
            <li key={a.iata} onMouseDown={() => choose(a.iata)}>
              <span className="as-city">{a.city}</span>
              <span className="as-name">{a.name}</span>
              <span className="as-iata">{a.iata}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
