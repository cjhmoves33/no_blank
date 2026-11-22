import ReactThreeTestRenderer from "@react-three/test-renderer";
import { createRef } from "react";
import {
  BufferGeometry,
  Mesh,
  Points,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GYM } from "../measurements";
import { type Blow, CHAIN_REACH, type Jolt } from "./swing";
import { WreckingBall, type WreckingBallHandle } from "./wrecking-ball";

// 테스트는 캔버스가 없는 node 환경에서 돌므로, 가죽 그림만 빼고 그립니다.
vi.mock("../painted-texture", () => ({ PaintedTexture: () => null }));

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const FRAME = 1 / 60;
const { radius } = GYM.wreckingBall;
const INTO_SCREEN = new Vector3(0, 0, -1);
const FRONT = new Vector3(0, 0, radius);
const RIGHT = new Vector3(radius, 0, 0);
const UNDER = new Vector3(0, -radius, 0);
const PIVOT = new Vector3(0, CHAIN_REACH, 0);
const UP = new Vector3(0, 1, 0);

let mounted: Renderer | undefined;

async function renderBall({ reducedMotion = false } = {}) {
  const handle = createRef<WreckingBallHandle>();
  const jolts: Jolt[] = [];
  const renderer = await ReactThreeTestRenderer.create(
    <WreckingBall
      reducedMotion={reducedMotion}
      ref={handle}
      onJolt={(jolt) => {
        jolts.push(jolt);
      }}
    />,
  );

  mounted = renderer;

  const ball = handle.current;

  if (!ball) {
    throw new Error("레킹볼 손잡이가 없습니다.");
  }

  return { renderer, ball, jolts };
}

function jab(hitFromCenter: Vector3): Blow {
  return { kind: "jab", hitFromCenter, fist: INTO_SCREEN };
}

function centerOf(ball: WreckingBallHandle): Vector3 {
  const sphere = ball.worldSphere();

  if (!sphere) {
    throw new Error("레킹볼이 장면에 없습니다.");
  }

  return sphere.center;
}

interface LeatherView {
  readonly geometry: SphereGeometry;
  readonly turn: Quaternion;
}

function leatherOf(renderer: Renderer): LeatherView {
  const [leather] = renderer.scene
    .findAll(() => true)
    .flatMap((node) =>
      node.instance instanceof Mesh &&
      node.instance.geometry instanceof SphereGeometry
        ? [
            {
              geometry: node.instance.geometry,
              turn: node.instance.getWorldQuaternion(new Quaternion()),
            },
          ]
        : [],
    );

  if (!leather) {
    throw new Error("가죽 공이 없습니다.");
  }

  return leather;
}

function nearestLeatherToCenter(renderer: Renderer): number {
  const positions = leatherOf(renderer).geometry.getAttribute("position");
  let nearest = Infinity;

  for (let i = 0; i < positions.count; i++) {
    nearest = Math.min(
      nearest,
      Math.hypot(positions.getX(i), positions.getY(i), positions.getZ(i)),
    );
  }

  return nearest;
}

function nearestSeamToCenter(renderer: Renderer): number {
  const distances = renderer.scene
    .findAll(() => true)
    .flatMap((node) => {
      if (
        !(node.instance instanceof Mesh) ||
        !(node.instance.geometry instanceof TorusGeometry) ||
        node.instance.geometry.parameters.radius !== radius
      ) {
        return [];
      }

      const positions = node.instance.geometry.getAttribute("position");

      return Array.from({ length: positions.count }, (_, i) =>
        Math.hypot(positions.getX(i), positions.getY(i), positions.getZ(i)),
      );
    });

  return Math.min(...distances);
}

function deepestDentDirection(renderer: Renderer): Vector3 {
  const { geometry, turn } = leatherOf(renderer);
  const positions = geometry.getAttribute("position");
  const deepest = new Vector3();
  let nearest = Infinity;

  for (let i = 0; i < positions.count; i++) {
    const vertex = new Vector3().fromBufferAttribute(positions, i);

    if (vertex.length() < nearest) {
      nearest = vertex.length();
      deepest.copy(vertex);
    }
  }

  return deepest.normalize().applyQuaternion(turn);
}

function dustGrains(renderer: Renderer): number {
  return renderer.scene
    .findAll(() => true)
    .reduce(
      (sum, node) =>
        sum +
        (node.instance instanceof Points &&
        node.instance.geometry instanceof BufferGeometry
          ? node.instance.geometry.drawRange.count
          : 0),
      0,
    );
}

function leaning(renderer: Renderer, ball: WreckingBallHandle): number {
  const cap = UP.clone().applyQuaternion(leatherOf(renderer).turn);

  return cap.angleTo(PIVOT.clone().sub(centerOf(ball)));
}

async function leaningOver(
  renderer: Renderer,
  ball: WreckingBallHandle,
  frames: number,
): Promise<number[]> {
  const seen: number[] = [];

  for (let i = 0; i < frames; i++) {
    await renderer.advanceFrames(1, FRAME);
    seen.push(leaning(renderer, ball));
  }

  return seen;
}

