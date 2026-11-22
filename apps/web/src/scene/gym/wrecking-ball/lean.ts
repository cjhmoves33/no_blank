import { Quaternion, Vector3 } from "three";

import { HANGING_HEIGHT } from "./leather";
import {
  criticallyDamped,
  RESTING_SPRING,
  settle,
  type Spring,
  type SpringFeel,
} from "./spring";
import { STRAIGHT_CHAIN_AXIS, type SWING_FEEL } from "./swing";

export interface Lean {
  readonly aboutX: Spring;
  readonly aboutZ: Spring;
}

export interface LeanFeel extends SpringFeel {
  readonly kickAtFullStrength: number;
  readonly kickPerSidewaysSpeed: number;
}

export const LEAN_FEEL = {
  normal: {
    stiffness: 81,
    damping: 3.6,
    kickAtFullStrength: 2,
    kickPerSidewaysSpeed: 1.5,
  },
  reduced: {
    ...criticallyDamped(81),
    kickAtFullStrength: 0,
    kickPerSidewaysSpeed: 0,
  },
} as const satisfies Record<keyof typeof SWING_FEEL, LeanFeel>;

export const UPRIGHT: Lean = {
  aboutX: RESTING_SPRING,
  aboutZ: RESTING_SPRING,
};

const UP = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);
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
  feel: LeanFeel,
): Lean {
  const lever = hitFromCenter.clone().sub(HINGE);
  const turn = lever.clone().cross(push).divideScalar(lever.length());

  return kicked(lean, turn.multiplyScalar(feel.kickAtFullStrength * strength));
}

export function leanByJolt(
  lean: Lean,
  velocity: Vector3,
  feel: LeanFeel,
): Lean {
  const sideways = new Vector3(velocity.x, 0, velocity.z);

  return kicked(
    lean,
    sideways.cross(UP).multiplyScalar(feel.kickPerSidewaysSpeed),
  );
}

export function settleLean(lean: Lean, seconds: number, feel: LeanFeel): Lean {
  return {
    aboutX: settle(lean.aboutX, seconds, feel),
    aboutZ: settle(lean.aboutZ, seconds, feel),
  };
}

export function leanTurn(lean: Lean): Quaternion {
  return new Quaternion()
    .setFromAxisAngle(X, lean.aboutX.angle)
    .multiply(new Quaternion().setFromAxisAngle(Z, lean.aboutZ.angle));
}

function kicked(lean: Lean, turn: Vector3): Lean {
  return {
    aboutX: { ...lean.aboutX, rate: lean.aboutX.rate + turn.x },
    aboutZ: { ...lean.aboutZ, rate: lean.aboutZ.rate + turn.z },
  };
}
