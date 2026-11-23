import { Quaternion, Vector3 } from "three";

export const CHAIN_LINK = {
  radius: 0.011,
  wire: 0.0035,
  stretch: 1.6,
} as const;

// 팽팽한 사슬에서는 한 고리의 끝 철사가 다음 고리의 끝 철사에 걸리므로, 고리 중심 사이는 늘린 반지름의 두 배입니다.
export const LINK_PITCH = 2 * CHAIN_LINK.stretch * CHAIN_LINK.radius;

export interface LinkPose {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
}

const UP = new Vector3(0, 1, 0);
const QUARTER_TURN = new Quaternion().setFromAxisAngle(UP, Math.PI / 2);
const SAMPLES = 64;

export function linkCount(length: number): number {
  return Math.max(1, Math.round(length / LINK_PITCH));
}

export function linksAlong(
  path: (t: number) => Vector3,
  count: number,
): LinkPose[] {
  const points = Array.from({ length: SAMPLES + 1 }, (_, i) =>
    path(i / SAMPLES),
  );
  const reached = distancesAlong(points);
  const total = reached.at(-1) ?? 0;

  return Array.from({ length: count }, (_, i) => {
    const { position, tangent } = pointAt(
      points,
      reached,
      ((i + 0.5) / count) * total,
    );
    const quaternion = new Quaternion().setFromUnitVectors(UP, tangent);

    return {
      position,
      quaternion: i % 2 === 0 ? quaternion : quaternion.multiply(QUARTER_TURN),
    };
  });
}

function distancesAlong(points: readonly Vector3[]): number[] {
  return points.reduce<number[]>((reached, point, i) => {
    const previous = points[i - 1];

    reached.push(
      previous ? (reached.at(-1) ?? 0) + previous.distanceTo(point) : 0,
    );

    return reached;
  }, []);
}

function pointAt(
  points: readonly Vector3[],
  reached: readonly number[],
  distance: number,
): { readonly position: Vector3; readonly tangent: Vector3 } {
  const segment = Math.max(
    0,
    reached.findIndex((value) => value >= distance) - 1,
  );
  const from = points[segment] ?? new Vector3();
  const to = points[segment + 1] ?? from;
  const start = reached[segment] ?? 0;
  const length = (reached[segment + 1] ?? start) - start;

  return {
    position: from
      .clone()
      .lerp(to, length > 0 ? (distance - start) / length : 0),
    tangent: to.clone().sub(from).normalize(),
  };
}
