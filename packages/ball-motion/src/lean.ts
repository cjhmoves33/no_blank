import { Vector3 } from "three";

import { HANGING_HEIGHT } from "./measurements.ts";
import { RESTING_SPRING, settle, type Spring } from "./spring.ts";
import { STRAIGHT_CHAIN_AXIS, SWING_FEEL } from "./swing.ts";

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
  const reach = lever.length();

  // 기우뚱의 축을 맞힌 타격에는 기울일 지렛대가 없습니다. 레킹볼 표면에서는 생기지 않지만,
  // 서버는 밖에서 온 타격을 받으므로 0 으로 나누어 NaN 이 되지 않게 합니다.
  if (reach === 0) {
    return lean;
  }

  const turn = lever.clone().cross(push).divideScalar(reach);

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
