import { GYM } from "./measurements";
import type { Box, Point } from "./slabs";

const { halfX, halfZ, ceilingY, wall } = GYM.room;
const { spans, sillY, headY, mullions, transoms } = GYM.windows;
const FLOOR_Y = GYM.floorY;
const RIGHT_OUTER_X = halfX + wall;

/** 방의 네 모서리는 앞뒤 벽이 덮습니다. */
export function brickWalls(): Box[] {
  return [
    {
      min: [-halfX - wall, FLOOR_Y, -halfZ - wall],
      max: [halfX + wall, ceilingY, -halfZ],
    },
    {
      min: [-halfX - wall, FLOOR_Y, halfZ],
      max: [halfX + wall, ceilingY, halfZ + wall],
    },
    { min: [-halfX - wall, FLOOR_Y, -halfZ], max: [-halfX, ceilingY, halfZ] },
    ...rightWall(),
  ];
}

function rightWall(): Box[] {
  const pier = (fromZ: number, toZ: number): Box => ({
    min: [halfX, sillY, fromZ],
    max: [RIGHT_OUTER_X, headY, toZ],
  });
  const piers: Box[] = [];
  let pierStart = -halfZ;

  for (const [start, end] of spans) {
    piers.push(pier(pierStart, start));
    pierStart = end;
  }

  piers.push(pier(pierStart, halfZ));

  return [
    { min: [halfX, FLOOR_Y, -halfZ], max: [RIGHT_OUTER_X, sillY, halfZ] },
    { min: [halfX, headY, -halfZ], max: [RIGHT_OUTER_X, ceilingY, halfZ] },
    ...piers,
  ];
}

export function ceiling(): Box[] {
  return [
    {
      min: [-halfX - wall, ceilingY, -halfZ - wall],
      max: [halfX + wall, ceilingY + wall, halfZ + wall],
    },
  ];
}

const DADO = { top: FLOOR_Y + 2.4, thickness: 0.04 } as const;

/** 벽 아래쪽에 칠한 띠입니다. */
export function dado(): Box[] {
  const { top, thickness } = DADO;

  return [
    {
      min: [-halfX, FLOOR_Y, -halfZ],
      max: [halfX, top, -halfZ + thickness],
    },
    { min: [-halfX, FLOOR_Y, halfZ - thickness], max: [halfX, top, halfZ] },
    {
      min: [-halfX, FLOOR_Y, -halfZ],
      max: [-halfX + thickness, top, halfZ],
    },
    { min: [halfX - thickness, FLOOR_Y, -halfZ], max: [halfX, top, halfZ] },
  ];
}

const BAR = { half: 0.05, inset: [0.14, 0.26] } as const;
const CEILING_BEAMS = { at: [-8, -3, 2, 7], halfWidth: 0.15, depth: 0.8 };

export function steelwork(): Box[] {
  const barX: readonly [number, number] = [
    RIGHT_OUTER_X - BAR.inset[1],
    RIGHT_OUTER_X - BAR.inset[0],
  ];
  const bars = spans.flatMap(([start, end]) => [
    ...evenly(start, end, mullions).map((z): Box => ({
      min: [barX[0], sillY, z - BAR.half],
      max: [barX[1], headY, z + BAR.half],
    })),
    ...evenly(sillY, headY, transoms).map((y): Box => ({
      min: [barX[0], y - BAR.half, start],
      max: [barX[1], y + BAR.half, end],
    })),
  ]);
  const beams = CEILING_BEAMS.at.map((z): Box => ({
    min: [-halfX, ceilingY - CEILING_BEAMS.depth, z - CEILING_BEAMS.halfWidth],
    max: [halfX, ceilingY, z + CEILING_BEAMS.halfWidth],
  }));

  return [...bars, ...beams];
}

/** start 와 end 사이를 count + 1 등분하는 안쪽 점들입니다. */
function evenly(start: number, end: number, count: number): number[] {
  return Array.from(
    { length: count },
    (_, i) => start + ((end - start) * (i + 1)) / (count + 1),
  );
}

export function floor(): Box[] {
  return [
    { min: [-halfX, FLOOR_Y - 0.2, -halfZ], max: [halfX, FLOOR_Y, halfZ] },
  ];
}

export interface Pane {
  readonly center: Point;
  readonly width: number;
  readonly height: number;
}

export function glassPanes(): Pane[] {
  return spans.map(([start, end]) => ({
    center: [RIGHT_OUTER_X - 0.05, (sillY + headY) / 2, (start + end) / 2],
    width: end - start,
    height: headY - sillY,
  }));
}
