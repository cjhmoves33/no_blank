import { criticallyDamped, type Spring, type SpringFeel } from "./spring";
import { type Blow, STRAIGHT_CHAIN_AXIS, SWING_FEEL } from "./swing";

export type Twist = Spring;

export interface TwistFeel extends SpringFeel {
  readonly kickAtFullStrength: number;
}

const KICK_BEFORE_FIST_SHARE = 3;

export const TWIST_FEEL = {
  normal: {
    stiffness: 6,
    damping: 0.5,
    kickAtFullStrength: KICK_BEFORE_FIST_SHARE * SWING_FEEL.normal.fistShare,
  },
  reduced: {
    ...criticallyDamped(96),
    kickAtFullStrength: KICK_BEFORE_FIST_SHARE * SWING_FEEL.reduced.fistShare,
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
