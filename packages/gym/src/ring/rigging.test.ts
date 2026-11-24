import { describe, expect, it } from "vitest";

import { GYM } from "../measurements";
import { matPixel, ropePointAt, SIDES, TIES } from "./rigging";

const { mat, ropes, posts } = GYM;

describe("matPixel", () => {
  const size = { width: 2048, height: 2048 };

  it("puts the middle of the mat in the middle of the painting", () => {
    expect(matPixel(0, 0, size)).toEqual([1024, 1024]);
  });

  it("puts the far left corner of the mat at the painting's top left", () => {
    expect(matPixel(-mat.half, -mat.half, size)).toEqual([0, 0]);
  });

  it("finds each corner post on its own corner of the painting", () => {
    const [x, y] = matPixel(posts.at, -posts.at, size);

    expect(x).toBeCloseTo(2048 * ((mat.half + posts.at) / (mat.half * 2)));
    expect(y).toBeCloseTo(2048 * ((mat.half - posts.at) / (mat.half * 2)));
  });
});

describe("ropePointAt", () => {
  it("hangs each rope at its height at the posts and sags in the middle", () => {
    const side = SIDES[0];

    if (!side) {
      throw new Error("no side");
    }

    const height = ropes.heights[1];

    expect(ropePointAt(side, 0, height).y).toBeCloseTo(mat.y + height);
    expect(ropePointAt(side, 1, height).y).toBeCloseTo(mat.y + height);
    expect(ropePointAt(side, 0.5, height).y).toBeCloseTo(
      mat.y + height - ropes.sag,
    );
  });
});

describe("TIES", () => {
  it("puts two ties on every side", () => {
    expect(TIES).toHaveLength(SIDES.length * 2);
  });

  it("wraps every tie around each rope where the rope passes", () => {
    for (const tie of TIES) {
      for (const [index, wrap] of tie.wraps.entries()) {
        const rope = ropePointAt(
          tie.side,
          tie.along,
          ropes.heights[index] ?? 0,
        );

        expect(tie.position.clone().add(wrap).distanceTo(rope)).toBeLessThan(
          0.001,
        );
      }
    }
  });
});
