import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { advanceBall, type BallMotion, restingBall, strikeBall } from "./ball";
import type { Blow } from "./swing";

const radius = 0.3;
const FRONT = new Vector3(0, 0, radius);
const INTO_SCREEN = new Vector3(0, 0, -1);

function swipe(speed: number): Blow {
  return { kind: "swipe", hitFromCenter: FRONT, fist: INTO_SCREEN, speed };
}

function struck(blow: Blow): BallMotion {
  return strikeBall(restingBall(), blow, "normal").motion;
}

function stillFor(motion: BallMotion): number {
  const start = motion.swing.fromPivot;
  let current = motion;
  let still = 0;

  while (current.swing.fromPivot.equals(start)) {
    current = advanceBall(current, 0.001, "normal").motion;
    still += 0.001;
  }

  return still - 0.001;
}

describe("히트스톱", () => {
  it("센 타격일수록 길게 멈추고, 0.05초에서 0.12초 사이다", () => {
    const weakest = stillFor(struck(swipe(0.01)));
    const jab = stillFor(
      struck({ kind: "jab", hitFromCenter: FRONT, fist: INTO_SCREEN }),
    );
    const hardest = stillFor(struck(swipe(100)));

    expect(weakest).toBeCloseTo(0.05, 2);
    expect(jab).toBeGreaterThan(weakest);
    expect(hardest).toBeCloseTo(0.12, 2);
  });

  it("멈춘 동안에는 레킹볼이 움직이지 않고, 멈춤이 끝나면 남은 시간만큼 움직인다", () => {
    const hit = struck(swipe(100));
    const unheld = { ...hit, hitStopLeft: 0 };

    expect(
      advanceBall(hit, 0.05, "normal").motion.swing.fromPivot.equals(
        hit.swing.fromPivot,
      ),
    ).toBe(true);
    expect(
      advanceBall(hit, 0.25, "normal").motion.swing.fromPivot.distanceTo(
        advanceBall(unheld, 0.13, "normal").motion.swing.fromPivot,
      ),
    ).toBeLessThan(1e-9);
  });

  it("레킹볼을 바꾸지 못한 타격은 멈추지 않는다", () => {
    const rest = restingBall();
    const runningAway = {
      ...rest,
      swing: { ...rest.swing, velocity: new Vector3(0, 0, -5) },
    };
    const { motion, strength } = strikeBall(
      runningAway,
      { kind: "jab", hitFromCenter: FRONT, fist: INTO_SCREEN },
      "normal",
    );

    expect(strength).toBe(0);
    expect(motion.hitStopLeft).toBe(0);
  });
});
