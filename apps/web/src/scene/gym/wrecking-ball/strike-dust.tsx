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
  /** at 에서 먼지를 피워 올립니다. at 은 이 컴포넌트의 좌표, outward 는 맞은 자리의 바깥 법선입니다. */
  readonly burst: (at: Vector3, outward: Vector3, strength: number) => void;
}

export interface StrikeDustProps {
  readonly ref: Ref<StrikeDustHandle>;
}

// 빠르게 연달아 쳐도 이만큼만 그립니다. 넘치면 가장 오래된 먼지부터 지웁니다.
const CAPACITY = GRAINS_AT_FULL_STRENGTH * 4;
const { color, opacity, size } = LATE_AFTERNOON.dust;
const TINT = new Color(color);

/** 타격 먼지입니다. 더하는 빛으로 그리므로 흐려진 알은 검게 칠해 보이지 않게 합니다. */
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
