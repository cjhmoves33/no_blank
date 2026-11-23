import { describe, expect, it } from "vitest";

import { agedKicks, pushedBack, recoilAfter } from "./recoil";

function over(seconds: number, strength: number): number[] {
  return Array.from({ length: Math.round(seconds / 0.001) + 1 }, (_, i) =>
    recoilAfter(i * 0.001, strength),
  );
}

describe("되밀림", () => {
  it("가장 센 타격에는 0.05초 만에 4 cm 밀린다", () => {
    const seen = over(0.3, 1);
    const farthest = Math.max(...seen);

    expect(farthest).toBeCloseTo(0.04, 4);
    expect(seen.indexOf(farthest) * 0.001).toBeCloseTo(0.05, 2);
  });

  it("넘어가지 않고 0.3초면 거의 제자리로 돌아온다", () => {
    const seen = over(0.3, 1);

    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
    expect(seen.at(-1)).toBeLessThan(0.04 * 0.05);
  });

  it("타격 세기에 정비례한다", () => {
    expect(recoilAfter(0.05, 0.4)).toBeCloseTo(0.4 * recoilAfter(0.05, 1), 9);
    expect(recoilAfter(0.05, 0)).toBe(0);
  });

  it("연달아 맞으면 밀림이 더해지고, 오래된 타격은 잊는다", () => {
    const kicks = [
      { age: 0.05, strength: 1 },
      { age: 0.02, strength: 0.4 },
    ];

    expect(pushedBack(kicks)).toBeCloseTo(
      recoilAfter(0.05, 1) + recoilAfter(0.02, 0.4),
      9,
    );
    const aged = agedKicks(kicks, 0.01);

    expect(aged.map((kick) => kick.strength)).toEqual([1, 0.4]);
    aged.forEach((kick, i) => {
      expect(kick.age).toBeCloseTo((kicks[i]?.age ?? 0) + 0.01, 9);
    });
    expect(agedKicks(kicks, 2)).toEqual([]);
  });
});
