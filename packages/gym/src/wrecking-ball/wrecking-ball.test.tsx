import ReactThreeTestRenderer from "@react-three/test-renderer";
import { createRef } from "react";
import {
  Box3,
  BufferGeometry,
  InstancedMesh,
  Matrix3,
  Matrix4,
  Mesh,
  Points,
  Quaternion,
  Vector3,
} from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LINK_PITCH } from "../chain/chain";
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
  const sphere = ball.worldShape()?.sphere;

  if (!sphere) {
    throw new Error("레킹볼이 장면에 없습니다.");
  }

  return sphere.center;
}

interface LeatherView {
  readonly geometry: BufferGeometry;
  readonly turn: Quaternion;
}

function meshesNamed(renderer: Renderer, name: string): Mesh[] {
  const named = (object: unknown): object is Mesh =>
    object instanceof Mesh && object.name === name;

  return renderer.scene
    .findAll(() => true)
    .map((node): unknown => node.instance)
    .filter(named);
}

function leatherOf(renderer: Renderer): LeatherView {
  const [leather] = meshesNamed(renderer, "leather");

  if (!leather) {
    throw new Error("가죽 공이 없습니다.");
  }

  return {
    geometry: leather.geometry,
    turn: leather.getWorldQuaternion(new Quaternion()),
  };
}

function leatherPoints(renderer: Renderer): Vector3[] {
  const positions = leatherOf(renderer).geometry.getAttribute("position");

  return Array.from({ length: positions.count }, (_, i) =>
    new Vector3().fromBufferAttribute(positions, i),
  );
}

function deepestSink(
  renderer: Renderer,
  rest: readonly Vector3[],
): { readonly depth: number; readonly direction: Vector3 } {
  const now = leatherPoints(renderer);
  let deepest = { depth: -Infinity, direction: new Vector3() };

  now.forEach((point, i) => {
    const before = rest[i] ?? point;
    const depth = before.length() - point.length();

    if (depth > deepest.depth) {
      deepest = { depth, direction: before.clone().normalize() };
    }
  });

  return {
    depth: deepest.depth,
    direction: deepest.direction.applyQuaternion(leatherOf(renderer).turn),
  };
}

function farthestFrom(renderer: Renderer, rest: readonly Vector3[]): number {
  return Math.max(
    ...leatherPoints(renderer).map((point, i) =>
      point.distanceTo(rest[i] ?? point),
    ),
  );
}

function stretchAlong(renderer: Renderer, axis: Vector3): number {
  const [leather] = meshesNamed(renderer, "leather");

  if (!leather) {
    throw new Error("가죽 공이 없습니다.");
  }

  leather.updateWorldMatrix(true, false);

  return axis
    .clone()
    .applyMatrix3(new Matrix3().setFromMatrix4(leather.matrixWorld))
    .length();
}

function pointsOf(renderer: Renderer, name: string): Vector3[] {
  return meshesNamed(renderer, name).flatMap((strap) => {
    const positions = strap.geometry.getAttribute("position");

    return Array.from({ length: positions.count }, (_, i) =>
      new Vector3().fromBufferAttribute(positions, i),
    );
  });
}

function nearestToCenter(renderer: Renderer, name: string): number {
  return Math.min(...pointsOf(renderer, name).map((point) => point.length()));
}

function middleOfFirstStrap(renderer: Renderer): Vector3 {
  const [strap] = meshesNamed(renderer, "leather-strap");

  if (!strap) {
    throw new Error("가죽 끈이 없습니다.");
  }

  const positions = strap.geometry.getAttribute("position");
  const middle = new Vector3();

  for (let i = 0; i < positions.count; i++) {
    middle.add(new Vector3().fromBufferAttribute(positions, i));
  }

  return middle
    .normalize()
    .applyQuaternion(strap.getWorldQuaternion(new Quaternion()));
}

function ringFacing(matrixWorld: Matrix4): Vector3 {
  return new Vector3(0, 0, 1).transformDirection(matrixWorld);
}

