import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { GYM } from "./measurements";
import { type Box, type Point, slabArrays } from "./slabs";

const TILE = 4;

interface Vertex {
  readonly position: Vector3;
  readonly normal: Vector3;
  readonly uv: readonly [u: number, v: number];
  readonly uv1: readonly [u: number, v: number];
}

function vertices(boxes: readonly Box[]): Vertex[] {
  const arrays = slabArrays(boxes, TILE);

  return Array.from({ length: arrays.position.length / 3 }, (_, i) => ({
    position: new Vector3().fromArray(arrays.position, i * 3),
    normal: new Vector3().fromArray(arrays.normal, i * 3),
    uv: [arrays.uv[i * 2] ?? NaN, arrays.uv[i * 2 + 1] ?? NaN],
    uv1: [arrays.uv1[i * 2] ?? NaN, arrays.uv1[i * 2 + 1] ?? NaN],
  }));
}

function frontVerticesAt(boxes: readonly Box[], point: Point): Vertex[] {
  const at = new Vector3(...point);
  const front = new Vector3(0, 0, 1);

  // 꼭짓점은 Float32Array 에 담기므로 -4.6 같은 값이 조금 달라집니다.
  return vertices(boxes).filter(
    (vertex) =>
      vertex.position.distanceTo(at) < 1e-5 && vertex.normal.equals(front),
  );
}

describe("slabArrays", () => {
  it("나란히 붙은 두 조각의 경계에서 무늬가 이어진다", () => {
    const left: Box = { min: [-4, 0, 0], max: [0, 2, 1] };
    const right: Box = { min: [0, 0, 0], max: [4, 2, 1] };

    const [fromLeft, fromRight] = frontVerticesAt([left, right], [0, 2, 1]);

    expect(fromLeft?.uv).toEqual([0, 2 / TILE]);
    expect(fromRight?.uv).toEqual([0, 2 / TILE]);
  });

  it("uv1 은 조각의 크기와 상관없이 방 안의 자리를 0~1 로 준다", () => {
    const { halfX, ceilingY } = GYM.room;
    const middleY = (GYM.floorY + ceilingY) / 2;
    const pieces: Box[] = [
      { min: [-halfX, GYM.floorY, 0], max: [-halfX + 1, GYM.floorY + 1, 1] },
      { min: [0, middleY, 0], max: [1, middleY + 1, 1] },
      { min: [halfX - 1, ceilingY - 1, 0], max: [halfX, ceilingY, 1] },
    ];

    // 부동소수 오차만 지웁니다. + 0 은 -0 을 0 으로 바꿉니다.
    const uv1At = (point: Point) =>
      frontVerticesAt(pieces, point).map((vertex) =>
        vertex.uv1.map((value) => Math.round(value * 1e6) / 1e6 + 0),
      );

    expect(uv1At([-halfX, GYM.floorY, 1])).toEqual([[0, 0]]);
    expect(uv1At([0, middleY, 1])).toEqual([[0.5, 0.5]]);
    expect(uv1At([halfX, ceilingY, 1])).toEqual([[1, 1]]);
  });

  it("삼각형은 바깥에서 볼 때 앞면이라 지워지지 않는다", () => {
    const box: Box = { min: [-1, -2, -3], max: [4, 5, 6] };
    const arrays = slabArrays([box], TILE);
    const all = vertices([box]);

    for (let i = 0; i < arrays.index.length; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => all[arrays.index[i + k] ?? -1]);

      if (!a || !b || !c) {
        throw new Error(`triangle ${i / 3} points outside the vertices`);
      }

      const facing = b.position
        .clone()
        .sub(a.position)
        .cross(c.position.clone().sub(a.position));

      expect(facing.dot(a.normal)).toBeGreaterThan(0);
    }
  });
});
