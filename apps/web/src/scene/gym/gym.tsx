import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { Euler, Matrix4, NeutralToneMapping, Vector3 } from "three";

import { Building } from "./building/building";
import { Daylight } from "./light/daylight";
import { DustMotes } from "./light/dust-motes";
import { LATE_AFTERNOON } from "./light/late-afternoon";
import { GYM, RING_VIEW } from "./measurements";
import { HeavyBags } from "./props/heavy-bags";
import { ceilingMount, PLAN, wallMount } from "./props/plan";
import { WallClock } from "./props/wall-clock";
import { Ring } from "./ring";
import { RingControls } from "./ring-controls";
import type { Jolt, Strike } from "./wrecking-ball/swing";
import {
  WreckingBall,
  type WreckingBallHandle,
} from "./wrecking-ball/wrecking-ball";

const HEAVY_BAGS = ceilingMount(PLAN.heavyBags);
const WALL_CLOCK = wallMount(PLAN.wallClock);

export interface GymProps {
  readonly reducedMotion: boolean;
  readonly onStrike: (strike: Strike) => void;
  readonly onJolt: (jolt: Jolt) => void;
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

export function Gym({ reducedMotion, onStrike, onJolt }: GymProps) {
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const [ball, setBall] = useState<WreckingBallHandle | null>(null);

  return (
    <div ref={setSurface} className="h-full w-full">
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
        {surface && ball ? (
          <RingControls
            surface={surface}
            ball={ball}
            reducedMotion={reducedMotion}
            limits={RING_VIEW}
            onStrike={onStrike}
          />
        ) : null}
        <group position={GYM.wreckingBall.restCenter}>
          <WreckingBall
            ref={setBall}
            reducedMotion={reducedMotion}
            onJolt={onJolt}
          />
        </group>
      </Canvas>
    </div>
  );
}
