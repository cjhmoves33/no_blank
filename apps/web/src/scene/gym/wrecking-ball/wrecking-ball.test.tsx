import ReactThreeTestRenderer from "@react-three/test-renderer";
import { Box3, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GYM } from "../measurements";
import { WreckingBall } from "./wrecking-ball";

// 테스트는 캔버스가 없는 node 환경에서 돌므로, 가죽 그림만 빼고 그립니다.
vi.mock("../painted-texture", () => ({ PaintedTexture: () => null }));

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const PRIMARY_BUTTON = 0;
const SECONDARY_BUTTON = 2;
const FRAME = 1 / 60;
const { radius } = GYM.wreckingBall;
const FRONT = new Vector3(0, 0, radius);
const RIGHT = new Vector3(radius, 0, 0);

let mounted: Renderer | undefined;

async function renderBall({ reducedMotion = false } = {}) {
  const strikes: string[] = [];
  const renderer = await ReactThreeTestRenderer.create(
    <WreckingBall
      reducedMotion={reducedMotion}
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

/** 테스트 장면에서는 멈춰 있을 때의 공 중심이 원점입니다. */
function ballOffset(renderer: Renderer): Vector3 {
  return theBall(renderer).instance.getWorldPosition(new Vector3());
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
    const press = pointerDown(PRIMARY_BUTTON, FRONT);

    await renderer.fireEvent(ball, "pointerDown", press);

    expect(strikes).toEqual(["strike"]);
    expect(press.nativeEvent.cancelBubble).toBe(true);
  });

  it("다른 버튼으로 누르면 알리지 않고, 그 누른 동작은 카메라 궤도로 올라간다", async () => {
    const { renderer, strikes } = await renderBall();
    const ball = theBall(renderer);
    const press = pointerDown(SECONDARY_BUTTON, FRONT);

    await renderer.fireEvent(ball, "pointerDown", press);

    expect(strikes).toEqual([]);
    expect(press.nativeEvent.cancelBubble).toBe(false);
  });

  it("칠 수 있는 것은 공 하나뿐이라, 사슬과 걸이를 누르면 카메라가 돈다", async () => {
    const { renderer } = await renderBall();

    await renderer.advanceFrames(1, FRAME);

    expect(strikeable(renderer)).toHaveLength(1);

    const reach = new Box3().setFromObject(theBall(renderer).instance);

    expect(reach.max.y).toBeLessThan(radius * 1.5);
  });

  it("오른쪽 가장자리를 치면 왼쪽으로 밀려 흔들린다", async () => {
    const { renderer } = await renderBall();

    await renderer.fireEvent(
      theBall(renderer),
      "pointerDown",
      pointerDown(PRIMARY_BUTTON, RIGHT),
    );
    await renderer.advanceFrames(24, FRAME);

    expect(ballOffset(renderer).x).toBeLessThan(-0.2);
  });

  it("공이 흔들리는 동안에도 치는 순간마다 알린다", async () => {
    const { renderer, strikes } = await renderBall();

    for (let i = 0; i < 3; i++) {
      await renderer.fireEvent(
        theBall(renderer),
        "pointerDown",
        pointerDown(PRIMARY_BUTTON, ballOffset(renderer).add(RIGHT)),
      );
      await renderer.advanceFrames(2, FRAME);
    }

    expect(strikes).toEqual(["strike", "strike", "strike"]);
  });

  it("동작 줄이기를 켜면 조금만 밀렸다가 1초 안에 제자리로 돌아온다", async () => {
    const { renderer } = await renderBall({ reducedMotion: true });

    await renderer.fireEvent(
      theBall(renderer),
      "pointerDown",
      pointerDown(PRIMARY_BUTTON, RIGHT),
    );
    await renderer.advanceFrames(6, FRAME);

    expect(ballOffset(renderer).length()).toBeGreaterThan(0.005);
    expect(ballOffset(renderer).length()).toBeLessThan(0.03);

    await renderer.advanceFrames(54, FRAME);

    expect(ballOffset(renderer).length()).toBeLessThan(0.001);
  });
});

function pointerDown(button: number, point: Vector3) {
  return {
    button,
    point,
    nativeEvent: new Event("pointerdown", { bubbles: true }),
  };
}
