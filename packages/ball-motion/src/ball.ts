import { type Lean, leanBy, leanByJolt, settleLean, UPRIGHT } from "./lean.ts";
import { RESTING_SPRING } from "./spring.ts";
import {
  type Blow,
  type Jolt,
  restingSwing,
  STEP,
  stepSwing,
  strike,
  type Swing,
} from "./swing.ts";
import { spinDown, type Twist, twistBy } from "./twist.ts";

/** 레킹볼의 흔들림, 비틀림, 기우뚱, 그리고 히트스톱으로 아직 멈춰 있어야 할 시간입니다. */
export interface BallMotion {
  readonly swing: Swing;
  readonly twist: Twist;
  readonly lean: Lean;
  readonly hitStopLeft: number;
  /**
   * 흔들림, 비틀림, 기우뚱은 STEP(1/240초) 단위로만 움직입니다. 한 STEP에 못 미쳐 남은 시간은
   * 여기 두었다가 다음 advanceBall에서 씁니다. 그래서 같은 시간을 프레임으로 어떻게 나누어도
   * 레킹볼이 같게 움직입니다.
   */
  readonly unsimulatedSeconds: number;
}

const HIT_STOP = { shortest: 0.05, longest: 0.12 } as const;

export function restingBall(): BallMotion {
  return {
    swing: restingSwing(),
    twist: RESTING_SPRING,
    lean: UPRIGHT,
    hitStopLeft: 0,
    unsimulatedSeconds: 0,
  };
}

export function strikeBall(
  motion: BallMotion,
  blow: Blow,
): { readonly motion: BallMotion; readonly strength: number } {
  const struck = strike(motion.swing, blow);
  const { strength } = struck.strike;

  return {
    motion: {
      swing: struck.swing,
      twist: twistBy(motion.twist, { blow, strength }),
      lean: leanBy(motion.lean, {
        hitFromCenter: blow.hitFromCenter,
        push: struck.push,
        strength,
      }),
      hitStopLeft:
        strength > 0
          ? HIT_STOP.shortest +
            (HIT_STOP.longest - HIT_STOP.shortest) * strength
          : motion.hitStopLeft,
      unsimulatedSeconds: motion.unsimulatedSeconds,
    },
    strength,
  };
}

export function advanceBall(
  motion: BallMotion,
  seconds: number,
): {
  readonly motion: BallMotion;
  readonly jolt: Jolt | null;
  readonly movingSeconds: number;
} {
  const held = Math.min(motion.hitStopLeft, seconds);
  const movingSeconds = seconds - held;
  let { swing, twist, lean } = motion;
  let unsimulatedSeconds = motion.unsimulatedSeconds + movingSeconds;
  let strongest: Jolt | null = null;

  while (unsimulatedSeconds >= STEP) {
    const { swing: stepped, jolt } = stepSwing(swing);

    swing = stepped;
    twist = spinDown(twist, STEP);
    lean = settleLean(lean, STEP);

    if (jolt) {
      lean = leanByJolt(lean, swing.velocity);
      strongest =
        strongest && strongest.strength >= jolt.strength ? strongest : jolt;
    }

    unsimulatedSeconds -= STEP;
  }

  return {
    motion: {
      swing,
      twist,
      lean,
      hitStopLeft: motion.hitStopLeft - held,
      unsimulatedSeconds,
    },
    jolt: strongest,
    movingSeconds,
  };
}
