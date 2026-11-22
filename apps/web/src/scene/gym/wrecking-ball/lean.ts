import { Quaternion, Vector3 } from "three";

import { HANGING_POINT } from "./leather";
import {
  criticallyDamped,
  RESTING_SPRING,
  settle,
  type Spring,
  type SpringFeel,
} from "./spring";
import type { SWING_FEEL } from "./swing";

export interface Lean {
  readonly x: Spring;
  readonly z: Spring;
}

export interface LeanFeel extends SpringFeel {
  readonly kick: number;
  readonly jolt: number;
}

export const LEAN_FEEL = {
  normal: { stiffness: 81, damping: 3.6, kick: 2, jolt: 1.5 },
  reduced: { ...criticallyDamped(81), kick: 0, jolt: 0 },
} as const satisfies Record<keyof typeof SWING_FEEL, LeanFeel>;

export const UPRIGHT: Lean = { x: RESTING_SPRING, z: RESTING_SPRING };

const UP = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);
const HINGE = new Vector3(0, HANGING_POINT, 0);

export function leanBy(
  lean: Lean,
  {
    at,
    push,
    strength,
  }: {
    readonly at: Vector3;
    readonly push: Vector3;
    readonly strength: number;
  },
  feel: LeanFeel,
): Lean {
  const lever = at.clone().sub(HINGE);
  const turn = lever.clone().cross(push).divideScalar(lever.length());

  return kicked(lean, turn.multiplyScalar(feel.kick * strength));
}

export function leanByJolt(
  lean: Lean,
  velocity: Vector3,
  feel: LeanFeel,
): Lean {
  const sideways = new Vector3(velocity.x, 0, velocity.z);

  return kicked(lean, sideways.cross(UP).multiplyScalar(feel.jolt));
}

export function settleLean(lean: Lean, seconds: number, feel: LeanFeel): Lean {
  return { x: settle(lean.x, seconds, feel), z: settle(lean.z, seconds, feel) };
}

export function leanTurn(lean: Lean): Quaternion {
  return new Quaternion()
    .setFromAxisAngle(X, lean.x.angle)
    .multiply(new Quaternion().setFromAxisAngle(Z, lean.z.angle));
}

function kicked(lean: Lean, turn: Vector3): Lean {
  return {
    x: { ...lean.x, rate: lean.x.rate + turn.x },
    z: { ...lean.z, rate: lean.z.rate + turn.z },
  };
}
