import ReactThreeTestRenderer from "@react-three/test-renderer";
import { Box3, Mesh } from "three";
import { describe, expect, it, vi } from "vitest";

import { HEAVY_BAGS_SIZE, HeavyBags } from "./heavy-bags";

// 테스트는 캔버스가 없는 node 환경에서 돌므로, 그림만 빼고 그립니다.
vi.mock("../painted-texture", () => ({ PaintedTexture: () => null }));

// 정점은 Float32 로 저장되어 1e-7 m 쯤 어긋납니다.
const EPSILON = 1e-6;

async function boundsOf(toCeiling: number): Promise<Box3> {
  const renderer = await ReactThreeTestRenderer.create(
    <HeavyBags toCeiling={toCeiling} />,
  );
  const box = new Box3();

  for (const node of renderer.scene.findAll(() => true)) {
    const object: unknown = node.instance;

    if (object instanceof Mesh) {
      object.updateWorldMatrix(true, false);
      box.expandByObject(object, true);
    }
  }

  await renderer.unmount();

  return box;
}

describe("HeavyBags", () => {
  it.each([1.95, 3])(
    "천장이 보에서 %s m 위에 있으면 지지대가 그 높이까지 늘어난다",
    async (toCeiling) => {
      const { max } = await boundsOf(toCeiling);

      expect(max.y).toBeCloseTo(toCeiling, 6);
    },
  );

  it("천장으로 늘어나는 지지대를 빼면 HEAVY_BAGS_SIZE 안에 들어간다", async () => {
    const { min, max } = await boundsOf(1.95);
    const { min: low, max: high } = HEAVY_BAGS_SIZE;

    expect(min.x).toBeGreaterThanOrEqual(low[0] - EPSILON);
    expect(min.y).toBeGreaterThanOrEqual(low[1] - EPSILON);
    expect(min.z).toBeGreaterThanOrEqual(low[2] - EPSILON);
    expect(max.x).toBeLessThanOrEqual(high[0] + EPSILON);
    expect(max.z).toBeLessThanOrEqual(high[2] + EPSILON);
  });
});
