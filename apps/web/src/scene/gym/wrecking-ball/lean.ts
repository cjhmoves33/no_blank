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

/**
 * 기우뚱입니다. 레킹볼이 걸이를 축으로 사슬과 따로 기운 각을, 월드의 x 축과 z 축을 도는 두 각으로 나눠 가집니다.
 * 기운 각은 작아서 두 축을 따로 되돌려도 됩니다.
 */
export interface Lean {
  readonly x: Spring;
  readonly z: Spring;
}

/** kick 은 타격 세기 1 인 주먹이, jolt 는 1 m/s 로 옆으로 가던 공의 덜컹이 더하는 각속도(라디안/초)입니다. */
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
// 사슬은 거의 곧게 매달려 있으므로 걸이가 공의 중심 바로 위에 있다고 봅니다.
const HINGE = new Vector3(0, HANGING_POINT, 0);

/**
 * 주먹이 걸이보다 아래를 밀면 공은 걸이를 축으로 기웁니다. 공의 아래쪽이 미는 방향으로 먼저 나갑니다.
 * at 은 맞은 자리를 공의 중심에서 잰 벡터, push 는 미는 방향입니다.
 */
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

/** 옆으로 가던 공이 덜컹하면, 걸이는 사슬에 붙잡히고 공의 아래쪽은 가던 쪽으로 더 나갑니다. */
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

/** 걸이를 축으로 기운 회전입니다. */
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
