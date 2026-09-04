// ---------------------------------------------------------------------------
// Proxy backend para a Amadeus Self-Service API.
// - Guarda as credenciais no SERVIDOR (nunca vao para o browser).
// - Faz OAuth2 client_credentials e cacheia o token.
// - Cache de respostas (TTL) + rate-limit por IP + teto global de chamadas a
//   Amadeus (protege a cota do tier gratuito). Ver server/cacheLimit.js.
// - Em producao, tambem serve o build estatico de dist/.
// ---------------------------------------------------------------------------

import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CONFIG,
  cacheKey,
  cacheGet,
  cacheSet,
  cacheStats,
  ipRateCheck,
  amadeusBudget,
  seatsBudget,
  duffelBudget,
} from "./cacheLimit.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;
const ENV = process.env.AMADEUS_ENV || "test";
const PORT = process.env.PORT || 3001;
const BASE = ENV === "production" ? "https://api.amadeus.com" : "https://test.api.amadeus.com";
const hasCreds = Boolean(CLIENT_ID && CLIENT_SECRET);

const SEATS_KEY = process.env.SEATS_AERO_API_KEY;
const SEATS_BASE = "https://seats.aero/partnerapi";
const hasSeats = Boolean(SEATS_KEY);

const DUFFEL_TOKEN = process.env.DUFFEL_ACCESS_TOKEN;
const DUFFEL_BASE = "https://api.duffel.com";
const hasDuffel = Boolean(DUFFEL_TOKEN);

const app = express();
app.set("trust proxy", "loopback");
app.use(express.json());

const clientIp = (req) => req.ip || req.socket?.remoteAddress || "unknown";

// --- OAuth token com cache -------------------------------------------------
let tokenCache = null;
async function getToken() {
  if (!hasCreds) return null;
  if (tokenCache && Date.now() < tokenCache.expiresAt - 30_000) return tokenCache.token;
  try {
    const res = await fetch(`${BASE}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 1799) * 1000,
    };
    return tokenCache.token;
  } catch {
    return null;
  }
}

/**
 * Gate compartilhado: cache -> rate-limit por IP -> teto do upstream.
 * Retorna { proceed:true } para seguir, ou envia a resposta e retorna
 * { proceed:false }. Auth (token Amadeus / chave seats) fica com cada rota.
 */
async function pregate(req, res, { emptyKey, key, budget }) {
  const empty = (reason) => ({ [emptyKey]: null, reason });

  const cached = cacheGet(key);
  if (cached !== undefined) {
    res.set("X-Cache", "HIT");
    res.json(cached);
    return { proceed: false };
  }

  const ipr = ipRateCheck(clientIp(req));
  res.set("X-RateLimit-Remaining", String(ipr.remaining));
  if (!ipr.ok) {
    res.set("Retry-After", String(ipr.retryAfter));
    res.status(429).json(empty("rate-limited-ip"));
    return { proceed: false };
  }

  if (!budget.take()) {
    res.set("X-Cache", "MISS-BUDGET");
    res.json(empty("rate-limited"));
    return { proceed: false };
  }

  res.set("X-Cache", "MISS");
  return { proceed: true };
}

// --- Rotas da API ----------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({
    amadeus: hasCreds,
    seats: hasSeats,
    duffel: hasDuffel,
    env: ENV,
    cache: cacheStats(),
    budget: {
      amadeus: amadeusBudget.stats(),
      seats: seatsBudget.stats(),
      duffel: duffelBudget.stats(),
    },
  });
});

app.post("/api/flight-offers", async (req, res) => {
  if (!hasCreds) return res.json({ offers: null, reason: "sem-credenciais" });

  const b = req.body ?? {};
  if (!b.origin || !b.destination || !b.departureDate) {
    return res.status(400).json({ offers: null, reason: "parametros-invalidos" });
  }

  const params = {
    origin: b.origin,
    destination: b.destination,
    departureDate: b.departureDate,
    returnDate: b.returnDate,
    adults: b.adults ?? 1,
    cabin: b.cabin ?? "ECONOMY",
    currency: b.currency ?? "BRL",
    max: b.max ?? 8,
  };
  const key = cacheKey("offers", params);

  const g = await pregate(req, res, { emptyKey: "offers", key, budget: amadeusBudget });
  if (!g.proceed) return;
  const token = await getToken();
  if (!token) return res.json({ offers: null, reason: "sem-token" });

  try {
    const q = new URLSearchParams({
      originLocationCode: String(params.origin),
      destinationLocationCode: String(params.destination),
      departureDate: String(params.departureDate),
      adults: String(params.adults),
      travelClass: String(params.cabin),
      currencyCode: String(params.currency),
      max: String(params.max),
    });
    if (params.returnDate) q.set("returnDate", String(params.returnDate));

    const r = await fetch(`${BASE}/v2/shopping/flight-offers?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return res.json({ offers: null, reason: `amadeus-${r.status}` });
    const data = await r.json();
    const payload = { offers: data.data ?? [] };
    cacheSet(key, payload, CONFIG.offersTtlMs); // cacheia sucessos (inclui vazio)
    res.json(payload);
  } catch (err) {
    res.json({ offers: null, reason: `erro-${String(err?.message ?? err)}` });
  }
});

