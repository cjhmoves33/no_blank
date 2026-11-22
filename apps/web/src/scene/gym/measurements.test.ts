import { Spherical, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { GYM, VIEW } from "./measurements";

// 로프 반지름 바깥으로 카메라 near 면(0.1)이 로프에 닿지 않을 여유입니다.
const ROPE_MARGIN = 0.2;
// 0.75 m 보다 낮으면 매트 무늬만 보입니다.
const EYE_ABOVE_MAT = 1.5;

function allowedCameraPositions(): Vector3[] {
  const positions: Vector3[] = [];
  const polarSteps = 12;
  const azimuthSteps = 36;

  for (const radius of [VIEW.distance.min, VIEW.distance.max]) {
    for (let i = 0; i <= polarSteps; i++) {
      const polar =
        VIEW.polar.min + ((VIEW.polar.max - VIEW.polar.min) * i) / polarSteps;

      for (let j = 0; j < azimuthSteps; j++) {
        const azimuth = (Math.PI * 2 * j) / azimuthSteps;

        positions.push(
          new Vector3().setFromSpherical(new Spherical(radius, polar, azimuth)),
        );
      }
    }
  }

  return positions;
}

describe("VIEW", () => {
  it("카메라는 어디로 돌려도 로프 안쪽에 있다", () => {
    const limit = GYM.ropes.half - GYM.ropes.radius - ROPE_MARGIN;

    for (const position of allowedCameraPositions()) {
      expect(
        Math.max(Math.abs(position.x), Math.abs(position.z)),
      ).toBeLessThanOrEqual(limit);
    }
  });

  it("카메라는 매트에서 충분히 높이 있다", () => {
    for (const position of allowedCameraPositions()) {
      expect(position.y - GYM.mat.y).toBeGreaterThanOrEqual(EYE_ABOVE_MAT);
    }
  });

  it("처음 카메라 위치는 허용 범위 안이라 첫 프레임에 튀지 않는다", () => {
    const home = new Spherical().setFromVector3(new Vector3(...VIEW.home));

    expect(home.radius).toBeGreaterThanOrEqual(VIEW.distance.min);
    expect(home.radius).toBeLessThanOrEqual(VIEW.distance.max);
    expect(home.phi).toBeGreaterThanOrEqual(VIEW.polar.min);
    expect(home.phi).toBeLessThanOrEqual(VIEW.polar.max);
  });
});
