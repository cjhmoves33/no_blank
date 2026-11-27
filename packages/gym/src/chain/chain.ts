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
const DOWN = new Vector3(0, -1, 0);
const QUARTER_TURN = new Quaternion().setFromAxisAngle(UP, Math.PI / 2);
const SAMPLES = 64;

export function turnedRing({ quaternion }: LinkPose): Quaternion {
  return quaternion.clone().multiply(QUARTER_TURN);
}

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
  const along = Array.from({ length: count }, (_, i) =>
    pointAt(points, reached, ((i + 0.5) / count) * total),
  );
  const frames = carriedAlong(along.map(({ tangent }) => tangent));

  return along.map(({ position }, i) => {
    const frame = frames[i] ?? new Quaternion();

    return {
      position,
      quaternion: i % 2 === 0 ? frame : frame.clone().multiply(QUARTER_TURN),
    };
  });
}

// 고리마다 따로 방향을 정하면, 사슬이 거의 똑바로 아래를 볼 때 고리가 제멋대로 돌아갑니다. 첫 고리의 방향을 다음 고리로 조금씩 돌려 넘깁니다.
function carriedAlong(tangents: readonly Vector3[]): Quaternion[] {
  return tangents.reduce<Quaternion[]>((frames, tangent, i) => {
    const before = frames[i - 1];
    const previousTangent = tangents[i - 1];

    frames.push(
      before && previousTangent
        ? new Quaternion()
            .setFromUnitVectors(previousTangent, tangent)
            .multiply(before)
        : new Quaternion().setFromUnitVectors(
            tangent.y < 0 ? DOWN : UP,
            tangent,
          ),
    );

    return frames;
  }, []);
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
