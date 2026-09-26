import { useState, useEffect } from "react";

interface Monitor {
  id: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  cabin: string;
  targetPrice: number;
  email: string;
  lastPrice?: number;
  lastChecked?: string;
  priceHistory?: { date: string; price: number }[];
  active: boolean;
}

interface Props {
  defaultOrigin?: string;
  defaultDestination?: string;
  defaultDep?: string;
  defaultRet?: string;
}

export function PriceMonitor({ defaultOrigin = "", defaultDestination = "", defaultDep = "", defaultRet = "" }: Props) {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState(defaultOrigin);
  const [destination, setDestination] = useState(defaultDestination);
  const [dep, setDep] = useState(defaultDep);
  const [ret, setRet] = useState(defaultRet);
  const [targetPrice, setTargetPrice] = useState("");
  const [email, setEmail] = useState("");
  const [cabin, setCabin] = useState("ECONOMY");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/monitors").then((r) => r.json()).then(setMonitors).catch(() => {});
  }, []);

  useEffect(() => { if (defaultOrigin) setOrigin(defaultOrigin); }, [defaultOrigin]);
  useEffect(() => { if (defaultDestination) setDestination(defaultDestination); }, [defaultDestination]);
  useEffect(() => { if (defaultDep) setDep(defaultDep); }, [defaultDep]);
  useEffect(() => { if (defaultRet) setRet(defaultRet); }, [defaultRet]);

  async function save() {
    if (!origin || !destination || !dep || !targetPrice || !email) return;
    setSaving(true);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, departureDate: dep, returnDate: ret || undefined, cabin, targetPrice: Number(targetPrice), email }),
      });
      const monitor = await res.json();
      setMonitors((prev) => [...prev, monitor]);
      setOpen(false);
      setTargetPrice("");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/monitors/${id}`, { method: "DELETE" });
    setMonitors((prev) => prev.filter((m) => m.id !== id));
  }

  const cabineLabel: Record<string, string> = { ECONOMY: "Econômica", PREMIUM_ECONOMY: "Premium Eco", BUSINESS: "Executiva", FIRST: "Primeira" };

  return (
    <div className="monitor-panel">
      <div className="monitor-head">
        <h2 className="section" style={{ margin: 0 }}>Alertas de preço</h2>
        <button className="link" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancelar" : "+ Criar alerta"}
        </button>
      </div>

      {open && (
        <div className="monitor-form">
          <div className="row">
            <label>
              Origem
              <input value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase())} placeholder="GRU" maxLength={3} />
            </label>
            <label>
              Destino
              <input value={destination} onChange={(e) => setDestination(e.target.value.toUpperCase())} placeholder="LIS" maxLength={3} />
            </label>
          </div>
          <div className="row">
            <label>Ida<input type="date" value={dep} onChange={(e) => setDep(e.target.value)} /></label>
            <label>Volta<input type="date" value={ret} onChange={(e) => setRet(e.target.value)} /></label>
          </div>
          <div className="row">
            <label>
              Preço alvo (R$)
              <input type="number" min={1} value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="2500" />
            </label>
            <label>
              Cabine
              <select value={cabin} onChange={(e) => setCabin(e.target.value)}>
                <option value="ECONOMY">Econômica</option>
                <option value="PREMIUM_ECONOMY">Premium Eco</option>
                <option value="BUSINESS">Executiva</option>
                <option value="FIRST">Primeira</option>
              </select>
            </label>
          </div>
          <label>
            Email para alertas
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
          </label>
          <button
            className="primary"
            onClick={save}
            disabled={saving || !origin || !destination || !dep || !targetPrice || !email}
            style={{ marginTop: 12 }}
          >
            {saving ? "Salvando..." : "Criar alerta"}
          </button>
        </div>
      )}

      {monitors.length > 0 ? (
        <div className="monitor-list">
          {monitors.map((m) => {
            const hit = m.lastPrice !== null && m.lastPrice !== undefined && m.lastPrice <= m.targetPrice;
            return (
              <div key={m.id} className={`monitor-card ${hit ? "hit" : ""}`}>
                <div className="monitor-route">{m.origin} → {m.destination}</div>
                <div className="monitor-meta">
                  {m.departureDate}{m.returnDate ? ` · volta ${m.returnDate}` : ""} · {cabineLabel[m.cabin] ?? m.cabin}
                </div>
                <div className="monitor-prices">
                  <span className="monitor-target">meta R$ {m.targetPrice.toLocaleString("pt-BR")}</span>
                  {m.lastPrice != null && (
                    <span className={`monitor-current ${hit ? "hit" : ""}`}>
                      {hit ? "✅ " : ""}atual R$ {m.lastPrice.toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
                {m.lastChecked && <div className="monitor-checked">verificado em {m.lastChecked} · {m.email}</div>}
                <button className="link monitor-remove" onClick={() => remove(m.id)}>Remover</button>
              </div>
            );
          })}
        </div>
      ) : !open && (
        <p className="muted" style={{ margin: "8px 0 0" }}>Nenhum alerta criado. Crie um para receber email quando o preço cair.</p>
      )}
    </div>
  );
}
