import { Canvas } from "@react-three/fiber";
import { type ReactNode, useState } from "react";
import { Euler, Matrix4, NeutralToneMapping, Vector3 } from "three";

import { OrbitRig } from "../orbit-rig";
import { Building } from "./building/building";
import { Daylight } from "./light/daylight";
import { DustMotes } from "./light/dust-motes";
import { LATE_AFTERNOON } from "./light/late-afternoon";
import { GYM, RING_VIEW } from "./measurements";
import { HeavyBags } from "./props/heavy-bags";
import { ceilingMount, PLAN, wallMount } from "./props/plan";
import { WallClock } from "./props/wall-clock";
import { Ring } from "./ring";

const HEAVY_BAGS = ceilingMount(PLAN.heavyBags);
const WALL_CLOCK = wallMount(PLAN.wallClock);

export interface GymProps {
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

/**
 * - children 은 레킹볼입니다. 레킹볼이 멈춰 있을 때의 중심(GYM.wreckingBall.restCenter)을 원점으로 두고 그리며, 그 공은 레킹볼을 비추는 빛이 밝힙니다.
 * - children 의 메시는 receiveShadow 를 켭니다. 그래야 창 사이 벽 그림자에 들어 따뜻한 햇빛에 색이 바래지 않습니다.
 * - 포인터 이벤트 핸들러를 달지 않습니다. 칠 수 있는 것은 children 이 정합니다. 타격으로 카메라가 돌지 않게 하려면 pointerdown 에서 nativeEvent.stopPropagation() 을 부릅니다.
 */
export function Gym({ reducedMotion, children }: GymProps) {
  const [orbitSurface, setOrbitSurface] = useState<HTMLDivElement | null>(null);

  return (
    <div ref={setOrbitSurface} className="h-full w-full">
      <Canvas
        dpr={[1, 2]}
        shadows="percentage"
        gl={RENDERER}
        scene={SCENE}
        camera={CAMERA}
      >
        <Daylight />
        <Building />
        <Ring />
        <group position={HEAVY_BAGS.position}>
          <HeavyBags toCeiling={HEAVY_BAGS.toCeiling} />
        </group>
        <group position={WALL_CLOCK.position} rotation-y={WALL_CLOCK.turn}>
          <WallClock />
        </group>
        <DustMotes drifting={!reducedMotion} />
        {orbitSurface ? (
          <OrbitRig
            surface={orbitSurface}
            inertia={!reducedMotion}
            limits={RING_VIEW}
          />
        ) : null}
        <group position={GYM.wreckingBall.restCenter}>{children}</group>
      </Canvas>
    </div>
  );
}
