import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AdditiveBlending, type Points } from "three";

import { seededRandom } from "../brushes";
import { PaintedTexture, type Painting } from "../painted-texture";
import { LATE_AFTERNOON } from "./late-afternoon";

export interface DustMotesProps {
  readonly drifting: boolean;
}

const MOTE: Painting = {
  width: 64,
  height: 64,
  tiles: false,
  paint: (context) => {
    const { width } = context.canvas;
    const center = width / 2;
    const gradient = context.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      center,
    );

    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.6)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, width);
  },
};

function motePositions(): Float32Array {
  const { count, min, max } = LATE_AFTERNOON.dust;
  const random = seededRandom(5);

  return Float32Array.from({ length: count * 3 }, (_, i) => {
    const axis = i % 3;
    const low = min[axis] ?? 0;
    const high = max[axis] ?? 0;

    return low + random() * (high - low);
  });
}

const POSITIONS = motePositions();

export function DustMotes({ drifting }: DustMotesProps) {
  const points = useRef<Points>(null);
  const { color, opacity, size } = LATE_AFTERNOON.dust;

  useFrame(({ clock }) => {
    if (!drifting || !points.current) {
      return;
    }

    const seconds = clock.elapsedTime;

    points.current.rotation.y = seconds * 0.012;
    points.current.position.y = Math.sin(seconds * 0.2) * 0.15;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[POSITIONS, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={AdditiveBlending}
      >
        <PaintedTexture attach="map" painting={MOTE} />
      </pointsMaterial>
    </points>
  );
}
