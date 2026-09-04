import fs from "node:fs";
const round = (c) => c.map(([lon,lat])=>[Math.round(lon*100)/100, Math.round(lat*100)/100]);

// Bordas (linhas) a partir dos paises
const countries = JSON.parse(fs.readFileSync("countries.geojson","utf8"));
const borders = [];
for (const f of countries.features) {
  const g=f.geometry; if(!g) continue;
  const polys = g.type==="Polygon" ? [g.coordinates] : g.type==="MultiPolygon" ? g.coordinates : [];
  for (const poly of polys) for (const ring of poly) { const r=round(ring); if(r.length>=2) borders.push(r); }
}
fs.writeFileSync("../world.borders.json", JSON.stringify(borders));

// Poligonos de terra (com furos) a partir de land, para preencher
const land = JSON.parse(fs.readFileSync("land.geojson","utf8"));
const polygons = [];
for (const f of land.features) {
  const g=f.geometry; if(!g) continue;
  const polys = g.type==="Polygon" ? [g.coordinates] : g.type==="MultiPolygon" ? g.coordinates : [];
  for (const poly of polys) polygons.push(poly.map(round));
}
fs.writeFileSync("../world.land.json", JSON.stringify(polygons));

console.log("borders rings:", borders.length, fs.statSync("../world.borders.json").size, "bytes");
console.log("land polygons:", polygons.length, fs.statSync("../world.land.json").size, "bytes");
