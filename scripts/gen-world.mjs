import fs from "node:fs";
const gj = JSON.parse(fs.readFileSync("land.geojson", "utf8"));
const rings = [];
function addPolygon(poly) {
  for (const ring of poly) {
    const r = ring.map(([lon, lat]) => [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100]);
    if (r.length >= 2) rings.push(r);
  }
}
for (const f of gj.features) {
  const g = f.geometry;
  if (!g) continue;
  if (g.type === "Polygon") addPolygon(g.coordinates);
  else if (g.type === "MultiPolygon") for (const p of g.coordinates) addPolygon(p);
}
fs.writeFileSync("../world.rings.json", JSON.stringify(rings));
const pts = rings.reduce((s, r) => s + r.length, 0);
console.log("rings:", rings.length, "points:", pts, "bytes:", fs.statSync("../world.rings.json").size);
