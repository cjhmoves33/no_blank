import { Spherical, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  LATE_AFTERNOON,
  shapeLightPosition,
  sunDirection,
} from "./late-afternoon";
import { GYM, VIEW } from "./measurements";

// 해 쪽으로 쏜 광선이 오른쪽 벽의 안쪽 면과 바깥 면을 모두 창으로 지나야 햇빛을 받는다고 봅니다.
// 창살은 무시하므로 "그늘에 있다"는 판정은 실제보다 엄격합니다.
function isInWindow(y: number, z: number): boolean {
  const { spans, sillY, headY } = GYM.windows;

  return (
    y > sillY && y < headY && spans.some(([start, end]) => z > start && z < end)
  );
}

function isSunlit(point: Vector3): boolean {
  const towardSun = sunDirection().negate();
  const wallFaces = [GYM.room.halfX, GYM.room.halfX + GYM.room.wall];

  return wallFaces.every((faceX) => {
    const hit = point
      .clone()
      .addScaledVector(towardSun, (faceX - point.x) / towardSun.x);

    return isInWindow(hit.y, hit.z);
  });
}

// 피보나치 나선으로 구 표면을 고르게 찍습니다.
function pointsOnSphere(radius: number, count: number): Vector3[] {
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const turn = i * Math.PI * (3 - Math.sqrt(5));

    return new Vector3(
      Math.cos(turn) * ring,
      y,
      Math.sin(turn) * ring,
    ).multiplyScalar(radius);
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

// 로프는 가운데가 sag 만큼 처지므로, 처진 높이의 직선으로 잡아 빛에 더 가깝게 봅니다.
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
  return light.clone().sub(point).dot(point) > 0;
}

function cameraPositions(): Vector3[] {
  const steps = 24;

  return [VIEW.polar.min, VIEW.polar.max].flatMap((polar) =>
    Array.from({ length: steps }, (_, i) =>
      new Vector3().setFromSpherical(
        new Spherical(VIEW.distance.max, polar, (Math.PI * 2 * i) / steps),
      ),
    ),
  );
}

describe("LATE_AFTERNOON", () => {
  it("링 가운데의 도형에는 햇빛이 곧바로 닿지 않는다", () => {
    const lit = pointsOnSphere(GYM.subject.radius, 400).filter(isSunlit);

    expect(lit).toEqual([]);
  });

  it("햇빛이 링 안 매트에 창 모양으로 떨어진다", () => {
    const points = matPointsInsideRopes();
    const litShare = points.filter(isSunlit).length / points.length;

    expect(litShare).toBeGreaterThan(0.2);
  });

  it("도형 조명은 카메라가 어디로 돌아도 도형의 보이는 쪽을 고르게 밝힌다", () => {
    const { reach } = LATE_AFTERNOON.shapeLight;

    for (const camera of cameraPositions()) {
      const light = new Vector3(...shapeLightPosition(camera));
      const nearestToCamera = camera.clone().setLength(GYM.subject.radius);
      const facing = pointsOnSphere(GYM.subject.radius, 400).filter((point) =>
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

  it("도형 조명은 카메라가 어디로 돌아도 매트와 로프에 닿지 않는다", () => {
    const { reach } = LATE_AFTERNOON.shapeLight;

    for (const camera of cameraPositions()) {
      const light = new Vector3(...shapeLightPosition(camera));
      const nearestRope = Math.min(
        ...ropeSegments().map((segment) => distanceToSegment(light, segment)),
      );

      expect(light.y - GYM.mat.y).toBeGreaterThan(reach);
      expect(nearestRope).toBeGreaterThan(reach);
    }
  });
});
