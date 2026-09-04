import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { arcPoints } from "../lib/geo";

interface ArcProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  color: string;
  /** Destaca o arco (rota mais barata). */
  highlighted?: boolean;
}

/** Arco animado entre dois aeroportos com um "pulso" viajando na rota. */
export function Arc({ start, end, radius, color, highlighted }: ArcProps) {
  const points = useMemo(() => arcPoints(start, end, radius), [start, end, radius]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const pulseRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const t = (clock.getElapsedTime() * 0.35) % 1;
    const idx = Math.floor(t * (points.length - 1));
    pulseRef.current.position.copy(points[idx]);
  });

  return (
    <group>
      <primitive
        object={
          new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({
              color,
              transparent: true,
              opacity: highlighted ? 0.95 : 0.4,
            })
          )
        }
      />
      <mesh ref={pulseRef}>
        <sphereGeometry args={[highlighted ? 0.028 : 0.018, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