function heading(renderer: Renderer): number {
  const side = new Vector3(1, 0, 0).applyQuaternion(leatherOf(renderer).turn);

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
    const sphere = ball.worldSphere();

    expect(sphere?.radius).toBe(radius);
    expect(sphere?.center.length()).toBeLessThan(1e-9);
  });

  it("창 사이 벽 그림자에 들면 햇빛에 바래지 않도록, 메시는 모두 그림자를 받는다", async () => {
    const { renderer } = await renderBall();
    const meshes = renderer.scene
      .findAll(() => true)
      .flatMap((node) =>
        node.instance instanceof Mesh ? [node.instance] : [],
      );

    expect(meshes.length).toBeGreaterThan(0);
    expect(meshes.map((mesh) => mesh.receiveShadow)).not.toContain(false);
  });

  it("오른쪽 가장자리를 잽으로 치면 왼쪽으로 밀려 흔들린다", async () => {
    const { renderer, ball } = await renderBall();

    ball.take(jab(RIGHT));
    await renderer.advanceFrames(24, FRAME);

    expect(centerOf(ball).x).toBeLessThan(-0.05);
  });

  it("맞으면 히트스톱 동안 멈췄다가 밀려 나간다", async () => {
    const { renderer, ball } = await renderBall();

    ball.take(jab(RIGHT));
    await renderer.advanceFrames(3, FRAME);

    expect(centerOf(ball).length()).toBeLessThan(1e-9);

    await renderer.advanceFrames(21, FRAME);

    expect(centerOf(ball).x).toBeLessThan(-0.05);
  });

  it("맞은 자리가 잠깐 패였다가 둥글게 돌아온다", async () => {
    const { renderer, ball } = await renderBall();

    ball.take(jab(RIGHT));
    await renderer.advanceFrames(1, FRAME);

    expect(nearestLeatherToCenter(renderer)).toBeLessThan(radius - 0.008);

    await renderer.advanceFrames(30, FRAME);

    expect(nearestLeatherToCenter(renderer)).toBeCloseTo(radius, 6);
  });

  it("이미 비틀리거나 기운 공을 쳐도 패임은 맞은 자리에 생긴다", async () => {
    const { renderer, ball } = await renderBall();

    ball.take({
      kind: "swipe",
      hitFromCenter: FRONT,
      fist: new Vector3(1, 0, 0),
      speed: 100,
    });
    await renderer.advanceFrames(40, FRAME);

    expect(Math.abs(heading(renderer))).toBeGreaterThan(0.15);

    ball.take(jab(FRONT));
    await renderer.advanceFrames(1, FRAME);

    expect(deepestDentDirection(renderer).angleTo(FRONT)).toBeLessThan(0.05);
  });

  it("솔기도 가죽과 함께 패여서 패인 자리 위에 떠 보이지 않는다", async () => {
    const { renderer, ball } = await renderBall();
    const before = nearestSeamToCenter(renderer);

    ball.take(jab(RIGHT));
    await renderer.advanceFrames(1, FRAME);

    expect(nearestSeamToCenter(renderer)).toBeLessThan(before - 0.008);
  });

  it("맞은 자리에서 타격 먼지가 피어오르고, 동작 줄이기에서는 피지 않는다", async () => {
    const moving = await renderBall();

    moving.ball.take(jab(RIGHT));
    await moving.renderer.advanceFrames(1, FRAME);

    expect(dustGrains(moving.renderer)).toBeGreaterThan(0);

    await moving.renderer.unmount();

    const calm = await renderBall({ reducedMotion: true });

    calm.ball.take(jab(RIGHT));
    await calm.renderer.advanceFrames(1, FRAME);

    expect(dustGrains(calm.renderer)).toBe(0);
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

    expect(Math.abs(heading(side.renderer))).toBeGreaterThan(0.03);

    await side.renderer.unmount();

    const front = await renderBall();

    front.ball.take(jab(FRONT));
    await front.renderer.advanceFrames(18, FRAME);

    expect(Math.abs(heading(front.renderer))).toBeLessThan(1e-6);
  });

  it("옆구리를 맞으면 걸이를 축으로 기우뚱했다가 돌아온다", async () => {
    const { renderer, ball } = await renderBall();

    ball.take(jab(RIGHT));

    expect(
      Math.max(...(await leaningOver(renderer, ball, 30))),
    ).toBeGreaterThan(0.004);

    await renderer.advanceFrames(150, FRAME);

    expect(leaning(renderer, ball)).toBeLessThan(0.001);
  });

  it("세게 올려 친 공이 떨어져 사슬이 팽팽해지면 덜컹을 알리고, 옆으로만 흔들리면 알리지 않는다", async () => {
    const lifted = await renderBall();

    lifted.ball.take({
      kind: "swipe",
      hitFromCenter: UNDER,
      fist: UP,
      speed: 100,
    });
    await lifted.renderer.advanceFrames(90, FRAME);

    expect(lifted.jolts.length).toBeGreaterThan(0);
    expect(lifted.jolts[0]?.strength).toBeGreaterThan(0);

    await lifted.renderer.unmount();

    const swung = await renderBall();

    swung.ball.take(jab(RIGHT));
    await swung.renderer.advanceFrames(180, FRAME);

    expect(swung.jolts).toEqual([]);
  });

  it("동작 줄이기에서는 기우뚱하지 않는다", async () => {
    const { renderer, ball } = await renderBall({ reducedMotion: true });

    ball.take(jab(RIGHT));

    expect(Math.max(...(await leaningOver(renderer, ball, 30)))).toBeLessThan(
      1e-6,
    );
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
