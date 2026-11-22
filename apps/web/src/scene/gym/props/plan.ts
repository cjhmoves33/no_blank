import type { Point } from "../building/slabs";
import { GYM } from "../measurements";

/** 소품을 그릴 자리입니다. 소품은 기준점을 원점에 두고 그리며, 이 값만큼 옮기고 돌립니다. */
export interface Mount {
  readonly position: Point;
  /** y 축 둘레의 회전(라디안)입니다. */
  readonly turn: number;
}

/** 벽에 거는 소품의 자리입니다. 벽이 움직이면 함께 움직입니다. */
export interface WallSpot {
  readonly wall: "back" | "front" | "left" | "right";
  /** 벽을 마주 보고 섰을 때, 벽 가운데에서 오른쪽으로 잰 거리입니다. */
  readonly along: number;
  /** 바닥에서 기준점까지의 높이입니다. */
  readonly height: number;
}

/** 천장에 다는 소품의 자리입니다. 천장이 높아져도 소품은 그대로이고 걸이만 길어집니다. */
export interface CeilingSpot {
  /** 매달린 지점입니다. 소품은 이 지점을 원점에 두고 그립니다. */
  readonly at: Point;
}

/** 체육관 안 소품의 자리입니다. 좌표는 건물 좌표(미터)입니다. */
export const PLAN = {
  wallClock: { wall: "back", along: -2.25, height: 3.2 },
  heavyBags: { at: [-6.1, 4.8, -1.25] },
} as const satisfies { wallClock: WallSpot; heavyBags: CeilingSpot };

/**
 * 벽에 거는 소품을 그 벽의 안쪽 면에 붙입니다.
 * - 소품은 뒷면 가운데를 원점에 두고, +z 가 방 안쪽, +x 가 마주 본 사람의 오른쪽, +y 가 위쪽이 되게 그립니다.
 * - position 은 벽 안쪽 면 위의 기준점이고, turn 은 소품의 +z 를 방 안쪽으로 돌리는 y 축 회전입니다.
 */
export function wallMount({ wall, along, height }: WallSpot): Mount {
  const { halfX, halfZ } = GYM.building;

  switch (wall) {
    case "back":
      return { position: [along, height, -halfZ], turn: 0 };
    case "front":
      return { position: [-along, height, halfZ], turn: Math.PI };
    case "left":
      return { position: [-halfX, height, -along], turn: Math.PI / 2 };
    case "right":
      return { position: [halfX, height, along], turn: -Math.PI / 2 };
  }
}

export function ceilingMount(
  spot: CeilingSpot,
): Mount & { readonly toCeiling: number } {
  return {
    position: spot.at,
    turn: 0,
    toCeiling: GYM.building.ceilingY - spot.at[1],
  };
}
