import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { seededRandom } from "../brushes";
import {
  burst,
  drift,
  glow,
  type Grain,
  GRAINS_AT_FULL_STRENGTH,
} from "./dust";

const HIT = new Vector3(0, 0, 0.3);
const OUTWARD = new Vector3(0, 0, 1);
const FRAME = 1 / 60;

function puff(strength: number): Grain[] {
  return burst(HIT, OUTWARD, { strength, random: seededRandom(7) });
}

function after(grains: readonly Grain[], seconds: number): Grain[] {
  let current = [...grains];

  for (let t = 0; t < seconds; t += FRAME) {
    current = drift(current, FRAME);
  }

  return current;
}

describe("타격 먼지", () => {
  it("센 타격일수록 많이 피어오르고, 세기가 0 이면 피지 않는다", () => {
    expect(puff(1)).toHaveLength(GRAINS_AT_FULL_STRENGTH);
    expect(puff(0.4).length).toBeLessThan(puff(1).length);
    expect(puff(0)).toHaveLength(0);
  });

  it("맞은 자리에서 바깥으로 나오며 표면을 따라 퍼진다", () => {
    const spread = after(puff(1), 0.3);
    const xs = spread.map((grain) => grain.position.x);

    for (const grain of spread) {
      expect(grain.position.z).toBeGreaterThan(HIT.z);
    }

    expect(Math.min(...xs)).toBeLessThan(-0.02);
    expect(Math.max(...xs)).toBeGreaterThan(0.02);
  });

  it("퍼진 뒤에는 천천히 가라앉는다", () => {
    const early = after(puff(1), 0.8);
    const late = after(early, 0.6);
    const height = (grains: readonly Grain[]) =>
      grains.reduce((sum, grain) => sum + grain.position.y, 0) / grains.length;

    expect(height(late)).toBeLessThan(height(early));
  });

  it("금방 밝아졌다가 흐려지고, 2.5초 안에 모두 사라진다", () => {
    const [grain] = puff(1);

    if (!grain) {
      throw new Error("먼지가 없습니다.");
    }

    expect(glow(grain)).toBe(0);
    expect(glow({ ...grain, age: 0.2 })).toBeGreaterThan(0.8);
    expect(glow({ ...grain, age: grain.life * 0.9 })).toBeLessThan(0.15);
    expect(after(puff(1), 2.6)).toHaveLength(0);
  });
});
