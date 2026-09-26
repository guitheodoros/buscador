import cron from "node-cron";
import { listMonitors, updateMonitor } from "./monitors.js";
import { sendPriceAlert } from "./mailer.js";

async function checkMonitor(monitor, port) {
  try {
    const params = {
      originLocationCode: monitor.origin,
      destinationLocationCode: monitor.destination,
      departureDate: monitor.departureDate,
      adults: String(monitor.adults ?? 1),
      travelClass: monitor.cabin ?? "ECONOMY",
      currencyCode: "BRL",
      max: "5",
    };
    if (monitor.returnDate) params.returnDate = monitor.returnDate;

    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`http://localhost:${port}/api/flight-offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: monitor.origin,
        destination: monitor.destination,
        departureDate: monitor.departureDate,
        returnDate: monitor.returnDate,
        adults: monitor.adults ?? 1,
        cabin: monitor.cabin ?? "ECONOMY",
        currency: "BRL",
        max: 5,
      }),
    });

    if (!res.ok) return;
    const data = await res.json();
    const offers = data.offers ?? [];
    if (offers.length === 0) return;

    const prices = offers
      .map((o) => Number.parseFloat(o.price?.grandTotal ?? o.price?.total ?? o.price ?? "0"))
      .filter((p) => p > 0);
    if (prices.length === 0) return;

    const cheapest = Math.min(...prices);
    const today = new Date().toISOString().split("T")[0];
    const prevPrice = monitor.lastPrice;

    const priceHistory = [...(monitor.priceHistory ?? []), { date: today, price: cheapest }]
      .slice(-60);

    updateMonitor(monitor.id, { lastChecked: today, lastPrice: cheapest, priceHistory });

    const belowTarget = monitor.targetPrice && cheapest <= monitor.targetPrice;
    const bigDrop = prevPrice && cheapest < prevPrice * 0.9;

    if (belowTarget || bigDrop) {
      await sendPriceAlert({ to: monitor.email, monitor, currentPrice: cheapest });
    }

    console.log(`[scheduler] ${monitor.origin}→${monitor.destination} ${today}: R$ ${cheapest}${belowTarget ? " ✅ meta!" : bigDrop ? " ↓ queda" : ""}`);
  } catch (err) {
    console.error(`[scheduler] Erro no monitor ${monitor.id}:`, err.message);
  }
}

export function startScheduler(port) {
  // Roda diariamente às 08:00
  cron.schedule("0 8 * * *", async () => {
    const monitors = listMonitors().filter((m) => m.active);
    if (monitors.length === 0) return;
    console.log(`[scheduler] Verificando ${monitors.length} monitor(es)...`);
    for (const m of monitors) await checkMonitor(m, port);
  });
  console.log("[scheduler] Agendado: verificação diária às 08:00");
}
