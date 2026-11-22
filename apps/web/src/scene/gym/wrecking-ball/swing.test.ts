import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { GYM } from "../measurements";
import {
  advance,
  type Blow,
  CHAIN_REACH,
  farthestReach,
  restingSwing,
  strike,
  type Swing,
  SWING_FEEL,
  type SwingFeel,
} from "./swing";

const { radius } = GYM.wreckingBall;
const REST = new Vector3(0, -CHAIN_REACH, 0);
const FRONT = new Vector3(0, 0, radius);
const RIGHT = new Vector3(radius, 0, 0);
const UNDER = new Vector3(0, -radius, 0);
const FRAME = 1 / 60;
const UP = new Vector3(0, 1, 0);
const TO_THE_RIGHT = new Vector3(1, 0, 0);
const FASTEST_SWIPE = 100;
const { normal, reduced } = SWING_FEEL;

function jab(at: Vector3): Blow {
  return { kind: "jab", at, fist: at.clone().negate().normalize() };
}

function swipe(fist: Vector3, speed: number): Blow {
  return {
    kind: "swipe",
    at: fist.clone().negate().setLength(radius),
    fist,
    speed,
  };
}

function hit(swing: Swing, at: Vector3, feel: SwingFeel): Swing {
  return strike(swing, jab(at), feel).swing;
}

function track(swing: Swing, seconds: number, feel: SwingFeel): Vector3[] {
  const positions: Vector3[] = [];
  let current = swing;

  for (let t = 0; t < seconds; t += FRAME) {
    current = advance(current, FRAME, feel);
    positions.push(current.fromPivot);
  }

  return positions;
}

function moving(velocity: Vector3): Swing {
  return { ...restingSwing(), velocity };
}

function largestOffset(positions: Vector3[]): number {
  return Math.max(...positions.map((position) => position.distanceTo(REST)));
}

describe("swing", () => {
  it("치지 않으면 제자리에 멈춰 있다", () => {
    const after = advance(restingSwing(), 5, normal);

    expect(after.fromPivot.distanceTo(REST)).toBeLessThan(1e-9);
  });

  it("앞면 가운데를 잽으로 치면 뒤로 밀린다", () => {
    const struck = hit(restingSwing(), FRONT, normal);
    const after = advance(struck, 0.4, normal);

    expect(after.fromPivot.z).toBeLessThan(-0.2);
    expect(Math.abs(after.fromPivot.x)).toBeLessThan(1e-9);
  });

  it("오른쪽 가장자리를 잽으로 치면 왼쪽으로 밀린다", () => {
    const struck = hit(restingSwing(), RIGHT, normal);
    const after = advance(struck, 0.4, normal);

    expect(after.fromPivot.x).toBeLessThan(-0.2);
    expect(Math.abs(after.fromPivot.z)).toBeLessThan(1e-9);
  });

  it("아래를 치면 공이 들려 사슬이 느슨해졌다가, 떨어져 다시 팽팽해진다", () => {
    const struck = hit(restingSwing(), UNDER, normal);
    const lifted = advance(struck, 0.1, normal);

    expect(lifted.fromPivot.y).toBeGreaterThan(REST.y + 0.03);
    expect(lifted.fromPivot.length()).toBeLessThan(CHAIN_REACH - 0.03);

    const fallen = advance(lifted, 1, normal);

    expect(fallen.fromPivot.length()).toBeCloseTo(CHAIN_REACH, 9);
  });

  it("휘두르면 맞은 자리와 관계없이 끈 방향으로 밀린다", () => {
    const blow: Blow = {
      kind: "swipe",
      at: FRONT,
      fist: TO_THE_RIGHT,
      speed: 2,
    };
    const after = advance(
      strike(restingSwing(), blow, normal).swing,
      0.4,
      normal,
    );

    expect(after.fromPivot.x).toBeGreaterThan(0.2);
    expect(Math.abs(after.fromPivot.z)).toBeLessThan(1e-9);
  });

  it("빨리 휘두를수록 멀리 밀리지만, 아주 빠르게 휘둘러도 정해진 빠르기 이상으로 밀지 않는다", () => {
    const reach = (speed: number) =>
      largestOffset(
        track(
          strike(restingSwing(), swipe(TO_THE_RIGHT, speed), normal).swing,
          2,
          normal,
        ),
      );

    expect(reach(1.5)).toBeLessThan(reach(2.5));
    expect(reach(FASTEST_SWIPE)).toBeCloseTo(reach(FASTEST_SWIPE / 10), 9);
  });

  it("사슬은 늘어나지 않는다", () => {
    let swing = restingSwing();

    for (const offset of hitOffsets(60)) {
      swing = strike(
        swing,
        swipe(offset.clone().negate(), FASTEST_SWIPE),
        normal,
      ).swing;

      for (const position of track(swing, 0.3, normal)) {
        expect(position.length()).toBeLessThanOrEqual(CHAIN_REACH + 1e-9);
      }

      swing = advance(swing, 0.3, normal);
    }
  });

  it("다가오던 공을 치면 방향이 뒤집혀 주먹 쪽에서 멀어진다", () => {
    const coming = moving(new Vector3(0.5, 0, 0));
    const after = advance(hit(coming, RIGHT, normal), 0.3, normal);

    expect(after.fromPivot.x).toBeLessThan(-0.2);
  });

  it("공이 주먹보다 빨리 멀어지고 있으면 쳐도 흔들림이 바뀌지 않는다", () => {
    const leaving = moving(new Vector3(-1.4, 0, 0));
    const untouched = advance(leaving, 1, normal);
    const struck = advance(hit(leaving, RIGHT, normal), 1, normal);

    expect(struck.fromPivot.distanceTo(untouched.fromPivot)).toBeLessThan(1e-9);
  });

  it("같은 자리를 연달아 쳐도 한 번 친 것보다 크게 흔들리지 않는다", () => {
    const once = hit(restingSwing(), RIGHT, normal);
    const twice = hit(advance(once, 0.05, normal), RIGHT, normal);

    expect(largestOffset(track(twice, 3, normal))).toBeLessThan(
      largestOffset(track(once, 3, normal)) * 1.05,
    );
  });

  it("어디로 몇 번 휘두르든 공은 정해진 범위 안에서 흔들린다", () => {
    let swing = restingSwing();
    let farthest = 0;

    for (const [i, offset] of hitOffsets(400).entries()) {
      swing = strike(
        swing,
        swipe(offset.clone().negate(), FASTEST_SWIPE),
        normal,
      ).swing;

      for (const position of track(swing, 0.05 + (i % 7) * 0.12, normal)) {
        farthest = Math.max(farthest, Math.hypot(position.x, position.z));
      }

      swing = advance(swing, 0.05 + (i % 7) * 0.12, normal);
    }

    expect(farthest).toBeLessThanOrEqual(farthestReach() + 1e-3);
    expect(farthest).toBeGreaterThan(farthestReach() * 0.5);
  });

  it("움직이는 방향과 직각으로 빠르게 이어 쳐서 흔들림을 키워도 정해진 범위를 넘지 않는다", () => {
    let swing = restingSwing();
    let farthest = 0;

    for (let i = 0; i < 50; i++) {
      const sideways = swing.velocity.clone().cross(UP);
      const push =
        sideways.lengthSq() > 0 ? sideways.normalize() : new Vector3(-1, 0, 0);

      swing = hit(swing, push.multiplyScalar(-radius), normal);

      for (const position of track(swing, 0.1, normal)) {
        farthest = Math.max(farthest, Math.hypot(position.x, position.z));
      }

      swing = advance(swing, 0.1, normal);
    }

    expect(farthest).toBeLessThanOrEqual(farthestReach() + 1e-3);
    expect(farthest).toBeGreaterThan(farthestReach() * 0.5);
  });

  it("흔들림은 저절로 잦아든다", () => {
    const struck = hit(restingSwing(), RIGHT, normal);

    expect(advance(struck, 30, normal).fromPivot.distanceTo(REST)).toBeLessThan(
      0.01,
    );
  });

  it("동작 줄이기에서는 조금만 밀리고 1초 안에 제자리로 돌아온다", () => {
    for (const blow of [jab(RIGHT), swipe(TO_THE_RIGHT, FASTEST_SWIPE)]) {
      const struck = strike(restingSwing(), blow, reduced).swing;

      expect(largestOffset(track(struck, 1, reduced))).toBeLessThan(0.03);
      expect(
        advance(struck, 1, reduced).fromPivot.distanceTo(REST),
      ).toBeLessThan(0.001);
    }
  });

  it("프레임 속도와 관계없이 같은 흔들림이 된다", () => {
    const struck = hit(restingSwing(), RIGHT, normal);
    const atOnce = advance(struck, 1.5, normal).fromPivot;

    for (const fps of [60, 144]) {
      let byFrames = struck;

      for (let i = 0; i < 1.5 * fps; i++) {
        byFrames = advance(byFrames, 1 / fps, normal);
      }

      expect(byFrames.fromPivot.distanceTo(atOnce)).toBeLessThan(0.01);
    }
  });
});

