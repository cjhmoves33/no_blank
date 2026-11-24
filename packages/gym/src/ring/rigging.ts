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

/** along 은 코너에서 다음 코너까지의 비율(0~1)이고, height 는 매트에서 잰 로프의 높이입니다. */
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

/** 아래 로프부터 위 로프까지의 순서입니다. */
const LEVELS = [0, 1, 2, 3] as const;

export const ROPES = SIDES.flatMap((side, sideIndex) =>
  LEVELS.map((level) => {
    const height = ropes.heights[level];

    return {
      key: `${sideIndex}:${height}`,
      level,
      curve: new CatmullRomCurve3(
        Array.from({ length: 9 }, (_, i) => ropePointAt(side, i / 8, height)),
      ),
    };
  }),
);

const LOWEST_ROPE = ropes.heights[0];
const HIGHEST_ROPE = ropes.heights[3];
const TIE_MIDDLE = (HIGHEST_ROPE + LOWEST_ROPE) / 2;

export interface Tie {
  readonly key: string;
  readonly side: Side;
  readonly along: number;
  readonly position: Vector3;
  /** 로프 방향이 끈의 +z 가 되게 하는 y 축 회전입니다. */
  readonly turn: number;
  /** position 에서 잰, 로프마다 끈이 감기는 자리입니다. 로프 순서(아래에서 위)와 같습니다. */
  readonly wraps: readonly Vector3[];
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
      wraps: ropes.heights.map(
        (height) => new Vector3(0, height - TIE_MIDDLE, 0),
      ),
    };
  }),
);

export const TIE_HEIGHT = HIGHEST_ROPE - LOWEST_ROPE + 0.06;

/** 매트에서 잰 코너 패드의 아래와 위입니다. 로프 네 줄이 모두 패드에 닿습니다. */
export const PAD = {
  bottom: LOWEST_ROPE - 0.125,
  top: HIGHEST_ROPE + 0.125,
};

/** 매트 위의 점(x, z)이 매트 그림의 어느 픽셀에 그려지는지 돌려줍니다. 그림의 위쪽이 -z 입니다. */
export function matPixel(
  x: number,
  z: number,
  { width, height }: { readonly width: number; readonly height: number },
): [x: number, y: number] {
  const span = mat.half * 2;

  return [((x + mat.half) / span) * width, ((z + mat.half) / span) * height];
}
