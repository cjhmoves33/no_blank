import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { GYM } from "../measurements";
import { RESTING_SPRING, settle, type SpringFeel } from "./spring";
import type { Blow } from "./swing";
import { type Twist, TWIST_FEEL, twistBy } from "./twist";

const { radius } = GYM.wreckingBall;
const INTO_SCREEN = new Vector3(0, 0, -1);
const FRONT = new Vector3(0, 0, radius);
const RIGHT = new Vector3(radius, 0, 0);
const LEFT = new Vector3(-radius, 0, 0);
const TO_THE_RIGHT = new Vector3(1, 0, 0);
const UPWARD = new Vector3(0, 1, 0);
const FRAME = 1 / 60;
const { normal, reduced } = TWIST_FEEL;

function jab(at: Vector3): Blow {
  return { kind: "jab", at, fist: INTO_SCREEN };
}

function swipe(fist: Vector3): Blow {
  return { kind: "swipe", at: FRONT, fist, speed: 3 };
}

function angles(
  twist: Twist,
  seconds: number,
  feel: SpringFeel = normal,
): number[] {
  const seen: number[] = [];
  let current = twist;

  for (let t = 0; t < seconds; t += FRAME) {
    current = settle(current, FRAME, feel);
    seen.push(current.angle);
  }

  return seen;
}

function widest(twist: Twist, feel: SpringFeel = normal): number {
  return Math.max(...angles(twist, 3, feel).map(Math.abs));
}

describe("twist", () => {
  it("정면 가운데를 잽으로 치면 비틀리지 않는다", () => {
    expect(widest(twistBy(RESTING_SPRING, jab(FRONT), 1))).toBe(0);
  });

  it("옆 가장자리를 잽으로 치면 비틀리고, 반대쪽 가장자리는 반대로 비틀린다", () => {
    const right = twistBy(RESTING_SPRING, jab(RIGHT), 0.4);
    const left = twistBy(RESTING_SPRING, jab(LEFT), 0.4);
    const [firstRight = 0] = angles(right, FRAME);
    const [firstLeft = 0] = angles(left, FRAME);

    expect(widest(right)).toBeGreaterThan(0.2);
    expect(Math.sign(firstRight)).toBe(-Math.sign(firstLeft));
  });

  it("옆으로 휘두르면(훅) 비틀리고, 아래에서 위로 휘두르면(어퍼컷) 비틀리지 않는다", () => {
    expect(
      widest(twistBy(RESTING_SPRING, swipe(TO_THE_RIGHT), 1)),
    ).toBeGreaterThan(0.5);
    expect(widest(twistBy(RESTING_SPRING, swipe(UPWARD), 1))).toBeLessThan(
      1e-9,
    );
  });

  it("타격 세기가 클수록 크게 비틀리고, 세기가 0 이면 비틀리지 않는다", () => {
    const by = (strength: number) =>
      widest(twistBy(RESTING_SPRING, jab(RIGHT), strength));

    expect(by(0)).toBe(0);
    expect(by(0.4)).toBeLessThan(by(1));
  });

  it("꼬인 사슬이 풀리듯 반대쪽으로 넘어갔다가, 10초쯤 지나면 거의 멈춘다", () => {
    const twisted = twistBy(RESTING_SPRING, swipe(TO_THE_RIGHT), 1);
    const seen = angles(twisted, 10);
    const last = seen.at(-1) ?? Infinity;

    expect(Math.min(...seen)).toBeLessThan(-0.2);
    expect(Math.abs(last)).toBeLessThan(widest(twisted) * 0.15);
  });

  it("동작 줄이기에서는 넘어가지 않고 1초 안에 멈춘다", () => {
    const twisted = twistBy(RESTING_SPRING, swipe(TO_THE_RIGHT), 1);
    const seen = angles(twisted, 1, reduced);

    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
    expect(Math.abs(seen.at(-1) ?? Infinity)).toBeLessThan(0.001);
  });

  it("프레임 속도와 관계없이 같은 비틀림이 된다", () => {
    const twisted = twistBy(RESTING_SPRING, jab(RIGHT), 1);
    const atOnce = settle(twisted, 1.5, normal).angle;

    for (const fps of [60, 144]) {
      let byFrames = twisted;

      for (let i = 0; i < 1.5 * fps; i++) {
        byFrames = settle(byFrames, 1 / fps, normal);
      }

      expect(byFrames.angle).toBeCloseTo(atOnce, 6);
    }
  });
});
