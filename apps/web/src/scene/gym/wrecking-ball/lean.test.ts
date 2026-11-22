import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { GYM } from "../measurements";
import {
  type Lean,
  LEAN_FEEL,
  leanBy,
  leanByJolt,
  type LeanFeel,
  leanTurn,
  settleLean,
  UPRIGHT,
} from "./lean";

const { radius } = GYM.wreckingBall;
const RIGHT = new Vector3(radius, 0, 0);
const UNDER = new Vector3(0, -radius, 0);
const TO_THE_LEFT = new Vector3(-1, 0, 0);
const UPWARD = new Vector3(0, 1, 0);
const DOWN = new Vector3(0, -1, 0);
const FRAME = 1 / 60;
const { normal, reduced } = LEAN_FEEL;

/** 걸이에서 본 공의 아래쪽 방향입니다. 기울면 바로 아래에서 벗어납니다. */
function bottomOf(lean: Lean): Vector3 {
  return DOWN.clone().applyQuaternion(leanTurn(lean));
}

function tilts(lean: Lean, seconds: number, feel: LeanFeel = normal): number[] {
  const seen: number[] = [];
  let current = lean;

  for (let t = 0; t < seconds; t += FRAME) {
    current = settleLean(current, FRAME, feel);
    seen.push(bottomOf(current).angleTo(DOWN));
  }

  return seen;
}

function jabbedRight(strength: number, feel: LeanFeel = normal): Lean {
  return leanBy(UPRIGHT, { at: RIGHT, push: TO_THE_LEFT, strength }, feel);
}

describe("기우뚱", () => {
  it("옆구리를 맞으면 공의 아래쪽이 미는 쪽으로 먼저 나가며 기운다", () => {
    const leaned = settleLean(jabbedRight(0.4), 0.1, normal);

    expect(bottomOf(leaned).x).toBeLessThan(-0.01);
  });

  it("아래에서 곧게 올려 치면 기울지 않는다", () => {
    const lifted = leanBy(
      UPRIGHT,
      { at: UNDER, push: UPWARD, strength: 1 },
      normal,
    );

    expect(Math.max(...tilts(lifted, 1))).toBeLessThan(1e-9);
  });

  it("센 타격일수록 크게 기울고, 몇 번 오가다 1.5초쯤이면 거의 돌아온다", () => {
    const strong = tilts(jabbedRight(1), 1.5);
    const weak = tilts(jabbedRight(0.4), 1.5);
    const widest = Math.max(...strong);

    expect(Math.max(...weak)).toBeLessThan(widest);
    expect(widest).toBeGreaterThan(0.1);
    expect(strong.at(-1) ?? Infinity).toBeLessThan(widest * 0.1);
  });

  it("동작 줄이기에서는 기울지 않는다", () => {
    expect(Math.max(...tilts(jabbedRight(1, reduced), 1, reduced))).toBe(0);
  });

  it("옆으로 가던 공이 덜컹하면 아래쪽이 가던 쪽으로 기운다", () => {
    const jolted = leanByJolt(UPRIGHT, new Vector3(1, -2, 0), normal);

    expect(bottomOf(settleLean(jolted, 0.1, normal)).x).toBeGreaterThan(0.005);
  });

  it("곧게 떨어지다 덜컹하면 기울지 않는다", () => {
    const jolted = leanByJolt(UPRIGHT, new Vector3(0, -2, 0), normal);

    expect(Math.max(...tilts(jolted, 1))).toBeLessThan(1e-9);
  });
});