function lastUpperLinkFacing(renderer: Renderer): Vector3 {
  const [chain] = meshesNamed(renderer, "upper-chain");

  if (!(chain instanceof InstancedMesh)) {
    throw new Error("위쪽 사슬이 없습니다.");
  }

  const last = new Matrix4();

  chain.getMatrixAt(chain.count - 1, last);
  chain.updateWorldMatrix(true, false);

  return ringFacing(chain.matrixWorld.clone().multiply(last));
}

function swivelEyeFacing(renderer: Renderer): Vector3 {
  const [eye] = meshesNamed(renderer, "swivel-eye");

  if (!eye) {
    throw new Error("회전 고리의 위쪽 고리가 없습니다.");
  }

  eye.updateWorldMatrix(true, false);

  return ringFacing(eye.matrixWorld);
}

function dRingsAboveTabs(renderer: Renderer): number[] {
  const tabs = meshesNamed(renderer, "leather-tab");
  const rings = meshesNamed(renderer, "d-ring");

  if (tabs.length !== 4 || rings.length !== 4) {
    throw new Error("가죽 끈 탭과 D링이 네 개씩 있어야 합니다.");
  }

  return tabs.map((tab, i) => {
    const ring = rings[i];

    tab.updateWorldMatrix(true, false);
    ring?.updateWorldMatrix(true, false);

    const tabTop = new Box3().setFromObject(tab, true).max.y;
    const ringBottom = ring
      ? new Box3().setFromObject(ring, true).min.y
      : Infinity;

    return ringBottom - tabTop;
  });
}

