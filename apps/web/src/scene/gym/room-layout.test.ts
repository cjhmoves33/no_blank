import { describe, expect, it } from "vitest";

import { GYM } from "./measurements";
import { brickWalls } from "./room-layout";

const { spans, sillY, headY } = GYM.windows;
const MIDDLE_OF_RIGHT_WALL_X = GYM.room.halfX + GYM.room.wall / 2;
const WALLS = brickWalls();

function isBricked(y: number, z: number): boolean {
  const x = MIDDLE_OF_RIGHT_WALL_X;

  return WALLS.some(
    ({ min, max }) =>
      x > min[0] &&
      x < max[0] &&
      y > min[1] &&
      y < max[1] &&
      z > min[2] &&
      z < max[2],
  );
}

function isInWindow(y: number, z: number): boolean {
  return (
    y > sillY && y < headY && spans.some(([start, end]) => z > start && z < end)
  );
}

describe("brickWalls", () => {
  it("창 자리는 비어 있다", () => {
    for (const [start, end] of spans) {
      expect(isBricked((sillY + headY) / 2, (start + end) / 2)).toBe(false);
    }
  });

  it("창 밖의 오른쪽 벽은 모두 막혀 있어 햇빛이 창으로만 든다", () => {
    const step = 0.25;
    const zCount = Math.floor((2 * GYM.room.halfZ) / step);
    const yCount = Math.floor((GYM.room.ceilingY - GYM.floorY) / step);

    for (let i = 0; i < zCount; i++) {
      for (let j = 0; j < yCount; j++) {
        const z = -GYM.room.halfZ + 0.1 + i * step;
        const y = GYM.floorY + 0.1 + j * step;

        expect(isBricked(y, z)).toBe(!isInWindow(y, z));
      }
    }
  });
});
