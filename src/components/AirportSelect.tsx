import { useEffect, useRef, useState } from "react";
import { AIRPORT_LIST, getAirport } from "../lib/airports";

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
  const q = query.trim().toLowerCase();
  const matches = AIRPORT_LIST.filter(
    (a) =>
      !q ||
      a.iata.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q)
  ).slice(0, 8);

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
