import ReactThreeTestRenderer from "@react-three/test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpinningShape } from "./spinning-shape";

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const PRIMARY_BUTTON = 0;
const SECONDARY_BUTTON = 2;

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

  it("주 버튼을 누르는 순간 한 번 알리고, 그 누름은 카메라 궤도로 올라가지 않는다", async () => {
    const { renderer, shape, presses } = await renderShape({ spinning: true });
    const press = pointerDown(PRIMARY_BUTTON);

    await renderer.fireEvent(shape, "pointerDown", press);

    expect(presses).toEqual(["press"]);
    expect(press.nativeEvent.cancelBubble).toBe(true);
  });

  it("다른 버튼으로 누르면 알리지 않고, 그 누름은 카메라 궤도로 올라간다", async () => {
    const { renderer, shape, presses } = await renderShape({ spinning: true });
    const press = pointerDown(SECONDARY_BUTTON);

    await renderer.fireEvent(shape, "pointerDown", press);

    expect(presses).toEqual([]);
    expect(press.nativeEvent.cancelBubble).toBe(false);
  });
});

function pointerDown(button: number) {
  return { button, nativeEvent: new Event("pointerdown", { bubbles: true }) };
}
