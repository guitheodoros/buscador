import type { DateMatrix as Matrix } from "../lib/flexMatrix";
import { heatColor, fmtShort } from "../lib/heat";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

function fmtDay(iso: string): { dm: string; wd: string; weekend: boolean } {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay();
  return {
    dm: `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    wd: WEEKDAYS[dow],
    weekend: dow === 0 || dow === 5 || dow === 6,
  };
}

interface DateMatrixProps {
  matrix: Matrix;
  selectedDep?: string;
  selectedRet?: string;
  onPick: (dep: string, ret?: string) => void;
  onClose: () => void;
}

export function DateMatrix({ matrix, selectedDep, selectedRet, onPick, onClose }: DateMatrixProps) {
  const { depDates, retDates, cells, min, max, currency, oneWay, source } = matrix;
  const real = source === "amadeus";

  return (
    <div className="matrix-panel">
      <div className="matrix-head">
        <h2>
          Datas flexíveis · mapa de calor
          <span className={`src-badge ${real ? "real" : "est"}`}>
            {real ? "Amadeus (real)" : "estimado"}
          </span>
        </h2>
        <div className="matrix-legend">
          <span className="muted">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(min)}
          </span>
          <span className="heat-bar" />
          <span className="muted">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(max)}
          </span>
          <button className="link" onClick={onClose}>
            fechar
          </button>
        </div>
      </div>

      <div className="matrix-scroll">
        <table className="matrix">
          <thead>
            <tr>
              <th className="corner">{oneWay ? "ida" : "ida ↓ / volta →"}</th>
              {oneWay ? (
                <th className="colhead">só ida</th>
              ) : (
                retDates.map((r) => {
                  const f = fmtDay(r);
                  return (
                    <th key={r} className={`colhead ${f.weekend ? "we" : ""}`}>
                      <div>{f.dm}</div>
                      <div className="wd">{f.wd}</div>
                    </th>
                  );
                })
              )}
            </tr>
          </thead>
          <tbody>
            {depDates.map((dep, i) => {
              const fd = fmtDay(dep);
              return (
                <tr key={dep}>
                  <th className={`rowhead ${fd.weekend ? "we" : ""}`}>
                    <div>{fd.dm}</div>
                    <div className="wd">{fd.wd}</div>
                  </th>
                  {cells[i].map((cell, j) => {
                    if (cell.price === null) {
                      return (
                        <td
                          key={j}
                          className="cell invalid"
                          title={real ? "sem preço para este par" : "volta antes da ida"}
                        >
                          –
                        </td>
                      );
                    }
                    const isMin = cell.price === min;
                    const isSel =
                      cell.depDate === selectedDep &&
                      (oneWay || cell.retDate === selectedRet);
                    return (
                      <td
                        key={j}
                        className={`cell ${isMin ? "cheapest" : ""} ${isSel ? "selected" : ""}`}
                        style={{ background: heatColor(cell.price, min, max) }}
                        title={`${new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cell.price)}`}
                        onClick={() => onPick(cell.depDate, cell.retDate)}
                      >
                        {fmtShort(cell.price)}
                        {isMin && <span className="star">★</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted matrix-hint">
        {real
          ? "Preços reais (Amadeus flight-dates), na moeda do mercado. Células vazias = sem preço em cache. "
          : "Preço estimado da melhor tarifa em dinheiro por par de datas. "}
        Clique numa célula para buscar aquele par. ★ = mais barato da grade.
      </p>
    </div>
  );
}
