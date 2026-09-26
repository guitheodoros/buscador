import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "monitors.json");

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; }
}

function save(monitors) {
  fs.writeFileSync(FILE, JSON.stringify(monitors, null, 2));
}

export function listMonitors() { return load(); }

export function createMonitor(data) {
  const monitors = load();
  const monitor = {
    id: crypto.randomUUID(),
    origin: data.origin,
    destination: data.destination,
    departureDate: data.departureDate,
    returnDate: data.returnDate ?? null,
    cabin: data.cabin ?? "ECONOMY",
    adults: data.adults ?? 1,
    targetPrice: Number(data.targetPrice),
    email: data.email,
    createdAt: new Date().toISOString().split("T")[0],
    lastChecked: null,
    lastPrice: null,
    priceHistory: [],
    active: true,
  };
  monitors.push(monitor);
  save(monitors);
  return monitor;
}

export function deleteMonitor(id) {
  save(load().filter((m) => m.id !== id));
}

export function updateMonitor(id, updates) {
  const monitors = load();
  const idx = monitors.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  monitors[idx] = { ...monitors[idx], ...updates };
  save(monitors);
  return monitors[idx];
}