function strandGapsAtDRings(renderer: Renderer): number[] {
  const [strands] = meshesNamed(renderer, "strands");

  if (!(strands instanceof InstancedMesh)) {
    throw new Error("사슬 가닥이 없습니다.");
  }

  strands.updateWorldMatrix(true, false);

  const links = Array.from({ length: strands.count }, (_, i) => {
    const link = new Matrix4();

    strands.getMatrixAt(i, link);

    return new Vector3().setFromMatrixPosition(
      strands.matrixWorld.clone().multiply(link),
    );
  });

  return meshesNamed(renderer, "d-ring").map((ring) => {
    const top = ring
      .getWorldPosition(new Vector3())
      .add(UP.clone().multiplyScalar(0.02));

    return Math.min(...links.map((link) => link.distanceTo(top)));
  });
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

  it("손잡이는 가죽 공이 지금 차지한 모양, 곧 구와 납작한 덮개를 알려 준다", async () => {
    const { ball } = await renderBall();
    const shape = ball.worldShape();

    expect(shape?.sphere.radius).toBe(radius);
    expect(shape?.sphere.center.length()).toBeLessThan(1e-9);
    expect(shape?.lid.normal.y).toBeCloseTo(1, 9);
    expect(shape?.lid.distanceToPoint(new Vector3())).toBeCloseTo(
      -GYM.wreckingBall.lidHeight,
      9,
    );
  });

  it("그려진 가죽의 납작한 윗면은 손잡이가 알려 준 덮개 높이에 있다", async () => {
    const { renderer } = await renderBall();
    const highest = Math.max(
      ...leatherPoints(renderer).map((point) => point.y),
    );

    expect(highest).toBeCloseTo(GYM.wreckingBall.lidHeight, 6);
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
    const rest = leatherPoints(renderer);

    ball.take(jab(RIGHT));
    await renderer.advanceFrames(1, FRAME);

    expect(deepestSink(renderer, rest).depth).toBeGreaterThan(0.008);

    await renderer.advanceFrames(30, FRAME);

    expect(farthestFrom(renderer, rest)).toBeLessThan(1e-6);
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

    const rest = leatherPoints(renderer);

    ball.take(jab(FRONT));
    await renderer.advanceFrames(1, FRAME);

    expect(deepestSink(renderer, rest).direction.angleTo(FRONT)).toBeLessThan(
      0.05,
    );
  });

  it("덮개 테두리도 가죽과 함께 패여서 패인 자리 위에 떠 보이지 않는다", async () => {
    const { renderer, ball } = await renderBall();
    const before = nearestToCenter(renderer, "leather-rim");
    const [onRim] = pointsOf(renderer, "leather-rim");

    if (!onRim) {
      throw new Error("덮개 테두리가 없습니다.");
    }

    ball.take(jab(onRim.clone().setLength(radius)));
    await renderer.advanceFrames(1, FRAME);

    expect(nearestToCenter(renderer, "leather-rim")).toBeLessThan(
      before - 0.008,
    );
  });

  it("가죽 끈도 가죽과 함께 패여서 패인 자리 위에 떠 보이지 않는다", async () => {
    const { renderer, ball } = await renderBall();
    const before = nearestToCenter(renderer, "leather-strap");

    ball.take(jab(middleOfFirstStrap(renderer).multiplyScalar(radius)));
    await renderer.advanceFrames(1, FRAME);

    expect(nearestToCenter(renderer, "leather-strap")).toBeLessThan(
      before - 0.008,
    );
  });

  it("맞으면 몸통이 맞은 방향으로 잠깐 납작해졌다가 둥글게 돌아오고, 동작 줄이기에서는 그대로다", async () => {
    const moving = await renderBall();

    moving.ball.take(jab(RIGHT));
    await moving.renderer.advanceFrames(1, FRAME);

    expect(stretchAlong(moving.renderer, new Vector3(1, 0, 0))).toBeLessThan(
      0.98,
    );
    expect(stretchAlong(moving.renderer, new Vector3(0, 0, 1))).toBeGreaterThan(
      1.005,
    );

    await moving.renderer.advanceFrames(40, FRAME);

    expect(stretchAlong(moving.renderer, new Vector3(1, 0, 0))).toBeCloseTo(
      1,
      3,
    );

    await moving.renderer.unmount();

    const calm = await renderBall({ reducedMotion: true });

    calm.ball.take(jab(RIGHT));
    await calm.renderer.advanceFrames(1, FRAME);

    expect(stretchAlong(calm.renderer, new Vector3(1, 0, 0))).toBeCloseTo(1, 9);
  });

  it("가장 세게 올려 쳐서 납작해져도 D링은 가죽 끈 탭에 걸려 있고, 사슬 가닥도 D링에서 끊기지 않는다", async () => {
    const { renderer, ball } = await renderBall();

    await renderer.advanceFrames(1, FRAME);

    expect(Math.max(...dRingsAboveTabs(renderer))).toBeLessThan(0);

    ball.take({ kind: "swipe", hitFromCenter: UNDER, fist: UP, speed: 100 });
    await renderer.advanceFrames(1, FRAME);

    expect(Math.max(...dRingsAboveTabs(renderer))).toBeLessThan(0);
    expect(Math.max(...strandGapsAtDRings(renderer))).toBeLessThan(LINK_PITCH);
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

  it("옆 가장자리를 치면 회전 고리를 축으로 비틀리고, 정면 가운데를 치면 비틀리지 않는다", async () => {
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

  it("옆 가장자리를 맞아 비틀린 공은 멈춘 뒤에도 되감기지 않고 그 방향에 머문다", async () => {
    const { renderer, ball } = await renderBall();

    ball.take(jab(RIGHT));
    await renderer.advanceFrames(90, FRAME);

    const stopped = heading(renderer);

    await renderer.advanceFrames(120, FRAME);

    expect(Math.abs(stopped)).toBeGreaterThan(0.05);
    expect(heading(renderer)).toBeCloseTo(stopped, 3);
  });

  it("레킹볼이 여러 번 비틀려도 회전 고리의 위쪽 고리는 위쪽 사슬의 마지막 고리와 90도로 맞물린다", async () => {
    const { renderer, ball } = await renderBall();

    for (let i = 0; i < 3; i++) {
      ball.take({
        kind: "swipe",
        hitFromCenter: FRONT,
        fist: new Vector3(1, 0, 0),
        speed: 100,
      });
      await renderer.advanceFrames(150, FRAME);
    }

    expect(Math.abs(heading(renderer))).toBeGreaterThan(0.5);
    expect(
      Math.abs(swivelEyeFacing(renderer).dot(lastUpperLinkFacing(renderer))),
    ).toBeLessThan(0.05);
  });

  it("옆구리를 맞으면 회전 고리를 축으로 기우뚱했다가 돌아온다", async () => {
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
