// Gera src/lib/airports.data.json a partir da base OurAirports.
// Uso:
//   curl -sL https://davidmegginson.github.io/ourairports-data/airports.csv -o airports.csv
//   node scripts/gen-airports.mjs airports.csv
//
// Filtro: aeroportos large/medium, com codigo IATA e servico regular.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2] || "airports.csv";
const raw = fs.readFileSync(csvPath, "utf8");

function parseLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

const lines = raw.split(/\r?\n/);
const header = parseLine(lines[0]);
const idx = (n) => header.indexOf(n);
const iType = idx("type"), iName = idx("name"), iLat = idx("latitude_deg"),
  iLon = idx("longitude_deg"), iCountry = idx("iso_country"), iCity = idx("municipality"),
  iSched = idx("scheduled_service"), iIata = idx("iata_code");

const keepTypes = new Set(["large_airport", "medium_airport"]);
const out = [];
const seen = new Set();
for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue;
  const f = parseLine(lines[i]);
  const iata = (f[iIata] || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata)) continue;
  if (!keepTypes.has(f[iType])) continue;
  if (f[iSched] !== "yes") continue;
  if (seen.has(iata)) continue;
  const lat = parseFloat(f[iLat]), lon = parseFloat(f[iLon]);
  if (!isFinite(lat) || !isFinite(lon)) continue;
  seen.add(iata);
  out.push({
    iata,
    name: (f[iName] || "").replace(/ Airport$/i, "").replace(/ International$/i, " Intl").trim(),
    city: (f[iCity] || "").trim() || iata,
    country: (f[iCountry] || "").trim(),
    lat: Math.round(lat * 1e4) / 1e4,
    lon: Math.round(lon * 1e4) / 1e4,
  });
}
out.sort((a, b) => a.iata.localeCompare(b.iata));
const dest = path.join(__dirname, "..", "src", "lib", "airports.data.json");
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`${out.length} aeroportos -> ${dest}`);
