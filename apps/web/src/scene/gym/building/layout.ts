import { GYM } from "../measurements";
import type { Box, Point } from "./slabs";

const { halfX, halfZ, ceilingY, wall } = GYM.building;
const { spans, sillY, headY, mullions, transoms } = GYM.windows;
const RIGHT_OUTER_X = halfX + wall;

export function brickWalls(): Box[] {
  return [
    {
      min: [-halfX - wall, 0, -halfZ - wall],
      max: [halfX + wall, ceilingY, -halfZ],
    },
    {
      min: [-halfX - wall, 0, halfZ],
      max: [halfX + wall, ceilingY, halfZ + wall],
    },
    { min: [-halfX - wall, 0, -halfZ], max: [-halfX, ceilingY, halfZ] },
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
    { min: [halfX, 0, -halfZ], max: [RIGHT_OUTER_X, sillY, halfZ] },
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

const PAINTED_WALL_BAND = { top: 1.2, thickness: 0.02 } as const;

export function paintedWallBand(): Box[] {
  const { top, thickness } = PAINTED_WALL_BAND;

  return [
    {
      min: [-halfX, 0, -halfZ],
      max: [halfX, top, -halfZ + thickness],
    },
    { min: [-halfX, 0, halfZ - thickness], max: [halfX, top, halfZ] },
    {
      min: [-halfX, 0, -halfZ],
      max: [-halfX + thickness, top, halfZ],
    },
    { min: [halfX - thickness, 0, -halfZ], max: [halfX, top, halfZ] },
  ];
}

const BAR = { half: 0.025, inset: [0.07, 0.13] } as const;
const CEILING_BEAMS = { at: [-4, -1.5, 1, 3.5], halfWidth: 0.075, depth: 0.4 };

export function steelwork(): Box[] {
  const barX: readonly [number, number] = [
    RIGHT_OUTER_X - BAR.inset[1],
    RIGHT_OUTER_X - BAR.inset[0],
  ];
  const bars = spans.flatMap(([start, end]) => [
    ...evenlySpacedInside(start, end, mullions).map((z): Box => ({
      min: [barX[0], sillY, z - BAR.half],
      max: [barX[1], headY, z + BAR.half],
    })),
    ...evenlySpacedInside(sillY, headY, transoms).map((y): Box => ({
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

function evenlySpacedInside(
  start: number,
  end: number,
  count: number,
): number[] {
  return Array.from(
    { length: count },
    (_, i) => start + ((end - start) * (i + 1)) / (count + 1),
  );
}

export function floor(): Box[] {
  return [{ min: [-halfX, -0.1, -halfZ], max: [halfX, 0, halfZ] }];
}

export interface Pane {
  readonly center: Point;
  readonly width: number;
  readonly height: number;
}

export function glassPanes(): Pane[] {
  return spans.map(([start, end]) => ({
    center: [RIGHT_OUTER_X - 0.025, (sillY + headY) / 2, (start + end) / 2],
    width: end - start,
    height: headY - sillY,
  }));
}
