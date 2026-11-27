import {
  type Lean,
  LEAN_FEEL,
  leanBy,
  leanByJolt,
  settleLean,
  UPRIGHT,
} from "./lean";
import { RESTING_SPRING } from "./spring";
import {
  advance,
  type Blow,
  type Jolt,
  joltOf,
  restingSwing,
  strike,
  type Swing,
  SWING_FEEL,
} from "./swing";
import { spinDown, type Twist, TWIST_FEEL, twistBy } from "./twist";

/** 레킹볼의 흔들림, 비틀림, 기우뚱, 그리고 히트스톱으로 아직 멈춰 있어야 할 시간입니다. */
export interface BallMotion {
  readonly swing: Swing;
  readonly twist: Twist;
  readonly lean: Lean;
  readonly hitStopLeft: number;
}

export type BallFeel = keyof typeof SWING_FEEL;

const HIT_STOP = { shortest: 0.05, longest: 0.12 } as const;

export function restingBall(): BallMotion {
  return {
    swing: restingSwing(),
    twist: RESTING_SPRING,
    lean: UPRIGHT,
    hitStopLeft: 0,
  };
}

export function strikeBall(
  motion: BallMotion,
  blow: Blow,
  feel: BallFeel,
): { readonly motion: BallMotion; readonly strength: number } {
  const struck = strike(motion.swing, blow, SWING_FEEL[feel]);
  const { strength } = struck.strike;

  return {
    motion: {
      swing: struck.swing,
      twist: twistBy(motion.twist, { blow, strength }, TWIST_FEEL[feel]),
      lean: leanBy(
        motion.lean,
        { hitFromCenter: blow.hitFromCenter, push: struck.push, strength },
        LEAN_FEEL[feel],
      ),
      hitStopLeft:
        strength > 0
          ? HIT_STOP.shortest +
            (HIT_STOP.longest - HIT_STOP.shortest) * strength
          : motion.hitStopLeft,
    },
    strength,
  };
}

export function advanceBall(
  motion: BallMotion,
  seconds: number,
  feel: BallFeel,
): { readonly motion: BallMotion; readonly jolt: Jolt | null } {
  const held = Math.min(motion.hitStopLeft, seconds);
  const movingSeconds = seconds - held;
  const swing = advance(motion.swing, movingSeconds, SWING_FEEL[feel]);
  const settled = settleLean(motion.lean, movingSeconds, LEAN_FEEL[feel]);
  const jolt = joltOf(swing);

  return {
    motion: {
      swing,
      twist: spinDown(motion.twist, movingSeconds, TWIST_FEEL[feel]),
      lean: jolt
        ? leanByJolt(settled, swing.velocity, LEAN_FEEL[feel])
        : settled,
      hitStopLeft: motion.hitStopLeft - held,
    },
    jolt,
  };
}
