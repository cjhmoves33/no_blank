import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";
import { Euler, Matrix4, NeutralToneMapping, Vector3 } from "three";

import { Building } from "./building/building";
import { Daylight } from "./light/daylight";
import { DustMotes } from "./light/dust-motes";
import { LATE_AFTERNOON } from "./light/late-afternoon";
import { RING_VIEW } from "./measurements";

export interface GymCanvasProps {
  readonly reducedMotion: boolean;
  readonly children: ReactNode;
}

// R3F 기본값 ACES 는 노출에 1/0.6 을 곱하고 밝은 색의 채도를 뺍니다. Neutral 은 밝지 않은 색을 그대로 내서 레킹볼의 가죽이 제 색으로 보입니다.
const RENDERER = {
  toneMapping: NeutralToneMapping,
  toneMappingExposure: LATE_AFTERNOON.exposure,
};

const SCENE = { environmentIntensity: LATE_AFTERNOON.environmentIntensity };

const DEPTH_RANGE = 10_000;

const CAMERA = {
  fov: RING_VIEW.fov,
  position: RING_VIEW.home,
  // R3F 는 rotation 이 없으면 카메라가 원점(바닥)을 보게 하므로, 첫 프레임부터 target 을 보게 합니다.
  rotation: facing(RING_VIEW.home, RING_VIEW.target),
  near: RING_VIEW.near,
  far: RING_VIEW.near * DEPTH_RANGE,
};

function facing(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
): [x: number, y: number, z: number] {
  const view = new Matrix4().lookAt(
    new Vector3(...from),
    new Vector3(...to),
    new Vector3(0, 1, 0),
  );
  const rotation = new Euler().setFromRotationMatrix(view);

  return [rotation.x, rotation.y, rotation.z];
}

/** 체육관의 건물과 빛 속에 children 을 그립니다. 카메라는 링 시점의 처음 자리에서 시작합니다. */
export function GymCanvas({ reducedMotion, children }: GymCanvasProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows="percentage"
      gl={RENDERER}
      scene={SCENE}
      camera={CAMERA}
    >
      <Daylight />
      <Building />
      {children}
      <DustMotes drifting={!reducedMotion} />
    </Canvas>
  );
}
