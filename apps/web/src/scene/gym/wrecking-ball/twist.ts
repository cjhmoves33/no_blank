import { criticallyDamped, type Spring, type SpringFeel } from "./spring";
import { type Blow, STRAIGHT_CHAIN_AXIS, type SWING_FEEL } from "./swing";

export type Twist = Spring;

export const TWIST_FEEL = {
  normal: { stiffness: 6, damping: 0.5 },
  reduced: criticallyDamped(96),
} as const satisfies Record<keyof typeof SWING_FEEL, SpringFeel>;

const KICK_AT_FULL_STRENGTH = 3;

export function twistBy(twist: Twist, blow: Blow, strength: number): Twist {
  const turn = blow.hitFromCenter
    .clone()
    .normalize()
    .cross(blow.fist.clone().normalize())
    .dot(STRAIGHT_CHAIN_AXIS);

  return {
    angle: twist.angle,
    rate: twist.rate + KICK_AT_FULL_STRENGTH * strength * turn,
  };
}
