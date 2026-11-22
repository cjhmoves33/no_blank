import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";

import { type OrbitLimits, OrbitRig } from "./orbit-rig";

export interface SpaceProps {
  readonly reducedMotion: boolean;
  readonly children: ReactNode;
}

const HOME: [x: number, y: number, z: number] = [0, 0, 6];

const CAMERA = { fov: 40, position: HOME };

const LIMITS: OrbitLimits = {
  distance: { min: 3.5, max: 12 },
  polar: { min: 0, max: Math.PI },
};

/**
 * 도형이 놓이는 무대입니다. 캔버스, 카메라가 갈 수 있는 범위, 빛을 여기서 정합니다.
 * - children 은 원점에 놓입니다. 무대는 원점의 children 을 가리지 않습니다.
 * - 포인터 이벤트 핸들러를 달지 않습니다. 누를 수 있는 것은 children 이 정합니다.
 * - LIMITS 가 허락하는 모든 카메라 위치에서 빈 곳 없이 보여야 합니다.
 * - 배경을 정하지 않으면 페이지 배경이 비쳐 보입니다.
 */
export function Space({ reducedMotion, children }: SpaceProps) {
  return (
    <Canvas dpr={[1, 2]} camera={CAMERA}>
      <hemisphereLight args={["#ffffff", "#c7d2fe", 0.8]} />
      <directionalLight position={[3, 4, 5]} intensity={2} />
      <directionalLight
        position={[-4, -2, -3]}
        intensity={0.6}
        color="#a5b4fc"
      />
      <OrbitRig inertia={!reducedMotion} limits={LIMITS} />
      {children}
    </Canvas>
  );
}
