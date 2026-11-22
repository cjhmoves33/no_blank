import { OrthographicCamera, Spherical, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { GYM, RING_VIEW } from "../measurements";
import {
  ballLightPosition,
  hazeShaftFrames,
  LATE_AFTERNOON,
  sunlightTravel,
  sunPosition,
  sunTarget,
} from "./late-afternoon";

const BALL = new Vector3(...GYM.wreckingBall.restCenter);

function isInWindow(y: number, z: number): boolean {
  const { spans, sillY, headY } = GYM.windows;

  return (
    y > sillY && y < headY && spans.some(([start, end]) => z > start && z < end)
  );
}

function passesWindowOpenings(point: Vector3): boolean {
  const towardSun = sunlightTravel().negate();
  const wallFaces = [
    GYM.building.halfX,
    GYM.building.halfX + GYM.building.wall,
  ];

  return wallFaces.every((faceX) => {
    const hit = point
      .clone()
      .addScaledVector(towardSun, (faceX - point.x) / towardSun.x);

    return isInWindow(hit.y, hit.z);
  });
}

function pointsOnBall(count: number): Vector3[] {
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const turn = i * Math.PI * (3 - Math.sqrt(5));

    return new Vector3(Math.cos(turn) * ring, y, Math.sin(turn) * ring)
      .multiplyScalar(GYM.wreckingBall.radius)
      .add(BALL);
  });
}

function matPointsInsideRopes(): Vector3[] {
  const points: Vector3[] = [];
  const half = GYM.ropes.half;
  const steps = 26;

  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      points.push(
        new Vector3(
          -half + (2 * half * i) / steps,
          GYM.mat.y,
          -half + (2 * half * j) / steps,
        ),
      );
    }
  }

  return points;
}

type Segment = readonly [Vector3, Vector3];

function distanceToSegment(point: Vector3, [start, end]: Segment): number {
  const along = end.clone().sub(start);
  const t = Math.min(
    Math.max(point.clone().sub(start).dot(along) / along.lengthSq(), 0),
    1,
  );

  return start.clone().addScaledVector(along, t).distanceTo(point);
}

function ropeSegments(): Segment[] {
  const half = GYM.ropes.half;
  const corners = [
    new Vector3(-half, 0, -half),
    new Vector3(half, 0, -half),
    new Vector3(half, 0, half),
    new Vector3(-half, 0, half),
  ];

  return corners.flatMap((corner, side) => {
    const next = corners[(side + 1) % corners.length] ?? corner;

    return GYM.ropes.heights.map((height): Segment => {
      const y = GYM.mat.y + height - GYM.ropes.sag;

      return [corner.clone().setY(y), next.clone().setY(y)];
    });
  });
}

function isFacing(point: Vector3, light: Vector3): boolean {
  const outward = point.clone().sub(BALL);

  return light.clone().sub(point).dot(outward) > 0;
}

function cameraPositions(): Vector3[] {
  const steps = 24;

  return [RING_VIEW.polar.min, RING_VIEW.polar.max].flatMap((polar) =>
    Array.from({ length: steps }, (_, i) =>
      new Vector3()
        .setFromSpherical(
          new Spherical(
            RING_VIEW.distance.max,
            polar,
            (Math.PI * 2 * i) / steps,
          ),
        )
        .add(BALL),
    ),
  );
}

function buildingCorners(): Vector3[] {
  const { halfX, halfZ, ceilingY, wall } = GYM.building;
  const outer = { x: halfX + wall, z: halfZ + wall };

  return [-outer.x, outer.x].flatMap((x) =>
    [-0.1, ceilingY + wall].flatMap((y) =>
      [-outer.z, outer.z].map((z) => new Vector3(x, y, z)),
    ),
  );
}

describe("LATE_AFTERNOON", () => {
  it("그림자를 계산하는 범위가 건물 전체를 덮는다", () => {
    const bounds = LATE_AFTERNOON.sun.shadow.camera;
    // three 의 DirectionalLightShadow 가 그림자 카메라를 놓는 방식과 같습니다.
    const shadowCamera = new OrthographicCamera(
      bounds.left,
      bounds.right,
      bounds.top,
      bounds.bottom,
      bounds.near,
      bounds.far,
    );

    shadowCamera.position.set(...sunPosition());
    shadowCamera.lookAt(sunTarget());
    shadowCamera.updateMatrixWorld();

    for (const corner of buildingCorners()) {
      const seen = corner.applyMatrix4(shadowCamera.matrixWorldInverse);

      expect(seen.x).toBeGreaterThanOrEqual(bounds.left);
      expect(seen.x).toBeLessThanOrEqual(bounds.right);
      expect(seen.y).toBeGreaterThanOrEqual(bounds.bottom);
      expect(seen.y).toBeLessThanOrEqual(bounds.top);
      expect(-seen.z).toBeGreaterThanOrEqual(bounds.near);
      expect(-seen.z).toBeLessThanOrEqual(bounds.far);
    }
  });

  it("링 가운데의 레킹볼에는 햇빛이 곧바로 닿지 않는다", () => {
    const lit = pointsOnBall(400).filter(passesWindowOpenings);

    expect(lit).toEqual([]);
  });

  it("햇빛이 링 안 매트에 창 모양으로 떨어진다", () => {
    const points = matPointsInsideRopes();
    const litShare = points.filter(passesWindowOpenings).length / points.length;

    expect(litShare).toBeGreaterThan(0.2);
  });

  it("레킹볼을 비추는 빛은 카메라가 어디로 돌아도 공의 보이는 쪽을 고르게 밝힌다", () => {
    const { reach } = LATE_AFTERNOON.ballLight;

    for (const camera of cameraPositions()) {
      const light = new Vector3(...ballLightPosition(camera));
      const nearestToCamera = camera
        .clone()
        .sub(BALL)
        .setLength(GYM.wreckingBall.radius)
        .add(BALL);
      const facing = pointsOnBall(400).filter((point) =>
        isFacing(point, light),
      );
      const farthestFacing = Math.max(
        ...facing.map((point) => point.distanceTo(light)),
      );

      expect(isFacing(nearestToCamera, light)).toBe(true);
      // three 의 거리 감쇠는 (1 - (d / reach)^4)^2 이라 reach 의 70% 안이면 세기가 절반 넘게 남습니다.
      expect(farthestFacing).toBeLessThan(reach * 0.7);
    }
  });

  it("레킹볼을 비추는 빛은 카메라가 어디로 돌아도 매트와 로프에 닿지 않는다", () => {
    const { reach } = LATE_AFTERNOON.ballLight;

    for (const camera of cameraPositions()) {
      const light = new Vector3(...ballLightPosition(camera));
      const nearestRope = Math.min(
        ...ropeSegments().map((segment) => distanceToSegment(light, segment)),
      );

      expect(light.y - GYM.mat.y).toBeGreaterThan(reach);
      expect(nearestRope).toBeGreaterThan(reach);
    }
  });

  it("빛기둥은 창 바깥면의 창 자리에서 시작해 바닥에서 끝난다", () => {
    const frames = hazeShaftFrames();

    expect(frames).toHaveLength(GYM.windows.spans.length);

    for (const frame of frames) {
      const start = new Vector3(0, 0, -0.5).applyMatrix4(frame);
      const end = new Vector3(0, 0, 0.5).applyMatrix4(frame);

      expect(start.x).toBeCloseTo(GYM.building.halfX + GYM.building.wall);
      expect(isInWindow(start.y, start.z)).toBe(true);
      expect(end.y).toBeCloseTo(0);
    }
  });
});
