import type { Spring } from "./spring";
import { type Blow, STRAIGHT_CHAIN_AXIS, SWING_FEEL } from "./swing";

export type Twist = Spring;

export interface TwistFeel {
  readonly kickAtFullStrength: number;
  readonly friction: number;
}

const KICK_ON_WEIGHTLESS_BALL = 3;

const KICK_AT_FULL_STRENGTH =
  KICK_ON_WEIGHTLESS_BALL * SWING_FEEL.normal.closingSpeedShare;

export const TWIST_FEEL = {
  normal: {
    kickAtFullStrength: KICK_AT_FULL_STRENGTH,
    friction: frictionTurningHardestHook((35 * Math.PI) / 180),
  },
  reduced: {
    kickAtFullStrength: KICK_AT_FULL_STRENGTH,
    friction: frictionStoppingHardestHookIn(0.25),
  },
} as const satisfies Record<keyof typeof SWING_FEEL, TwistFeel>;

export function twistBy(
  twist: Twist,
  { blow, strength }: { readonly blow: Blow; readonly strength: number },
  feel: TwistFeel,
): Twist {
  const turn = blow.hitFromCenter
    .clone()
    .normalize()
    .cross(blow.fist.clone().normalize())
    .dot(STRAIGHT_CHAIN_AXIS);

  return {
    angle: twist.angle,
    rate: twist.rate + feel.kickAtFullStrength * strength * turn,
  };
}

export function spinDown(
  twist: Twist,
  seconds: number,
  feel: TwistFeel,
): Twist {
  const untilStill = Math.abs(twist.rate) / feel.friction;
  const spinning = Math.min(seconds, untilStill);
  const slowing = Math.sign(twist.rate) * feel.friction;

  return {
    angle: twist.angle + twist.rate * spinning - (slowing * spinning ** 2) / 2,
    rate: seconds >= untilStill ? 0 : twist.rate - slowing * seconds,
  };
}

function frictionTurningHardestHook(turn: number): number {
  return KICK_AT_FULL_STRENGTH ** 2 / (2 * turn);
}

function frictionStoppingHardestHookIn(seconds: number): number {
  return KICK_AT_FULL_STRENGTH / seconds;
}
