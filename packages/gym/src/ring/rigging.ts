import { CatmullRomCurve3, Vector3 } from "three";

import { GYM } from "../measurements";

const { mat, ropes } = GYM;

export const CORNERS = [
  { x: -1, z: -1, pad: "#33435e" },
  { x: 1, z: -1, pad: "#d6cab2" },
  { x: 1, z: 1, pad: "#7f2b24" },
  { x: -1, z: 1, pad: "#d6cab2" },
] as const;

export interface Side {
  readonly from: Vector3;
  readonly to: Vector3;
}

export const SIDES: readonly Side[] = CORNERS.map((corner, index) => {
  const next = CORNERS[(index + 1) % CORNERS.length] ?? corner;

  return {
    from: new Vector3(corner.x * ropes.half, 0, corner.z * ropes.half),
    to: new Vector3(next.x * ropes.half, 0, next.z * ropes.half),
  };
});

function sagAt(along: number): number {
  return ropes.sag * 4 * along * (1 - along);
}

export function ropePointAt(
  { from, to }: Side,
  along: number,
  height: number,
): Vector3 {
  return from
    .clone()
    .lerp(to, along)
    .setY(mat.y + height - sagAt(along));
}

const LEVELS = [0, 1, 2, 3] as const;

type RopeLevel = (typeof LEVELS)[number];

export interface RopeLine {
  readonly level: RopeLevel;
  readonly curve: CatmullRomCurve3;
}

export const ROPE_LINES: readonly RopeLine[] = SIDES.flatMap((side) =>
  LEVELS.map((level) => ({
    level,
    curve: new CatmullRomCurve3(
      Array.from({ length: 9 }, (_, i) =>
        ropePointAt(side, i / 8, ropes.heights[level]),
      ),
    ),
  })),
);

const LOWEST_ROPE = ropes.heights[0];
const HIGHEST_ROPE = ropes.heights[3];
const TIE_MIDDLE = (HIGHEST_ROPE + LOWEST_ROPE) / 2;

export interface Tie {
  readonly key: string;
  readonly side: Side;
  readonly along: number;
  readonly position: Vector3;
  readonly turn: number;
  readonly wrapOffsets: readonly Vector3[];
}

export const TIES: readonly Tie[] = SIDES.flatMap((side, sideIndex) =>
  [1 / 3, 2 / 3].map((along) => {
    const direction = side.to.clone().sub(side.from);

    return {
      key: `${sideIndex}:${along}`,
      side,
      along,
      position: ropePointAt(side, along, TIE_MIDDLE),
      turn: Math.atan2(direction.x, direction.z),
      wrapOffsets: ropes.heights.map(
        (height) => new Vector3(0, height - TIE_MIDDLE, 0),
      ),
    };
  }),
);

export const TIE_HEIGHT = HIGHEST_ROPE - LOWEST_ROPE + 0.06;

export const PAD = {
  bottom: LOWEST_ROPE - 0.125,
  top: HIGHEST_ROPE + 0.125,
  width: 0.31,
  depth: 0.17,
  radius: 0.075,
  segments: 6,
};

// RoundedBoxGeometry 는 한 면의 텍스처 높이를 아래 모서리 곡면의 절반, 평평한 부분, 위 모서리 곡면의 절반에 길이대로 나눠 줍니다.
export function padTextureV(height: number): number {
  const arc = (Math.PI * PAD.radius) / 2;
  const flat = PAD.top - PAD.bottom - PAD.radius * 2;

  return (arc / 2 + height - PAD.bottom - PAD.radius) / (arc + flat);
}

export function matPixel(
  x: number,
  z: number,
  { width, height }: { readonly width: number; readonly height: number },
): [x: number, y: number] {
  const span = mat.half * 2;

  return [((x + mat.half) / span) * width, ((z + mat.half) / span) * height];
}
