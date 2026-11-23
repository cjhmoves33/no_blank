import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { GYM } from "../measurements";
import { RESTING_SPRING } from "./spring";
import type { Blow } from "./swing";
import {
  spinDown,
  type Twist,
  TWIST_FEEL,
  twistBy,
  type TwistFeel,
} from "./twist";

const { radius } = GYM.wreckingBall;
const INTO_SCREEN = new Vector3(0, 0, -1);
const FRONT = new Vector3(0, 0, radius);
const RIGHT = new Vector3(radius, 0, 0);
const LEFT = new Vector3(-radius, 0, 0);
const TO_THE_RIGHT = new Vector3(1, 0, 0);
const UPWARD = new Vector3(0, 1, 0);
const FRAME = 1 / 60;
const { normal, reduced } = TWIST_FEEL;

function jab(hitFromCenter: Vector3): Blow {
  return { kind: "jab", hitFromCenter, fist: INTO_SCREEN };
}

function swipe(fist: Vector3): Blow {
  return { kind: "swipe", hitFromCenter: FRONT, fist, speed: 3 };
}

function angles(
  twist: Twist,
  seconds: number,
  feel: TwistFeel = normal,
): number[] {
  const seen: number[] = [];
  let current = twist;

  for (let t = 0; t < seconds; t += FRAME) {
    current = spinDown(current, FRAME, feel);
    seen.push(current.angle);
  }

  return seen;
}

function widest(twist: Twist, feel: TwistFeel = normal): number {
  return Math.max(...angles(twist, 3, feel).map(Math.abs));
}

describe("twist", () => {
  it("정면 가운데를 잽으로 치면 비틀리지 않는다", () => {
    expect(
      widest(
        twistBy(RESTING_SPRING, { blow: jab(FRONT), strength: 1 }, normal),
      ),
    ).toBe(0);
  });

  it("옆 가장자리를 잽으로 치면 비틀리고, 반대쪽 가장자리는 반대로 비틀린다", () => {
    const right = twistBy(
      RESTING_SPRING,
      { blow: jab(RIGHT), strength: 0.4 },
      normal,
    );
    const left = twistBy(
      RESTING_SPRING,
      { blow: jab(LEFT), strength: 0.4 },
      normal,
    );
    const [firstRight = 0] = angles(right, FRAME);
    const [firstLeft = 0] = angles(left, FRAME);

    expect(widest(right)).toBeGreaterThan(0.05);
    expect(Math.sign(firstRight)).toBe(-Math.sign(firstLeft));
  });

  it("옆으로 휘두르면(훅) 비틀리고, 아래에서 위로 휘두르면(어퍼컷) 비틀리지 않는다", () => {
    expect(
      widest(
        twistBy(
          RESTING_SPRING,
          { blow: swipe(TO_THE_RIGHT), strength: 1 },
          normal,
        ),
      ),
    ).toBeGreaterThan(0.15);
    expect(
      widest(
        twistBy(RESTING_SPRING, { blow: swipe(UPWARD), strength: 1 }, normal),
      ),
    ).toBeLessThan(1e-9);
  });

  it("타격 세기가 클수록 크게 비틀리고, 세기가 0 이면 비틀리지 않는다", () => {
    const by = (strength: number) =>
      widest(twistBy(RESTING_SPRING, { blow: jab(RIGHT), strength }, normal));

    expect(by(0)).toBe(0);
    expect(by(0.4)).toBeLessThan(by(1));
  });

  it("가장 센 훅에는 35도 안팎 돌고, 2초쯤에 멈춘다", () => {
    const hooked = twistBy(
      RESTING_SPRING,
      { blow: swipe(TO_THE_RIGHT), strength: 1 },
      normal,
    );

    expect(spinDown(hooked, 1.5, normal).rate).toBeGreaterThan(0);
    expect(spinDown(hooked, 2.5, normal).rate).toBe(0);
    expect(spinDown(hooked, 3, normal).angle).toBeGreaterThan(
      (30 * Math.PI) / 180,
    );
    expect(spinDown(hooked, 3, normal).angle).toBeLessThan(
      (40 * Math.PI) / 180,
    );
  });

  it("잽으로 가장자리를 치면 6도 안팎 돌고, 1초 안에 멈춘다", () => {
    const jabbed = twistBy(
      RESTING_SPRING,
      { blow: jab(RIGHT), strength: 0.4 },
      normal,
    );

    expect(spinDown(jabbed, 1, normal).rate).toBe(0);
    expect(Math.abs(spinDown(jabbed, 1, normal).angle)).toBeGreaterThan(
      (4 * Math.PI) / 180,
    );
    expect(Math.abs(spinDown(jabbed, 1, normal).angle)).toBeLessThan(
      (8 * Math.PI) / 180,
    );
  });

  it("회전 고리에서 돌므로 되감기지 않고, 마찰로 멈춘 뒤 그 방향에 머문다", () => {
    const twisted = twistBy(
      RESTING_SPRING,
      { blow: swipe(TO_THE_RIGHT), strength: 1 },
      normal,
    );
    const seen = angles(twisted, 10);

    seen.forEach((angle, i) => {
      expect(angle).toBeGreaterThanOrEqual(seen[i - 1] ?? 0);
    });
    expect(seen.at(-1)).toBeGreaterThan(0.15);
    expect(spinDown(twisted, 10, normal).rate).toBe(0);
  });

  it("동작 줄이기에서는 가장 센 훅에도 조금만 돌고, 0.5초 안에 멈춘다", () => {
    const twisted = twistBy(
      RESTING_SPRING,
      { blow: swipe(TO_THE_RIGHT), strength: 1 },
      reduced,
    );

    expect(spinDown(twisted, 0.5, reduced).rate).toBe(0);
    expect(spinDown(twisted, 0.5, reduced).angle).toBeLessThan(
      (6 * Math.PI) / 180,
    );
  });

  it("프레임 속도와 관계없이 같은 비틀림이 된다", () => {
    const twisted = twistBy(
      RESTING_SPRING,
      { blow: jab(RIGHT), strength: 1 },
      normal,
    );
    const atOnce = spinDown(twisted, 1.5, normal).angle;

    for (const fps of [60, 144]) {
      let byFrames = twisted;

      for (let i = 0; i < 1.5 * fps; i++) {
        byFrames = spinDown(byFrames, 1 / fps, normal);
      }

      expect(byFrames.angle).toBeCloseTo(atOnce, 6);
    }
  });
});
