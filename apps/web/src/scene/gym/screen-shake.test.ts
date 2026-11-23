import { describe, expect, it } from "vitest";

import { calmed, shaken, tiltOf } from "./screen-shake";

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

  it("가장 센 타격은 0.4도까지 떨린다", () => {
    expect(widestOver(1)).toBeLessThanOrEqual((0.4 * Math.PI) / 180);
    expect(widestOver(1)).toBeGreaterThan((0.3 * Math.PI) / 180);
  });

  it("떨림은 트라우마에 정비례해서, 잽(0.4)도 가장 센 타격의 40% 만큼 떨린다", () => {
    expect(widestOver(0.4) / widestOver(1)).toBeCloseTo(0.4, 2);
  });

  it("트라우마가 없으면 떨리지 않는다", () => {
    expect(widestOver(0)).toBe(0);
  });
});
