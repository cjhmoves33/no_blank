import type { Spring } from "./spring";
import { type Blow, STRAIGHT_CHAIN_AXIS, SWING_FEEL } from "./swing";

export type Twist = Spring;

const KICK_ON_WEIGHTLESS_BALL = 3;

const KICK_AT_FULL_STRENGTH =
  KICK_ON_WEIGHTLESS_BALL * SWING_FEEL.closingSpeedShare;

const FRICTION = frictionTurningHardestHook((35 * Math.PI) / 180);

export function twistBy(
  twist: Twist,
  { blow, strength }: { readonly blow: Blow; readonly strength: number },
): Twist {
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

export function spinDown(twist: Twist, seconds: number): Twist {
  const untilStill = Math.abs(twist.rate) / FRICTION;
  const spinning = Math.min(seconds, untilStill);
  const slowing = Math.sign(twist.rate) * FRICTION;

  return {
    angle: twist.angle + twist.rate * spinning - (slowing * spinning ** 2) / 2,
    rate: seconds >= untilStill ? 0 : twist.rate - slowing * seconds,
  };
}

function frictionTurningHardestHook(turn: number): number {
  return KICK_AT_FULL_STRENGTH ** 2 / (2 * turn);
}
