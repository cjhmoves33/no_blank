import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import type { Box } from "../building/slabs";
import { GYM } from "../measurements";
import { RING_SIZE } from "../ring/ring";
import { WRECKING_BALL_SIZE } from "../wrecking-ball/wrecking-ball";
import { HEAVY_BAGS_SIZE } from "./heavy-bags";
import {
  ceilingMount,
  type Mount,
  PLAN,
  wallMount,
  type WallSpot,
} from "./plan";
import { WALL_CLOCK_SIZE } from "./wall-clock";

const UP = new Vector3(0, 1, 0);
const AXES = [0, 1, 2] as const;
// 벽에 붙이려고 돌린 좌표에는 1e-16 정도의 부동소수 오차가 남습니다.
const EPSILON = 1e-9;
const { halfX, halfZ, ceilingY } = GYM.building;

const INSIDE_BUILDING: Box = {
  min: [-halfX, 0, -halfZ],
  max: [halfX, ceilingY, halfZ],
};

function wreckingBallSpace(): Box {
  return placed(WRECKING_BALL_SIZE, {
    position: GYM.wreckingBall.restCenter,
    turn: 0,
  });
}

function placedProps() {
  return {
    wallClock: placed(WALL_CLOCK_SIZE, wallMount(PLAN.wallClock)),
    heavyBags: placed(HEAVY_BAGS_SIZE, ceilingMount(PLAN.heavyBags)),
  } satisfies Record<keyof typeof PLAN, Box>;
}

function placed(size: Box, { position, turn }: Mount): Box {
  const corners = [size.min[0], size.max[0]].flatMap((x) =>
    [size.min[1], size.max[1]].flatMap((y) =>
      [size.min[2], size.max[2]].map((z) =>
        new Vector3(x, y, z)
          .applyAxisAngle(UP, turn)
          .add(new Vector3(...position)),
      ),
    ),
  );
  const along = (axis: "x" | "y" | "z") =>
    corners.map((corner) => corner[axis]);

  return {
    min: [
      Math.min(...along("x")),
      Math.min(...along("y")),
      Math.min(...along("z")),
    ],
    max: [
      Math.max(...along("x")),
      Math.max(...along("y")),
      Math.max(...along("z")),
    ],
  };
}

function isInside(inner: Box, outer: Box): boolean {
  return AXES.every(
    (axis) =>
      inner.min[axis] >= outer.min[axis] - EPSILON &&
      inner.max[axis] <= outer.max[axis] + EPSILON,
  );
}

function overlaps(a: Box, b: Box): boolean {
  return AXES.every(
    (axis) =>
      a.min[axis] < b.max[axis] - EPSILON &&
      b.min[axis] < a.max[axis] - EPSILON,
  );
}

function expectClose(
  actual: readonly number[],
  expected: readonly number[],
): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, i) => {
    expect(value).toBeCloseTo(expected[i] ?? Number.NaN, 9);
  });
}

describe("PLAN", () => {
  it("소품은 모두 건물 안에 있다", () => {
    for (const [name, box] of Object.entries(placedProps())) {
      expect(isInside(box, INSIDE_BUILDING), name).toBe(true);
    }
  });

  it("소품끼리 겹치지 않는다", () => {
    const props = Object.entries(placedProps());

    for (const [i, [name, box]] of props.entries()) {
      for (const [other, otherBox] of props.slice(i + 1)) {
        expect(overlaps(box, otherBox), `${name} / ${other}`).toBe(false);
      }
    }
  });

  it("소품은 링과 레킹볼의 자리를 비워 둔다", () => {
    for (const [name, box] of Object.entries(placedProps())) {
      expect(overlaps(box, RING_SIZE), `${name} / ring`).toBe(false);
      expect(
        overlaps(box, wreckingBallSpace()),
        `${name} / wrecking ball`,
      ).toBe(false);
    }
  });
});

const WALLS = [
  { wall: "back", face: [0, 0, -halfZ], inward: [0, 0, 1] },
  { wall: "front", face: [0, 0, halfZ], inward: [0, 0, -1] },
  { wall: "left", face: [-halfX, 0, 0], inward: [1, 0, 0] },
  { wall: "right", face: [halfX, 0, 0], inward: [-1, 0, 0] },
] as const;

describe.each(WALLS)("wallMount: $wall 벽", ({ wall, face, inward }) => {
  const spot = (along: number): WallSpot => ({ wall, along, height: 2 });

  it("기준점은 벽 가운데의 안쪽 면에, 바닥에서 height 만큼 위에 놓인다", () => {
    expectClose(wallMount(spot(0)).position, [face[0], 2, face[2]]);
  });

  it("소품의 앞(+z)은 방 안쪽을 본다", () => {
    const front = new Vector3(0, 0, 1).applyAxisAngle(
      UP,
      wallMount(spot(0)).turn,
    );

    expectClose(front.toArray(), inward);
  });

  it("along 은 벽을 마주 본 사람의 오른쪽으로 잰다", () => {
    const start = new Vector3(...wallMount(spot(0)).position);
    const moved = new Vector3(...wallMount(spot(1.5)).position);
    const right = new Vector3(...inward).negate().cross(UP);

    expectClose(
      moved.sub(start).toArray(),
      right.multiplyScalar(1.5).toArray(),
    );
  });
});