describe("타격 세기", () => {
  const strengthOf = (swing: Swing, blow: Blow, feel: SwingFeel = normal) =>
    strike(swing, blow, feel).strike.strength;

  it("가장 빠른 휘두르기로 멈춘 공을 치면 1 이고, 잽은 그보다 약하다", () => {
    const jabbed = strengthOf(restingSwing(), jab(RIGHT));

    expect(strengthOf(restingSwing(), swipe(TO_THE_RIGHT, FASTEST_SWIPE))).toBe(
      1,
    );
    expect(jabbed).toBeGreaterThan(0.2);
    expect(jabbed).toBeLessThan(0.6);
  });

  it("빨리 휘두를수록 세다", () => {
    expect(strengthOf(restingSwing(), swipe(TO_THE_RIGHT, 1.5))).toBeLessThan(
      strengthOf(restingSwing(), swipe(TO_THE_RIGHT, 2.5)),
    );
  });

  it("멀어지는 공을 쫓아가 치면 약하고, 되돌아오는 공을 맞받아치면 세다", () => {
    const still = strengthOf(restingSwing(), jab(RIGHT));
    const chased = strengthOf(moving(new Vector3(-1, 0, 0)), jab(RIGHT));
    const met = strengthOf(moving(new Vector3(1, 0, 0)), jab(RIGHT));

    expect(chased).toBeLessThan(still * 0.5);
    expect(met).toBeGreaterThan(still * 1.5);
  });

  it("주먹보다 빨리 멀어지는 공을 치면 0 이다", () => {
    expect(strengthOf(moving(new Vector3(-1.4, 0, 0)), jab(RIGHT))).toBe(0);
  });

  it("동작 줄이기에서도 같은 손놀림이면 같은 세기다", () => {
    for (const blow of [jab(RIGHT), swipe(TO_THE_RIGHT, 2)]) {
      expect(strengthOf(restingSwing(), blow, reduced)).toBeCloseTo(
        strengthOf(restingSwing(), blow, normal),
        9,
      );
    }
  });
});

function hitOffsets(count: number): Vector3[] {
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const turn = i * Math.PI * (3 - Math.sqrt(5));

    return new Vector3(
      Math.cos(turn) * ring,
      y,
      Math.sin(turn) * ring,
    ).multiplyScalar(radius);
  });
}
