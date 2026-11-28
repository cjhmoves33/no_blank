import { Vector3 } from "three";

import { HANGING_HEIGHT } from "./measurements";
import { RESTING_SPRING, settle, type Spring } from "./spring";
import { STRAIGHT_CHAIN_AXIS, SWING_FEEL } from "./swing";

export interface Lean {
  readonly aboutX: Spring;
  readonly aboutZ: Spring;
}

const LEAN_FEEL = {
  stiffness: 81,
  damping: 3.6,
  kickAtFullStrength: 2 * SWING_FEEL.closingSpeedShare,
  kickPerSidewaysSpeed: 1.5,
} as const;

export const UPRIGHT: Lean = {
  aboutX: RESTING_SPRING,
  aboutZ: RESTING_SPRING,
};

const UP = new Vector3(0, 1, 0);
const HINGE = STRAIGHT_CHAIN_AXIS.clone().multiplyScalar(HANGING_HEIGHT);

export function leanBy(
  lean: Lean,
  {
    hitFromCenter,
    push,
    strength,
  }: {
    readonly hitFromCenter: Vector3;
    readonly push: Vector3;
    readonly strength: number;
  },
): Lean {
  const lever = hitFromCenter.clone().sub(HINGE);
  const turn = lever.clone().cross(push).divideScalar(lever.length());

  return kicked(
    lean,
    turn.multiplyScalar(LEAN_FEEL.kickAtFullStrength * strength),
  );
}

export function leanByJolt(lean: Lean, velocity: Vector3): Lean {
  const sideways = new Vector3(velocity.x, 0, velocity.z);

  return kicked(
    lean,
    sideways.cross(UP).multiplyScalar(LEAN_FEEL.kickPerSidewaysSpeed),
  );
}

export function settleLean(lean: Lean, seconds: number): Lean {
  return {
    aboutX: settle(lean.aboutX, seconds, LEAN_FEEL),
    aboutZ: settle(lean.aboutZ, seconds, LEAN_FEEL),
  };
}

function kicked(lean: Lean, turn: Vector3): Lean {
  return {
    aboutX: { ...lean.aboutX, rate: lean.aboutX.rate + turn.x },
    aboutZ: { ...lean.aboutZ, rate: lean.aboutZ.rate + turn.z },
  };
}
