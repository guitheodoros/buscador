import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";
import { Arc } from "./Arc";
import { airportToVector3 } from "../lib/geo";
import { getAirport } from "../lib/airports";
import { getStrategyColor } from "../strategies";
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
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <Html distanceFactor={8} style={{ pointerEvents: "none" }}>
        <div className="marker-label">{airport?.city ?? iata}</div>
      </Html>
    </group>
  );
}

function EarthGlobe() {
  return (
    <group>
      {/* corpo do planeta */}
      <mesh>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <meshStandardMaterial color="#111113" roughness={0.95} metalness={0.15} />
      </mesh>
      {/* grade lat/lon */}
      <mesh>
        <sphereGeometry args={[RADIUS + 0.005, 36, 24]} />
        <meshBasicMaterial color="#3a3a42" wireframe transparent opacity={0.35} />
      </mesh>
      {/* halo atmosferico */}
      <mesh>
        <sphereGeometry args={[RADIUS * 1.06, 48, 48]} />
        <meshBasicMaterial color="#5a5a66" transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

interface GlobeProps {
  results: FareResult[];
  cheapestId?: string;
}

export function Globe({ results, cheapestId }: GlobeProps) {
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

  return (
    <Canvas camera={{ position: [0, 1.5, 5], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={["#050506"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <Stars radius={100} depth={50} count={2500} factor={4} fade speed={1} />
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
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={9}
        autoRotate={results.length === 0}
        autoRotateSpeed={0.4}
      />
    </Canvas>
  );
}
