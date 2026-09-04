import * as THREE from "three";
import { getAirport } from "./airports";

/** Converte lat/lon (graus) para um vetor 3D na esfera de raio R. */
export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function airportToVector3(iata: string, radius: number): THREE.Vector3 | null {
  const a = getAirport(iata);
  if (!a) return null;
  return latLonToVector3(a.lat, a.lon, radius);
}

/**
 * Gera pontos de um arco elevado entre duas posicoes na esfera.
 * A altura do arco cresce com a distancia entre os pontos.
 */
export function arcPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  segments = 48
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const angle = start.angleTo(end);
  const lift = 1 + Math.min(angle * 0.6, 0.9); // altura relativa do arco
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3().copy(start).lerp(end, t);
    // eleva o meio do arco acima da superficie
    const h = Math.sin(Math.PI * t) * (radius * (lift - 1));
    p.normalize().multiplyScalar(radius + h);
    pts.push(p);
  }
  return pts;
}
