import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  age,
  DENT_FEEL,
  dentDepth,
  dentedNormal,
  type DentFeel,
  type Impact,
  impactOf,
  sinking,
} from "./impact";

const FRONT = new Vector3(0, 0, 1);
const FRAME = 1 / 60;
const { normal, reduced } = DENT_FEEL;

function struck(strength: number): Impact {
  const impact = impactOf(FRONT, strength);

  if (!impact) {
    throw new Error("타격 자국이 없습니다.");
  }

  return impact;
}

function play(impact: Impact, seconds: number, feel: DentFeel = normal) {
  const depths: number[] = [];
  let current: Impact | null = impact;

  for (let t = 0; t < seconds; t += FRAME) {
    const aged: ReturnType<typeof age> = current
      ? age(current, FRAME)
      : { impact: null, moving: FRAME };

    current = aged.impact;
    depths.push(current ? dentDepth(current, feel) : 0);
  }

  return { depths, left: current };
}

function stillFor(impact: Impact): number {
  let current: Impact | null = impact;
  let still = 0;

  while (current) {
    const aged = age(current, 0.001);

    if (aged.moving > 0) {
      return still;
    }

    still += 0.001;
    current = aged.impact;
  }

  return still;
}

describe("히트스톱", () => {
  it("센 타격일수록 길게 멈추고, 0.03초에서 0.1초 사이다", () => {
    expect(stillFor(struck(0.01))).toBeCloseTo(0.03, 2);
    expect(stillFor(struck(0.4))).toBeGreaterThan(stillFor(struck(0.01)));
    expect(stillFor(struck(1))).toBeCloseTo(0.1, 2);
  });

  it("멈춘 동안에는 레킹볼이 움직이지 않고, 멈춤이 끝나면 남은 시간만큼 움직인다", () => {
    const impact = struck(1);

    expect(age(impact, 0.05).moving).toBe(0);
    expect(age(impact, 0.25).moving).toBeCloseTo(0.15, 9);
  });

  it("레킹볼을 바꾸지 못한 타격은 멈추지도 패지도 않는다", () => {
    expect(impactOf(FRONT, 0)).toBeNull();
  });
});

describe("패임", () => {
  it("히트스톱 동안 가장 깊고, 센 타격일수록 깊다", () => {
    const { depths } = play(struck(1), 0.08);

    expect(Math.min(...depths)).toBeCloseTo(0.03, 9);
    expect(dentDepth(struck(0.4), normal)).toBeLessThan(
      dentDepth(struck(1), normal),
    );
  });

  it("멈춤이 끝나고 0.12초쯤이면 거의 돌아오고, 살짝 튀어나왔다 돌아간다", () => {
    const impact = struck(1);
    const { depths, left } = play(impact, impact.hold + 0.12);
    const deepest = dentDepth(impact, normal);

    expect(Math.abs(depths.at(-1) ?? Infinity)).toBeLessThan(deepest * 0.05);
    expect(Math.min(...depths)).toBeLessThan(-deepest * 0.05);
    expect(play(impact, 1).left).toBeNull();
    expect(left).not.toBeNull();
  });

  it("동작 줄이기에서는 튀어나오지 않고 돌아온다", () => {
    const { depths } = play(struck(1), 0.4, reduced);

    expect(Math.min(...depths)).toBeGreaterThanOrEqual(0);
  });

  it("맞은 자리가 가장 깊고, 10 cm 쯤 떨어진 곳은 얕고, 반대편은 그대로다", () => {
    const depth = 0.03;
    const near = new Vector3(0.33, 0, 1).normalize();

    expect(sinking(FRONT, FRONT, depth)).toBeCloseTo(depth, 9);
    expect(sinking(near, FRONT, depth)).toBeLessThan(depth * 0.5);
    expect(sinking(near, FRONT, depth)).toBeGreaterThan(depth * 0.2);
    expect(sinking(FRONT.clone().negate(), FRONT, depth)).toBeLessThan(1e-9);
  });

  it("패인 벽은 맞은 자리 쪽을 보고, 맞은 자리와 멀리 떨어진 곳의 법선은 그대로다", () => {
    const wall = new Vector3(0.25, 0, 1).normalize();
    const far = new Vector3(1, 0, 0);

    expect(dentedNormal(wall, FRONT, 0.03).x).toBeLessThan(wall.x);
    expect(dentedNormal(FRONT, FRONT, 0.03).distanceTo(FRONT)).toBeLessThan(
      1e-9,
    );
    expect(dentedNormal(far, FRONT, 0.03).distanceTo(far)).toBeLessThan(1e-6);
  });
});
