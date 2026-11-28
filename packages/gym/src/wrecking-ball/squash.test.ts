import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { age, type Impact, impactOf } from "./impact";
import { flattening, SQUASH_FEEL, squashMatrix } from "./squash";

const FRONT = new Vector3(0, 0, 1);
const SIDE = new Vector3(1, 0, 0);
const FRAME = 1 / 60;
const { normal, reduced } = SQUASH_FEEL;

function struck(strength: number): Impact {
  const impact = impactOf(FRONT, strength);

  if (!impact) {
    throw new Error("타격이 있어야 합니다.");
  }

  return impact;
}

function afterHitStop(impact: Impact, seconds: number): Impact | null {
  return age(impact, seconds);
}

function flatteningOver(impact: Impact, seconds: number): number[] {
  const seen: number[] = [];

  for (let t = 0; t <= seconds; t += 0.005) {
    const later = afterHitStop(impact, t);

    seen.push(later ? flattening(later, normal) : 0);
  }

  return seen;
}

describe("출렁임", () => {
  it("히트스톱 동안 맞은 방향으로 가장 납작하고, 가장 센 타격은 8% 납작해진다", () => {
    expect(flattening(struck(1), normal)).toBeCloseTo(0.08, 9);
    expect(flattening(struck(0.4), normal)).toBeCloseTo(0.032, 9);
  });

  it("멈춤이 끝나면 두세 번 출렁이다가 0.4초 안에 둥글게 돌아온다", () => {
    const seen = flatteningOver(struck(1), 0.4);
    const turns = seen
      .slice(1)
      .filter((value, i) => Math.sign(value) !== Math.sign(seen[i] ?? 0));

    expect(turns.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(seen.at(-1) ?? Infinity)).toBeLessThan(0.08 * 0.05);
  });

  it("출렁임은 둥글게 돌아올 때까지 끊기지 않고 이어진다", () => {
    expect(afterHitStop(struck(1), 0.4)).not.toBeNull();
  });

  it("납작해진 만큼 옆으로 불룩해져서 부피는 그대로다", () => {
    for (const amount of [0.08, -0.04]) {
      const squash = squashMatrix(SIDE, amount);

      expect(squash.determinant()).toBeCloseTo(1, 9);
      expect(SIDE.clone().applyMatrix4(squash).length()).toBeCloseTo(
        1 - amount,
        9,
      );
      expect(FRONT.clone().applyMatrix4(squash).length()).toBeCloseTo(
        1 / Math.sqrt(1 - amount),
        9,
      );
    }
  });

  it("동작 줄이기에서는 출렁이지 않는다", () => {
    expect(flattening(struck(1), reduced)).toBe(0);
  });

  it("프레임 속도와 관계없이 같은 출렁임이 된다", () => {
    const impact = struck(1);
    let byFrames: Impact | null = impact;

    for (let i = 0; i < 12; i++) {
      byFrames = byFrames ? age(byFrames, FRAME) : null;
    }

    const atOnce = age(impact, 12 * FRAME);

    if (!byFrames || !atOnce) {
      throw new Error("타격이 아직 남아 있어야 합니다.");
    }

    expect(flattening(byFrames, normal)).toBeCloseTo(
      flattening(atOnce, normal),
      9,
    );
  });
});
