import ReactThreeTestRenderer from "@react-three/test-renderer";
import { createRef } from "react";
import { Mesh, Quaternion, SphereGeometry, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GYM } from "../measurements";
import type { Blow } from "./swing";
import { WreckingBall, type WreckingBallHandle } from "./wrecking-ball";

// 테스트는 캔버스가 없는 node 환경에서 돌므로, 가죽 그림만 빼고 그립니다.
vi.mock("../painted-texture", () => ({ PaintedTexture: () => null }));

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const FRAME = 1 / 60;
const { radius } = GYM.wreckingBall;
const INTO_SCREEN = new Vector3(0, 0, -1);
const FRONT = new Vector3(0, 0, radius);
const RIGHT = new Vector3(radius, 0, 0);

let mounted: Renderer | undefined;

async function renderBall({ reducedMotion = false } = {}) {
  const handle = createRef<WreckingBallHandle>();
  const renderer = await ReactThreeTestRenderer.create(
    <WreckingBall reducedMotion={reducedMotion} ref={handle} />,
  );

  mounted = renderer;

  const ball = handle.current;

  if (!ball) {
    throw new Error("레킹볼 손잡이가 없습니다.");
  }

  return { renderer, ball };
}

function jab(at: Vector3): Blow {
  return { kind: "jab", at, fist: INTO_SCREEN };
}

function centerOf(ball: WreckingBallHandle): Vector3 {
  const sphere = ball.sphere();

  if (!sphere) {
    throw new Error("레킹볼이 장면에 없습니다.");
  }

  return sphere.center;
}

/** 가죽 공이 위에서 볼 때 사슬 축으로 얼마나 돌았는지입니다(라디안). 흔들려 기울어진 것은 빼고 봅니다. */
function heading(renderer: Renderer): number {
  const [leather] = renderer.scene
    .findAll(
      (node) =>
        node.instance instanceof Mesh &&
        node.instance.geometry instanceof SphereGeometry,
    )
    .map((node) => node.instance);

  if (!leather) {
    throw new Error("가죽 공이 없습니다.");
  }

  const side = new Vector3(1, 0, 0).applyQuaternion(
    leather.getWorldQuaternion(new Quaternion()),
  );

  return Math.atan2(-side.z, side.x);
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

  it("손잡이는 가죽 공이 지금 차지한 구를 알려 준다", async () => {
    const { ball } = await renderBall();
    const sphere = ball.sphere();

    expect(sphere?.radius).toBe(radius);
    expect(sphere?.center.length()).toBeLessThan(1e-9);
  });

  it("오른쪽 가장자리를 잽으로 치면 왼쪽으로 밀려 흔들린다", async () => {
    const { renderer, ball } = await renderBall();

    ball.take(jab(RIGHT));
    await renderer.advanceFrames(24, FRAME);

    expect(centerOf(ball).x).toBeLessThan(-0.2);
  });

  it("칠 때마다 그 타격의 세기를 돌려준다", async () => {
    const { renderer, ball } = await renderBall();
    const first = ball.take(jab(RIGHT));

    await renderer.advanceFrames(2, FRAME);

    const second = ball.take(jab(RIGHT));

    expect(first.strength).toBeGreaterThan(0);
    expect(second.strength).toBeLessThan(first.strength);
  });

  it("옆 가장자리를 치면 사슬 축으로 비틀리고, 정면 가운데를 치면 비틀리지 않는다", async () => {
    const side = await renderBall();

    side.ball.take(jab(RIGHT));
    await side.renderer.advanceFrames(18, FRAME);

    expect(Math.abs(heading(side.renderer))).toBeGreaterThan(0.1);

    await side.renderer.unmount();

    const front = await renderBall();

    front.ball.take(jab(FRONT));
    await front.renderer.advanceFrames(18, FRAME);

    expect(Math.abs(heading(front.renderer))).toBeLessThan(1e-6);
  });

  it("동작 줄이기를 켜면 조금만 밀렸다가 1초 안에 제자리로 돌아온다", async () => {
    const { renderer, ball } = await renderBall({ reducedMotion: true });

    ball.take(jab(RIGHT));
    await renderer.advanceFrames(6, FRAME);

    expect(centerOf(ball).length()).toBeGreaterThan(0.005);
    expect(centerOf(ball).length()).toBeLessThan(0.03);

    await renderer.advanceFrames(54, FRAME);

    expect(centerOf(ball).length()).toBeLessThan(0.001);
  });
});
