import ReactThreeTestRenderer from "@react-three/test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpinningShape } from "./spinning-shape";

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

let mounted: Renderer | undefined;

async function renderShape({ spinning }: { spinning: boolean }) {
  const presses: string[] = [];
  const renderer = await ReactThreeTestRenderer.create(
    <SpinningShape
      spinning={spinning}
      onPress={() => {
        presses.push("press");
      }}
    />,
  );

  mounted = renderer;

  return { renderer, shape: renderer.scene.findByType("Mesh"), presses };
}

async function advanceOneSecond(renderer: Renderer): Promise<void> {
  await renderer.advanceFrames(60, 1 / 60);
}

describe("SpinningShape", () => {
  beforeEach(() => {
    // React 에 테스트 환경임을 알리지 않으면 테스트 렌더러가 act() 를 쓸 때마다 경고합니다.
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(async () => {
    await mounted?.unmount();
    mounted = undefined;
    vi.unstubAllGlobals();
  });

  it("돌고 있으면 시간이 지나면서 자세가 바뀐다", async () => {
    const { renderer, shape } = await renderShape({ spinning: true });
    const before = shape.instance.rotation.clone();

    await advanceOneSecond(renderer);

    expect(shape.instance.rotation.equals(before)).toBe(false);
  });

  it("멈춰 있으면 시간이 지나도 자세가 그대로다", async () => {
    const { renderer, shape } = await renderShape({ spinning: false });
    const before = shape.instance.rotation.clone();

    await advanceOneSecond(renderer);

    expect(shape.instance.rotation.equals(before)).toBe(true);
  });

  it("클릭하면 한 번 알린다", async () => {
    const { renderer, shape, presses } = await renderShape({ spinning: true });

    await renderer.fireEvent(shape, "click");

    expect(presses).toEqual(["press"]);
  });

  it("누르기만 하고 아직 떼지 않았으면 알리지 않는다", async () => {
    const { renderer, shape, presses } = await renderShape({ spinning: true });

    await renderer.fireEvent(shape, "pointerDown");

    expect(presses).toEqual([]);
  });
});
