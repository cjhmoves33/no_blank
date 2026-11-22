import { useFrame } from "@react-three/fiber";
import { type Ref, useImperativeHandle, useRef, useState } from "react";
import { AdditiveBlending, Color, type Points, type Vector3 } from "three";

import { seededRandom } from "../brushes";
import { MOTE } from "../light/dust-motes";
import { LATE_AFTERNOON } from "../light/late-afternoon";
import { PaintedTexture } from "../painted-texture";
import {
  burst,
  drift,
  glow,
  type Grain,
  GRAINS_AT_FULL_STRENGTH,
} from "./dust";

export interface StrikeDustHandle {
  readonly burst: (at: Vector3, outward: Vector3, strength: number) => void;
}

export interface StrikeDustProps {
  readonly ref: Ref<StrikeDustHandle>;
}

const CAPACITY = GRAINS_AT_FULL_STRENGTH * 4;
const { color, opacity, size } = LATE_AFTERNOON.dust;
const TINT = new Color(color);

export function StrikeDust({ ref }: StrikeDustProps) {
  const points = useRef<Points>(null);
  const grains = useRef<Grain[]>([]);
  const [random] = useState(() => seededRandom(41));
  const [buffers] = useState(() => ({
    positions: new Float32Array(CAPACITY * 3),
    colors: new Float32Array(CAPACITY * 3),
  }));

  useImperativeHandle(
    ref,
    () => ({
      burst: (at, outward, strength) => {
        grains.current = [
          ...grains.current,
          ...burst(at, outward, { strength, random }),
        ].slice(-CAPACITY);
      },
    }),
    [random],
  );

  useFrame((_state, delta) => {
    const geometry = points.current?.geometry;

    grains.current = drift(grains.current, delta);

    if (!geometry) {
      return;
    }

    const positions = geometry.getAttribute("position");
    const colors = geometry.getAttribute("color");

    grains.current.forEach((grain, i) => {
      const brightness = glow(grain);

      positions.setXYZ(i, grain.position.x, grain.position.y, grain.position.z);
      colors.setXYZ(
        i,
        TINT.r * brightness,
        TINT.g * brightness,
        TINT.b * brightness,
      );
    });
    geometry.setDrawRange(0, grains.current.length);
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[buffers.positions, 3]}
        />
        <bufferAttribute attach="attributes-color" args={[buffers.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        vertexColors
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
