import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { describe, expect, it } from "vitest";

import { GYM } from "../measurements";
import {
  matPixel,
  PAD,
  padTextureV,
  ropePointAt,
  SIDES,
  TIES,
} from "./rigging";

const { mat, ropes, posts } = GYM;

describe("matPixel", () => {
  const size = { width: 2048, height: 2048 };

  it("매트 가운데는 그림의 가운데에 그립니다", () => {
    expect(matPixel(0, 0, size)).toEqual([1024, 1024]);
  });

  it("매트의 -x, -z 모서리는 그림의 왼쪽 위에 그립니다", () => {
    expect(matPixel(-mat.half, -mat.half, size)).toEqual([0, 0]);
  });

  it("코너 기둥마다 그림의 제 모서리 쪽에 그립니다", () => {
    const [x, y] = matPixel(posts.at, -posts.at, size);

    expect(x).toBeCloseTo(2048 * ((mat.half + posts.at) / (mat.half * 2)));
    expect(y).toBeCloseTo(2048 * ((mat.half - posts.at) / (mat.half * 2)));
  });
});

describe("ropePointAt", () => {
  it("로프는 코너에서 제 높이에 걸리고 가운데에서 처집니다", () => {
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
  it("변마다 로프 끈이 두 개씩 있습니다", () => {
    expect(TIES).toHaveLength(SIDES.length * 2);
  });

  it("로프 끈은 로프가 지나는 자리마다 감깁니다", () => {
    for (const tie of TIES) {
      for (const [index, offset] of tie.wrapOffsets.entries()) {
        const rope = ropePointAt(
          tie.side,
          tie.along,
          ropes.heights[index] ?? 0,
        );

        expect(tie.position.clone().add(offset).distanceTo(rope)).toBeLessThan(
          0.001,
        );
      }
    }
  });
});

describe("padTextureV", () => {
  const height = PAD.top - PAD.bottom;
  const geometry = new RoundedBoxGeometry(
    PAD.width,
    height,
    PAD.depth,
    PAD.segments,
    PAD.radius,
  );
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const uvs = geometry.getAttribute("uv");

  // 앞면(-z)의 평평한 부분에서는 v 가 높이에 따라 곧게 변하므로, 그 위아래 끝 두 점으로 사이의 v 를 구합니다.
  function frontV(fromBottom: number): number {
    const flat = Array.from({ length: positions.count }, (_, i) => i)
      .filter((i) => normals.getZ(i) < -0.999)
      .map((i) => ({ y: positions.getY(i) + height / 2, v: uvs.getY(i) }));
    const low = flat.reduce((a, b) => (b.y < a.y ? b : a));
    const high = flat.reduce((a, b) => (b.y > a.y ? b : a));

    return low.v + ((fromBottom - low.y) / (high.y - low.y)) * (high.v - low.v);
  }

  it("로프가 패드에 닿는 높이를 패드 앞면 텍스처의 같은 줄로 옮깁니다", () => {
    for (const rope of ropes.heights) {
      expect(padTextureV(rope)).toBeCloseTo(frontV(rope - PAD.bottom), 3);
    }
  });
});
