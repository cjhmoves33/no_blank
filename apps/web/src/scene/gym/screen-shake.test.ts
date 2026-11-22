import { describe, expect, it } from "vitest";

import { calmed, shaken, tiltOf, WIDEST_TILT } from "./screen-shake";

function widestOver(trauma: number): number {
  let widest = 0;

  for (let t = 0; t < 1; t += 0.001) {
    const { pitch, yaw, roll } = tiltOf(trauma, t);

    widest = Math.max(widest, Math.abs(pitch), Math.abs(yaw), Math.abs(roll));
  }

  return widest;
}

describe("화면 떨림", () => {
  it("타격 세기만큼 트라우마가 쌓이지만 1 을 넘지 않는다", () => {
    expect(shaken(0, 0.4)).toBeCloseTo(0.4, 9);
    expect(shaken(0.8, 0.6)).toBe(1);
  });

  it("가장 센 타격의 떨림도 0.4초면 멈춘다", () => {
    expect(calmed(1, 0.2)).toBeGreaterThan(0);
    expect(calmed(1, 0.4)).toBe(0);
  });

  it("떨림은 정해진 각을 넘지 않고, 약한 타격은 센 타격보다 훨씬 작게 떨린다", () => {
    expect(widestOver(1)).toBeLessThanOrEqual(WIDEST_TILT);
    expect(widestOver(1)).toBeGreaterThan(WIDEST_TILT * 0.8);
    expect(widestOver(0.4)).toBeLessThan(widestOver(1) * 0.2);
  });

  it("트라우마가 없으면 떨리지 않는다", () => {
    expect(widestOver(0)).toBe(0);
  });
});
