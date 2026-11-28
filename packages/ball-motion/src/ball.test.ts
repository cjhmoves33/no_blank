import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  advanceBall,
  type BallMotion,
  restingBall,
  strikeBall,
} from "./ball.ts";
import type { Blow } from "./swing.ts";

const radius = 0.3;
const FRONT = new Vector3(0, 0, radius);
const INTO_SCREEN = new Vector3(0, 0, -1);

function swipe(speed: number): Blow {
  return { kind: "swipe", hitFromCenter: FRONT, fist: INTO_SCREEN, speed };
}

function struck(blow: Blow): BallMotion {
  return strikeBall(restingBall(), blow).motion;
}

function heldFor(motion: BallMotion): number {
  let current = motion;
  let held = 0;

  while (current.hitStopLeft > 0 && held < 1) {
    current = advanceBall(current, 0.001).motion;
    held += 0.001;
  }

  return held;
}

describe("히트스톱", () => {
  it("센 타격일수록 길게 멈추고, 0.05초에서 0.12초 사이다", () => {
    const weakest = heldFor(struck(swipe(0.01)));
    const jab = heldFor(
      struck({ kind: "jab", hitFromCenter: FRONT, fist: INTO_SCREEN }),
    );
    const hardest = heldFor(struck(swipe(100)));

    expect(weakest).toBeCloseTo(0.05, 2);
    expect(jab).toBeGreaterThan(weakest);
    expect(hardest).toBeCloseTo(0.12, 2);
  });

  it("멈춘 동안에는 레킹볼이 움직이지 않고, 멈춤이 끝나면 남은 시간만큼 움직인다", () => {
    const hit = struck(swipe(100));
    const unheld = { ...hit, hitStopLeft: 0 };

    expect(
      advanceBall(hit, 0.05).motion.swing.fromPivot.equals(hit.swing.fromPivot),
    ).toBe(true);
    expect(
      advanceBall(hit, 0.25).motion.swing.fromPivot.distanceTo(
        advanceBall(unheld, 0.13).motion.swing.fromPivot,
      ),
    ).toBeLessThan(1e-9);
  });

  it("레킹볼을 바꾸지 못한 타격은 멈추지 않는다", () => {
    const rest = restingBall();
    const runningAway = {
      ...rest,
      swing: { ...rest.swing, velocity: new Vector3(0, 0, -5) },
    };
    const { motion, strength } = strikeBall(runningAway, {
      kind: "jab",
      hitFromCenter: FRONT,
      fist: INTO_SCREEN,
    });

    expect(strength).toBe(0);
    expect(motion.hitStopLeft).toBe(0);
  });
});

describe("프레임 나누기", () => {
  function inFrames(motion: BallMotion, seconds: number, fps: number) {
    let current = motion;
    const jolts: number[] = [];

    for (let i = 0; i < seconds * fps; i++) {
      const advanced = advanceBall(current, 1 / fps);

      current = advanced.motion;

      if (advanced.jolt) {
        jolts.push(advanced.jolt.strength);
      }
    }

    return { motion: current, jolts };
  }

  function numbersOf({ swing, twist, lean }: BallMotion) {
    return {
      fromPivot: swing.fromPivot.toArray(),
      velocity: swing.velocity.toArray(),
      twist: [twist.angle, twist.rate],
      lean: [
        lean.aboutX.angle,
        lean.aboutX.rate,
        lean.aboutZ.angle,
        lean.aboutZ.rate,
      ],
    };
  }

  function closeTo(numbers: Record<string, number[]>) {
    return Object.fromEntries(
      Object.entries(numbers).map(([name, values]) => [
        name,
        values.map((value): unknown => expect.closeTo(value, 9)),
      ]),
    );
  }

  it("같은 시간을 어떤 크기의 프레임으로 나누어 흘려도 레킹볼이 같게 움직이고 같은 덜컹을 알린다", () => {
    const uppercut = struck({
      kind: "swipe",
      hitFromCenter: new Vector3(-1, -2, 1).setLength(radius),
      fist: new Vector3(1, 2, 0).normalize(),
      speed: 100,
    });
    const [slowest, ...faster] = [30, 60, 144].map((fps) =>
      inFrames(uppercut, 2, fps),
    );

    if (!slowest) {
      throw new Error("프레임 속도가 하나 이상 있어야 합니다.");
    }

    expect(slowest.jolts.length).toBeGreaterThan(0);

    for (const { motion, jolts } of faster) {
      expect(numbersOf(motion)).toEqual(closeTo(numbersOf(slowest.motion)));
      expect(jolts).toEqual(slowest.jolts);
    }
  });

  it("긴 프레임 하나에 덜컹이 여러 번 있으면 가장 센 덜컹 하나를 알린다", () => {
    const rest = restingBall();
    const thrownUp = {
      ...rest,
      swing: { ...rest.swing, velocity: new Vector3(0, 1.5, 0) },
    };
    const { jolts } = inFrames(thrownUp, 2, 60);

    expect(jolts.length).toBeGreaterThan(1);
    expect(advanceBall(thrownUp, 2).jolt?.strength).toBe(Math.max(...jolts));
  });
});

describe("덜컹에 따른 기우뚱", () => {
  function draggedOutward(sideways: number): BallMotion {
    const rest = restingBall();

    return {
      ...rest,
      swing: { ...rest.swing, velocity: new Vector3(sideways, -1, 0) },
    };
  }

  it("옆으로 움직이다 사슬이 팽팽해지면 옆 속도만큼 기우뚱하고, 곧장 아래로 당겨지면 기우뚱하지 않는다", () => {
    const sideways = advanceBall(draggedOutward(1), 1 / 60);
    const straight = advanceBall(draggedOutward(0), 1 / 60);

    expect(sideways.jolt).not.toBeNull();
    expect(straight.jolt).not.toBeNull();
    expect(Math.abs(sideways.motion.lean.aboutZ.rate)).toBeGreaterThan(1);
    expect(straight.motion.lean.aboutX.rate).toBe(0);
    expect(straight.motion.lean.aboutZ.rate).toBe(0);
  });
});

describe("밖에서 온 타격", () => {
  function numbersOf(value: unknown): number[] {
    if (typeof value === "number") {
      return [value];
    }

    if (typeof value === "object" && value !== null) {
      return Object.values(value).flatMap(numbersOf);
    }

    return [];
  }

  it("기우뚱의 축이나 레킹볼 중심을 맞혀도, 레킹볼 상태는 모두 유한한 숫자로 남는다", () => {
    const blows: Blow[] = [
      {
        kind: "jab",
        hitFromCenter: new Vector3(0, 0.75, 0),
        fist: INTO_SCREEN,
      },
      { kind: "jab", hitFromCenter: new Vector3(), fist: INTO_SCREEN },
      {
        kind: "swipe",
        hitFromCenter: new Vector3(0, 0.75, 0),
        fist: new Vector3(),
        speed: 3,
      },
    ];

    for (const blow of blows) {
      const struck = strikeBall(restingBall(), blow).motion;
      const later = advanceBall(struck, 1).motion;

      expect(numbersOf(later).every(Number.isFinite)).toBe(true);
    }
  });
});
