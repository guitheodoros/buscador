// ---------------------------------------------------------------------------
// Cache em memoria (TTL + LRU) e rate-limit para o proxy.
// Objetivo: nao repetir chamadas identicas a Amadeus e nao estourar a cota do
// tier gratuito. Tudo em processo, sem dependencias.
// ---------------------------------------------------------------------------

// --- Config (via env) ------------------------------------------------------
const num = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);

export const CONFIG = {
  cacheMax: num(process.env.CACHE_MAX, 500), // entradas maximas no cache
  offersTtlMs: num(process.env.OFFERS_TTL_MS, 5 * 60_000), // 5 min
  datesTtlMs: num(process.env.DATES_TTL_MS, 30 * 60_000), // 30 min (datas mudam devagar)
  awardTtlMs: num(process.env.AWARD_TTL_MS, 30 * 60_000), // 30 min (award seats.aero)
  duffelTtlMs: num(process.env.DUFFEL_TTL_MS, 5 * 60_000), // 5 min (ofertas Duffel)
  ipMax: num(process.env.RATE_IP_MAX, 60), // req/janela por IP
  ipWindowMs: num(process.env.RATE_WINDOW_MS, 60_000), // janela do limite por IP
  amadeusPerMin: num(process.env.AMADEUS_MAX_PER_MIN, 40), // teto de chamadas Amadeus/min
  seatsPerMin: num(process.env.SEATS_MAX_PER_MIN, 10), // teto de chamadas seats.aero/min
  duffelPerMin: num(process.env.DUFFEL_MAX_PER_MIN, 20), // teto de chamadas Duffel/min
};

// --- Cache LRU com TTL -----------------------------------------------------
// Map preserva ordem de insercao; usamos isso para LRU (reinsere no acesso).
const cache = new Map();

/** Chave estavel a partir de um prefixo + objeto de parametros. */
export function cacheKey(prefix, params) {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `${prefix}?${sorted}`;
}

export function cacheGet(key) {
  const e = cache.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  // marca como usado recentemente
  cache.delete(key);
  cache.set(key, e);
  return e.value;
}

export function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (cache.size > CONFIG.cacheMax) {
    const oldest = cache.keys().next().value; // menos recentemente usado
    cache.delete(oldest);
  }
}

export function cacheStats() {
  return { size: cache.size, max: CONFIG.cacheMax };
}

// --- Rate-limit por IP (janela fixa) --------------------------------------
const ipHits = new Map(); // ip -> { count, resetAt }

export function ipRateCheck(ip) {
  const now = Date.now();
  let e = ipHits.get(ip);
  if (!e || now > e.resetAt) {
    e = { count: 0, resetAt: now + CONFIG.ipWindowMs };
    ipHits.set(ip, e);
  }
  e.count++;
  return {
    ok: e.count <= CONFIG.ipMax,
    retryAfter: Math.max(1, Math.ceil((e.resetAt - now) / 1000)),
    remaining: Math.max(0, CONFIG.ipMax - e.count),
  };
}

// --- Teto de chamadas por upstream (protege a cota) ------------------------
/** Cria um orcamento de chamadas por minuto (janela fixa). */
export function makeBudget(maxPerMin) {
  let win = { count: 0, resetAt: Date.now() + 60_000 };
  return {
    /** Consome 1. Retorna false quando estourou o teto do minuto. */
    take() {
      const now = Date.now();
      if (now > win.resetAt) win = { count: 0, resetAt: now + 60_000 };
      if (win.count >= maxPerMin) return false;
      win.count++;
      return true;
    },
    stats() {
      const now = Date.now();
      if (now > win.resetAt) return { used: 0, max: maxPerMin, resetInMs: 0 };
      return { used: win.count, max: maxPerMin, resetInMs: win.resetAt - now };
    },
  };
}

export const amadeusBudget = makeBudget(CONFIG.amadeusPerMin);
export const seatsBudget = makeBudget(CONFIG.seatsPerMin);
export const duffelBudget = makeBudget(CONFIG.duffelPerMin);

// Limpeza periodica dos mapas de IP para nao vazar memoria.
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of ipHits) if (now > e.resetAt) ipHits.delete(ip);
}, 5 * 60_000).unref?.();
