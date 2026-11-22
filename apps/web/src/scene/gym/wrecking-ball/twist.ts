import { Vector3 } from "three";

import { criticallyDamped, type Spring, type SpringFeel } from "./spring";
import type { Blow, SWING_FEEL } from "./swing";

/** 비틀림입니다. angle 은 쉬는 자세에서 사슬 축으로 돈 각입니다. 꼬인 사슬이 되감기듯 settle 로 되돌아옵니다. */
export type Twist = Spring;

export const TWIST_FEEL = {
  normal: { stiffness: 6, damping: 0.5 },
  reduced: criticallyDamped(96),
} as const satisfies Record<keyof typeof SWING_FEEL, SpringFeel>;

/** 타격 세기 1 인 주먹이 맞은 자리의 접선 방향으로 지날 때 더하는 각속도(라디안/초)입니다. */
const KICK = 3;

const UP = new Vector3(0, 1, 0);

/**
 * 주먹이 맞은 자리의 법선에서 벗어날수록, 타격 세기가 클수록 크게 비틉니다.
 * 사슬은 거의 곧게 매달려 있으므로 사슬 축을 위쪽으로 봅니다.
 */
export function twistBy(twist: Twist, blow: Blow, strength: number): Twist {
  const turn = blow.at.clone().normalize().cross(blow.fist).dot(UP);

  return { angle: twist.angle, rate: twist.rate + KICK * strength * turn };
}
