import { Vector3 } from "three";

import { criticallyDamped, type Spring, type SpringFeel } from "./spring";
import type { Blow, SWING_FEEL } from "./swing";

export type Twist = Spring;

export const TWIST_FEEL = {
  normal: { stiffness: 6, damping: 0.5 },
  reduced: criticallyDamped(96),
} as const satisfies Record<keyof typeof SWING_FEEL, SpringFeel>;

const KICK = 3;

const UP = new Vector3(0, 1, 0);

export function twistBy(twist: Twist, blow: Blow, strength: number): Twist {
  const turn = blow.at.clone().normalize().cross(blow.fist).dot(UP);

  return { angle: twist.angle, rate: twist.rate + KICK * strength * turn };
}
