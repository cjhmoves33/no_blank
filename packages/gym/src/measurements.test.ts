import { Spherical, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { GYM, RING_VIEW } from "./measurements";

const EYE_ABOVE_MAT = 0.75;
const TARGET = new Vector3(...RING_VIEW.target);

function allowedCameraPositions(): Vector3[] {
  const positions: Vector3[] = [];
  const polarSteps = 12;
  const azimuthSteps = 36;

  for (const radius of [RING_VIEW.distance.min, RING_VIEW.distance.max]) {
    for (let i = 0; i <= polarSteps; i++) {
      const polar =
        RING_VIEW.polar.min +
        ((RING_VIEW.polar.max - RING_VIEW.polar.min) * i) / polarSteps;

      for (let j = 0; j < azimuthSteps; j++) {
        const azimuth = (Math.PI * 2 * j) / azimuthSteps;

        positions.push(
          new Vector3()
            .setFromSpherical(new Spherical(radius, polar, azimuth))
            .add(TARGET),
        );
      }
    }
  }

  return positions;
}

describe("RING_VIEW", () => {
  it("카메라는 어디로 돌려도 로프 안쪽에 있고, near 면도 로프에 닿지 않는다", () => {
    const limit = GYM.ropes.half - GYM.ropes.radius - RING_VIEW.near;

    for (const position of allowedCameraPositions()) {
      expect(
        Math.max(Math.abs(position.x), Math.abs(position.z)),
      ).toBeLessThanOrEqual(limit);
    }
  });

  it("카메라는 매트에서 충분히 높아서, 화면에 매트 무늬만 보이지는 않는다", () => {
    for (const position of allowedCameraPositions()) {
      expect(position.y - GYM.mat.y).toBeGreaterThanOrEqual(EYE_ABOVE_MAT);
    }
  });

  it("처음 카메라 위치는 허용 범위 안이라 첫 프레임에 튀지 않는다", () => {
    const home = new Spherical().setFromVector3(
      new Vector3(...RING_VIEW.home).sub(TARGET),
    );

    expect(home.radius).toBeGreaterThanOrEqual(RING_VIEW.distance.min);
    expect(home.radius).toBeLessThanOrEqual(RING_VIEW.distance.max);
    expect(home.phi).toBeGreaterThanOrEqual(RING_VIEW.polar.min);
    expect(home.phi).toBeLessThanOrEqual(RING_VIEW.polar.max);
  });
});