// Flight Cheapest Date Search — grade de precos por data numa chamada.
// Cobertura limitada (rotas em cache; test env e restrito). Preco volta na
// moeda do mercado (meta.currency), nao necessariamente BRL.
app.get("/api/flight-dates", async (req, res) => {
  if (!hasCreds) return res.json({ dates: null, reason: "sem-credenciais" });

  const { origin, destination, departureDate, oneWay, duration, nonStop } = req.query;
  if (!origin || !destination || !departureDate) {
    return res.status(400).json({ dates: null, reason: "parametros-invalidos" });
  }

  const params = { origin, destination, departureDate, oneWay, duration, nonStop };
  const key = cacheKey("dates", params);

  const g = await pregate(req, res, { emptyKey: "dates", key, budget: amadeusBudget });
  if (!g.proceed) return;
  const token = await getToken();
  if (!token) return res.json({ dates: null, reason: "sem-token" });

  try {
    const q = new URLSearchParams({
      origin: String(origin),
      destination: String(destination),
      departureDate: String(departureDate), // aceita "YYYY-MM-DD" ou range "d1,d2"
    });
    if (oneWay !== undefined) q.set("oneWay", String(oneWay));
    if (duration) q.set("duration", String(duration)); // ex "12,16" (dias)
    if (nonStop !== undefined) q.set("nonStop", String(nonStop));
    q.set("viewBy", "DATE");

    const r = await fetch(`${BASE}/v1/shopping/flight-dates?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return res.json({ dates: null, reason: `amadeus-${r.status}` });
    const data = await r.json();
    const payload = {
      dates: (data.data ?? []).map((d) => ({
        departureDate: d.departureDate,
        returnDate: d.returnDate,
        price: Number.parseFloat(d.price?.total ?? "NaN"),
      })),
      currency: data.meta?.currency ?? null,
    };
    cacheSet(key, payload, CONFIG.datesTtlMs); // cacheia sucessos (inclui vazio)
    res.json(payload);
  } catch (err) {
    res.json({ dates: null, reason: `erro-${String(err?.message ?? err)}` });
  }
});

// seats.aero Partner API — disponibilidade de award (milhas) por trecho.
// Chave secreta fica no servidor. Retorna a melhor opcao por programa (Source).
app.get("/api/award-search", async (req, res) => {
  if (!hasSeats) return res.json({ awards: null, reason: "sem-credenciais" });

  const { origin, destination, cabin, startDate, endDate } = req.query;
  if (!origin || !destination || !startDate) {
    return res.status(400).json({ awards: null, reason: "parametros-invalidos" });
  }

  const cab = String(cabin || "economy"); // economy | premium | business | first
  const end = String(endDate || startDate);
  const params = { origin, destination, cabin: cab, startDate, endDate: end };
  const key = cacheKey("award", params);

  const g = await pregate(req, res, { emptyKey: "awards", key, budget: seatsBudget });
  if (!g.proceed) return;

  try {
    const q = new URLSearchParams({
      origin_airport: String(origin),
      destination_airport: String(destination),
      start_date: String(startDate),
      end_date: end,
      cabin: cab,
      take: "100",
    });
    const r = await fetch(`${SEATS_BASE}/search?${q.toString()}`, {
      headers: { "Partner-Authorization": SEATS_KEY, accept: "application/json" },
    });
    if (!r.ok) return res.json({ awards: null, reason: `seats-${r.status}` });
    const data = await r.json();

    // Prefixo do campo por cabine: economy=Y, premium=W, business=J, first=F.
    const prefix = { economy: "Y", premium: "W", business: "J", first: "F" }[cab] || "Y";
    const awards = (data.data ?? [])
      .map((a) => ({
        program: a.Source ?? "?",
        date: a.Date,
        miles: Number.parseInt(a[`${prefix}MileageCost`] ?? "0", 10),
        available: Boolean(a[`${prefix}Available`]),
        direct: Boolean(a[`${prefix}Direct`]),
        taxes: Number.parseInt(a[`${prefix}TotalTaxes`] ?? "0", 10) / 100, // vem em centavos
        taxesCurrency: a.TaxesCurrency ?? "USD",
        origin: a.Route?.OriginAirport ?? origin,
        destination: a.Route?.DestinationAirport ?? destination,
      }))
      .filter((x) => x.available && x.miles > 0);

    const payload = { awards };
    cacheSet(key, payload, CONFIG.awardTtlMs);
    res.json(payload);
  } catch (err) {
    res.json({ awards: null, reason: `erro-${String(err?.message ?? err)}` });
  }
});

// Duffel — ofertas reais (conteudo de cia + NDC + agencias). Test mode retorna
// ofertas sinteticas para qualquer rota. Chave secreta fica no servidor.
const DUFFEL_CABIN = {
  ECONOMY: "economy",
  PREMIUM_ECONOMY: "premium_economy",
  BUSINESS: "business",
  FIRST: "first",
};

app.post("/api/duffel-offers", async (req, res) => {
  if (!hasDuffel) return res.json({ offers: null, reason: "sem-credenciais" });

  const b = req.body ?? {};
  if (!b.origin || !b.destination || !b.departureDate) {
    return res.status(400).json({ offers: null, reason: "parametros-invalidos" });
  }

  const adults = Math.max(1, Number(b.adults) || 1);
  const cabin = DUFFEL_CABIN[b.cabin] ?? "economy";
  const params = {
    origin: b.origin,
    destination: b.destination,
    departureDate: b.departureDate,
    returnDate: b.returnDate,
    adults,
    cabin,
  };
  const key = cacheKey("duffel", params);

  const g = await pregate(req, res, { emptyKey: "offers", key, budget: duffelBudget });
  if (!g.proceed) return;

  try {
    const slices = [
      { origin: String(b.origin), destination: String(b.destination), departure_date: String(b.departureDate) },
    ];
    if (b.returnDate) {
      slices.push({
        origin: String(b.destination),
        destination: String(b.origin),
        departure_date: String(b.returnDate),
      });
    }
    const passengers = Array.from({ length: adults }, () => ({ type: "adult" }));

    const r = await fetch(`${DUFFEL_BASE}/air/offer_requests?return_offers=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DUFFEL_TOKEN}`,
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ data: { slices, passengers, cabin_class: cabin } }),
    });
    if (!r.ok) return res.json({ offers: null, reason: `duffel-${r.status}` });
    const json = await r.json();

    const offers = (json.data?.offers ?? [])
      .map((o) => ({
        id: o.id,
        price: Math.round(parseFloat(o.total_amount)),
        currency: o.total_currency,
        owner: o.owner?.iata_code ?? "",
        ownerName: o.owner?.name ?? "",
        segments: (o.slices ?? []).flatMap((sl) =>
          (sl.segments ?? []).map((s) => ({
            from: s.origin?.iata_code,
            to: s.destination?.iata_code,
            carrier: s.marketing_carrier?.iata_code ?? s.operating_carrier?.iata_code ?? "",
            flightNumber: s.marketing_carrier_flight_number ?? "",
          }))
        ),
      }))
      .filter((o) => Number.isFinite(o.price) && o.price > 0)
      .sort((a, b2) => a.price - b2.price)
      .slice(0, 8);

    const payload = { offers, currency: offers[0]?.currency ?? null };
    cacheSet(key, payload, CONFIG.duffelTtlMs);
    res.json(payload);
  } catch (err) {
    res.json({ offers: null, reason: `erro-${String(err?.message ?? err)}` });
  }
});

// --- Build estatico (producao) --------------------------------------------
const dist = path.join(__dirname, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(
    `[api] proxy em http://localhost:${PORT}  (Amadeus: ${hasCreds ? "sim" : "nao"}, ` +
      `seats.aero: ${hasSeats ? "sim" : "nao"}, Duffel: ${hasDuffel ? "sim" : "nao"}, env: ${ENV})`
  );
  console.log(
    `[api] cache TTL offers=${CONFIG.offersTtlMs / 1000}s dates=${CONFIG.datesTtlMs / 1000}s ` +
      `award=${CONFIG.awardTtlMs / 1000}s duffel=${CONFIG.duffelTtlMs / 1000}s · ` +
      `rate IP=${CONFIG.ipMax}/${CONFIG.ipWindowMs / 1000}s · Amadeus<=${CONFIG.amadeusPerMin}/min · ` +
      `seats<=${CONFIG.seatsPerMin}/min · Duffel<=${CONFIG.duffelPerMin}/min`
  );
});
