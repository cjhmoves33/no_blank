import { useState } from "react";

import { GymCanvas } from "./gym-canvas";
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
  type WreckingBallProps,
} from "./wrecking-ball/wrecking-ball";

const HEAVY_BAGS = ceilingMount(PLAN.heavyBags);
const WALL_CLOCK = wallMount(PLAN.wallClock);

export interface GymProps {
  readonly reducedMotion: boolean;
  readonly onStrike: (strike: Strike) => void;
  readonly onJolt: (jolt: Jolt) => void;
}

const FILL = { width: "100%", height: "100%" };

export function Gym({ reducedMotion, onStrike, onJolt }: GymProps) {
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const [ball, setBall] = useState<WreckingBallHandle | null>(null);

  return (
    <div ref={setSurface} style={FILL}>
      <GymCanvas reducedMotion={reducedMotion}>
        <Ring />
        <HeavyBagsInPlace />
        <WallClockInPlace />
        {surface && ball ? (
          <RingControls
            surface={surface}
            ball={ball}
            reducedMotion={reducedMotion}
            limits={RING_VIEW}
            onStrike={onStrike}
          />
        ) : null}
        <WreckingBallInPlace
          ref={setBall}
          reducedMotion={reducedMotion}
          onJolt={onJolt}
        />
      </GymCanvas>
    </div>
  );
}

export function HeavyBagsInPlace() {
  return (
    <group position={HEAVY_BAGS.position}>
      <HeavyBags toCeiling={HEAVY_BAGS.toCeiling} />
    </group>
  );
}

export function WallClockInPlace() {
  return (
    <group position={WALL_CLOCK.position} rotation-y={WALL_CLOCK.turn}>
      <WallClock />
    </group>
  );
}

export function WreckingBallInPlace(props: WreckingBallProps) {
  return (
    <group position={GYM.wreckingBall.restCenter}>
      <WreckingBall {...props} />
    </group>
  );
}
