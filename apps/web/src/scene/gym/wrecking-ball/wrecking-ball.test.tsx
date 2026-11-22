import ReactThreeTestRenderer from "@react-three/test-renderer";
import { Box3 } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GYM } from "../measurements";
import { WreckingBall } from "./wrecking-ball";

// 테스트는 캔버스가 없는 node 환경에서 돌므로, 가죽 그림만 빼고 그립니다.
vi.mock("../painted-texture", () => ({ PaintedTexture: () => null }));

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const PRIMARY_BUTTON = 0;
const SECONDARY_BUTTON = 2;

let mounted: Renderer | undefined;

async function renderBall() {
  const strikes: string[] = [];
  const renderer = await ReactThreeTestRenderer.create(
    <WreckingBall
      onStrike={() => {
        strikes.push("strike");
      }}
    />,
  );

  mounted = renderer;

  return { renderer, strikes };
}

function strikeable(renderer: Renderer) {
  return renderer.scene.findAll(
    (node) => typeof node.props.onPointerDown === "function",
  );
}

function theBall(renderer: Renderer) {
  const [ball, ...others] = strikeable(renderer);

  if (!ball || others.length > 0) {
    throw new Error("칠 수 있는 것이 하나가 아닙니다.");
  }

  return ball;
}

describe("WreckingBall", () => {
  beforeEach(() => {
    // React 에 테스트 환경임을 알리지 않으면 테스트 렌더러가 act() 를 쓸 때마다 경고합니다.
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(async () => {
    await mounted?.unmount();
    mounted = undefined;
    vi.unstubAllGlobals();
  });

  it("주 버튼으로 치는 순간 한 번 알리고, 그 타격은 카메라 궤도로 올라가지 않는다", async () => {
    const { renderer, strikes } = await renderBall();
    const ball = theBall(renderer);
    const press = pointerDown(PRIMARY_BUTTON);

    await renderer.fireEvent(ball, "pointerDown", press);

    expect(strikes).toEqual(["strike"]);
    expect(press.nativeEvent.cancelBubble).toBe(true);
  });

  it("다른 버튼으로 누르면 알리지 않고, 그 누른 동작은 카메라 궤도로 올라간다", async () => {
    const { renderer, strikes } = await renderBall();
    const ball = theBall(renderer);
    const press = pointerDown(SECONDARY_BUTTON);

    await renderer.fireEvent(ball, "pointerDown", press);

    expect(strikes).toEqual([]);
    expect(press.nativeEvent.cancelBubble).toBe(false);
  });

  it("칠 수 있는 것은 공 하나뿐이라, 사슬과 걸이를 누르면 카메라가 돈다", async () => {
    const { renderer } = await renderBall();

    expect(strikeable(renderer)).toHaveLength(1);

    const reach = new Box3().setFromObject(theBall(renderer).instance);

    expect(reach.max.y).toBeLessThan(GYM.wreckingBall.radius * 1.5);
  });
});

function pointerDown(button: number) {
  return { button, nativeEvent: new Event("pointerdown", { bubbles: true }) };
}
