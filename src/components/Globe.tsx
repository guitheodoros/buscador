import { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { Arc } from "./Arc";
import { airportToVector3, latLonToVector3 } from "../lib/geo";
import { getAirport } from "../lib/airports";
import { getStrategyColor } from "../strategies";
import worldBorders from "../lib/world.borders.json";
import type { FareResult } from "../types";

const RADIUS = 2;

function Marker({ iata }: { iata: string }) {
  const pos = airportToVector3(iata, RADIUS);
  const airport = getAirport(iata);
  if (!pos) return null;
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshBasicMaterial color="#ff6b35" />
      </mesh>
      <Html distanceFactor={8} style={{ pointerEvents: "none" }}>
        <div className="marker-label">{airport?.city ?? iata}</div>
      </Html>
    </group>
  );
}

/** Preenchimento dos paises, triangulando cada anel de fronteira como poligono. */
function CountryFill() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    let offset = 0;
    for (const ring of worldBorders as [number, number][][]) {
      if (ring.length < 3) continue;
      const outer = ring.map(([lon, lat]) => new THREE.Vector2(lon, lat));
      let faces: number[][] = [];
      try { faces = THREE.ShapeUtils.triangulateShape(outer, []); } catch { continue; }
      for (const v of outer) {
        const p = latLonToVector3(v.y, v.x, RADIUS + 0.006);
        positions.push(p.x, p.y, p.z);
        const n = p.clone().normalize();
        normals.push(n.x, n.y, n.z);
      }
      for (const f of faces) indices.push(offset + f[0], offset + f[1], offset + f[2]);
      offset += outer.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    return geo;
  }, []);
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshStandardMaterial
        color="#4a7a3a"
        roughness={0.85}
        metalness={0}
        side={THREE.DoubleSide}
        depthWrite={true}
      />
    </mesh>
  );
}

/** Fronteiras dos paises (linhas) sobre a esfera. */
function Borders() {
  const lineObjs = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: "#5a7a9e", transparent: true, opacity: 0.45 });
    return (worldBorders as [number, number][][]).map((ring) => {
      const pts = ring.map(([lon, lat]) => latLonToVector3(lat, lon, RADIUS + 0.014));
      return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    });
  }, []);
  return (
    <group>
      {lineObjs.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </group>
  );
}

function EarthGlobe() {
  return (
    <group>
      {/* oclusor: escreve profundidade mas nao cor, escondendo elementos atras do globo */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[RADIUS * 0.99, 48, 48]} />
        <meshBasicMaterial colorWrite={false} />
      </mesh>
      {/* textura de fundo: esfera com gradiente atmosferico sutil */}
      <mesh renderOrder={0}>
        <sphereGeometry args={[RADIUS * 0.97, 64, 64]} />
        <meshStandardMaterial color="#8aaac8" roughness={1} metalness={0} transparent opacity={0.35} depthTest={false} />
      </mesh>
      <mesh renderOrder={0}>
        <sphereGeometry args={[RADIUS * 1.06, 48, 48]} />
        <meshBasicMaterial color="#c8d0e0" transparent opacity={0.07} side={THREE.BackSide} />
      </mesh>
      {/* apenas as fronteiras dos paises */}
      <Borders />
    </group>
  );
}

/** Anima zoom-in (escala 0.3 → 1) sempre que zoomKey muda. */
function ZoomAnimator({ scaleRef, zoomKey }: { scaleRef: React.RefObject<THREE.Group>; zoomKey: number }) {
  const state = useRef({ t: 0, playing: false });

  useEffect(() => {
    state.current.t = 0;
    state.current.playing = true;
  }, [zoomKey]);

  useFrame((_, delta) => {
    if (!scaleRef.current || !state.current.playing) return;
    state.current.t = Math.min(state.current.t + delta / 1.1, 1);
    // ease out cubic
    const e = 1 - Math.pow(1 - state.current.t, 3);
    const s = 0.3 + 0.7 * e;
    scaleRef.current.scale.setScalar(s);
    if (state.current.t >= 1) state.current.playing = false;
  });

  return null;
}

/** Rotaciona o grupo do globo suavemente seguindo o mouse. */
function MouseRotator({ groupRef }: { groupRef: React.RefObject<THREE.Group> }) {
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const targetY = mouse.current.x * Math.PI * 0.35;
    const targetX = -mouse.current.y * Math.PI * 0.15;
    g.rotation.y += (targetY - g.rotation.y) * 0.04;
    g.rotation.x += (targetX - g.rotation.x) * 0.04;
  });

  return null;
}

interface GlobeProps {
  results: FareResult[];
  cheapestId?: string;
  zoomKey?: number;
}

export function Globe({ results, cheapestId, zoomKey = 0 }: GlobeProps) {
  // Coleta aeroportos e arcos a desenhar.
  const { markers, arcs } = useMemo(() => {
    const markerSet = new Set<string>();
    const arcList: {
      key: string;
      a: THREE.Vector3;
      b: THREE.Vector3;
      color: string;
      highlighted: boolean;
    }[] = [];

    for (const r of results) {
      const highlighted = r.id === cheapestId;
      for (const seg of r.segments) {
        markerSet.add(seg.from);
        markerSet.add(seg.to);
        const a = airportToVector3(seg.from, RADIUS);
        const b = airportToVector3(seg.to, RADIUS);
        if (a && b) {
          arcList.push({
            key: `${r.id}-${seg.from}-${seg.to}`,
            a,
            b,
            color: getStrategyColor(r.strategy),
            highlighted,
          });
        }
      }
    }
    return { markers: Array.from(markerSet), arcs: arcList };
  }, [results, cheapestId]);

  const scaleRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);

  return (
    <Canvas camera={{ position: [0, 0, 9], fov: 45 }} dpr={[1, 2]} gl={{ alpha: true }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 3, 5]} intensity={1.8} color="#fff8f0" />
      <directionalLight position={[-4, -2, -3]} intensity={0.15} color="#c0d8ff" />
      <group ref={scaleRef}>
        <group ref={groupRef}>
          <EarthGlobe />
          {markers.map((m) => (
            <Marker key={m} iata={m} />
          ))}
          {arcs.map((arc) => (
            <Arc
              key={arc.key}
              start={arc.a}
              end={arc.b}
              radius={RADIUS}
              color={arc.color}
              highlighted={arc.highlighted}
            />
          ))}
        </group>
      </group>
      <MouseRotator groupRef={groupRef} />
      <ZoomAnimator scaleRef={scaleRef} zoomKey={zoomKey} />
    </Canvas>
  );
}
