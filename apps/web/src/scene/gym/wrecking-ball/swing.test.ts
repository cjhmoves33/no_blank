import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { GYM } from "../measurements";
import {
  advance,
  type Blow,
  CHAIN_REACH,
  farthestReach,
  joltOf,
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

function jab(hitFromCenter: Vector3): Blow {
  return {
    kind: "jab",
    hitFromCenter,
    fist: hitFromCenter.clone().negate().normalize(),
  };
}

function swipe(fist: Vector3, speed: number): Blow {
  return {
    kind: "swipe",
    hitFromCenter: fist.clone().negate().setLength(radius),
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

  it("멈춘 공을 잽으로 치면 10 cm 남짓만 밀린다", () => {
    const offset = largestOffset(
      track(hit(restingSwing(), RIGHT, normal), 2, normal),
    );

    expect(offset).toBeGreaterThan(0.08);
    expect(offset).toBeLessThan(0.12);
  });

  it("앞면 가운데를 잽으로 치면 뒤로 밀린다", () => {
    const struck = hit(restingSwing(), FRONT, normal);
    const after = advance(struck, 0.4, normal);

    expect(after.fromPivot.z).toBeLessThan(-0.05);
    expect(Math.abs(after.fromPivot.x)).toBeLessThan(1e-9);
  });

  it("오른쪽 가장자리를 잽으로 치면 왼쪽으로 밀린다", () => {
    const struck = hit(restingSwing(), RIGHT, normal);
    const after = advance(struck, 0.4, normal);

    expect(after.fromPivot.x).toBeLessThan(-0.05);
    expect(Math.abs(after.fromPivot.z)).toBeLessThan(1e-9);
  });

  it("잽으로 올려 쳐서는 1 cm 도 들리지 않는다", () => {
    const struck = hit(restingSwing(), UNDER, normal);
    const highest = Math.max(
      ...track(struck, 1, normal).map((position) => position.y),
    );

    expect(highest).toBeGreaterThan(REST.y);
    expect(highest).toBeLessThan(REST.y + 0.01);
  });

  it("세게 올려 치면 공이 들려 사슬이 느슨해졌다가, 떨어져 다시 팽팽해진다", () => {
    const struck = strike(restingSwing(), swipe(UP, FASTEST_SWIPE), normal);
    const lifted = advance(struck.swing, 0.08, normal);

    expect(lifted.fromPivot.y).toBeGreaterThan(REST.y + 0.02);
    expect(lifted.fromPivot.length()).toBeLessThan(CHAIN_REACH - 0.02);

    const fallen = advance(lifted, 1, normal);

    expect(fallen.fromPivot.length()).toBeCloseTo(CHAIN_REACH, 9);
  });

  it("휘두르면 맞은 자리와 관계없이 끈 방향으로 밀린다", () => {
    const blow: Blow = {
      kind: "swipe",
      hitFromCenter: FRONT,
      fist: TO_THE_RIGHT,
      speed: 2,
    };
    const after = advance(
      strike(restingSwing(), blow, normal).swing,
      0.4,
      normal,
    );

    expect(after.fromPivot.x).toBeGreaterThan(0.05);
    expect(Math.abs(after.fromPivot.z)).toBeLessThan(1e-9);
  });

  it("빨리 휘두를수록 멀리 밀리지만, 아무리 빨리 휘둘러도 한 번에 25 cm 남짓까지만 밀린다", () => {
    const reach = (speed: number) =>
      largestOffset(
        track(
          strike(restingSwing(), swipe(TO_THE_RIGHT, speed), normal).swing,
          2,
          normal,
        ),
      );

    expect(reach(1.5)).toBeLessThan(reach(2.5));
    expect(reach(FASTEST_SWIPE)).toBeGreaterThan(0.2);
    expect(reach(FASTEST_SWIPE)).toBeLessThan(0.28);
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

  it("빠르게 되돌아오는 공은 맞받아쳐도 늦추기만 하고, 천천히 되돌아오는 공은 되밀린다", () => {
    const fast = hit(moving(new Vector3(0.5, 0, 0)), RIGHT, normal);
    const slow = hit(moving(new Vector3(0.2, 0, 0)), RIGHT, normal);

    expect(fast.velocity.x).toBeGreaterThan(0);
    expect(fast.velocity.x).toBeLessThan(0.5);
    expect(slow.velocity.x).toBeLessThan(0);
  });

  it("공이 주먹보다 빨리 멀어지고 있으면 쳐도 흔들림이 바뀌지 않는다", () => {
    const leaving = moving(new Vector3(-1.4, 0, 0));
    const untouched = advance(leaving, 1, normal);
    const struck = advance(hit(leaving, RIGHT, normal), 1, normal);

    expect(struck.fromPivot.distanceTo(untouched.fromPivot)).toBeLessThan(1e-9);
  });

  it("같은 자리를 빠르게 연달아 치면 흔들림이 쌓여, 열 번쯤이면 45 cm 남짓 밀린다", () => {
    const flurry = (jabs: number) => {
      let swing = restingSwing();

      for (let i = 0; i < jabs; i++) {
        swing = advance(hit(swing, RIGHT, normal), 0.05, normal);
      }

      return largestOffset(track(swing, 3, normal));
    };

    expect(flurry(2)).toBeGreaterThan(flurry(1) * 1.5);
    expect(flurry(10)).toBeGreaterThan(0.38);
    expect(flurry(10)).toBeLessThan(0.52);
  });

  it("맞은 직후 공이 주먹 방향으로 가는 빠르기는 주먹보다 빠르지 않다", () => {
    let swing = restingSwing();

    for (let i = 0; i < 40; i++) {
      swing = hit(swing, RIGHT, normal);
      expect(-swing.velocity.x).toBeLessThanOrEqual(normal.fistSpeed + 1e-9);
      swing = advance(swing, 0.05, normal);
    }
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
    expect(farthest).toBeGreaterThan(0.25);
  });

  it("움직이는 방향과 직각으로 빠르게 이어 쳐서 흔들림을 키워도 정해진 범위를 넘지 않는다", () => {
    let swing = restingSwing();
    let farthest = 0;

    for (let i = 0; i < 50; i++) {
      const sideways = swing.velocity.clone().cross(UP);
      const push =
        sideways.lengthSq() > 0 ? sideways.normalize() : new Vector3(-1, 0, 0);

      swing = strike(swing, swipe(push, FASTEST_SWIPE), normal).swing;

      for (const position of track(swing, 0.1, normal)) {
        farthest = Math.max(farthest, Math.hypot(position.x, position.z));
      }

      swing = advance(swing, 0.1, normal);
    }

    expect(farthest).toBeLessThanOrEqual(farthestReach() + 1e-3);
    expect(farthest).toBeGreaterThan(farthestReach() * 0.5);
  });

  it("무거워서 흔들림이 오래 가고, 5초쯤 지나야 절반으로 줄어든다", () => {
    const struck = hit(restingSwing(), RIGHT, normal);
    const first = largestOffset(track(struck, 2, normal));
    const fiveSecondsLater = largestOffset(
      track(advance(struck, 4.4, normal), 2.5, normal),
    );

    expect(fiveSecondsLater / first).toBeGreaterThan(0.4);
    expect(fiveSecondsLater / first).toBeLessThan(0.6);
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

describe("덜컹", () => {
  function watch(swing: Swing, seconds: number, feel: SwingFeel = normal) {
    const jolts: { frame: number; strength: number }[] = [];
    const heights: number[] = [];
    let current = swing;

    for (let i = 0; i * FRAME < seconds; i++) {
      current = advance(current, FRAME, feel);
      heights.push(current.fromPivot.y);

      const jolt = joltOf(current);

      if (jolt) {
        jolts.push({ frame: i, strength: jolt.strength });
      }
    }

    return { jolts, heights, last: current };
  }

  it("높이 들린 공이 떨어져 사슬이 팽팽해지면 덜컹 되튀고, 점점 작게 몇 번 덜컹하다 멈춘다", () => {
    const { jolts, heights, last } = watch(moving(new Vector3(0, 1.5, 0)), 2);
    const [first, second] = jolts;

    if (!first || !second) {
      throw new Error("덜컹이 두 번 이상 있어야 합니다.");
    }

    expect(second.strength).toBeLessThan(first.strength);
    expect(
      Math.max(...heights.slice(first.frame + 1, second.frame)),
    ).toBeGreaterThan((heights[first.frame] ?? 0) + 0.005);
    expect(last.fromPivot.length()).toBeCloseTo(CHAIN_REACH, 9);
    expect(joltOf(advance(last, 1, normal))).toBeNull();
  });

  it("세게 올려 칠수록 세게 덜컹한다", () => {
    const firstJolt = (blow: Blow) =>
      watch(strike(restingSwing(), blow, normal).swing, 1.5).jolts[0]
        ?.strength ?? 0;

    expect(firstJolt(swipe(UP, FASTEST_SWIPE))).toBeGreaterThan(
      firstJolt(swipe(UP, 2.5)),
    );
    expect(firstJolt(swipe(UP, 2.5))).toBeGreaterThan(0);
    expect(firstJolt(swipe(UP, FASTEST_SWIPE))).toBeGreaterThan(0.8);
  });

  it("잽으로 올려 쳐서는 덜컹하지 않는다", () => {
    expect(
      watch(strike(restingSwing(), jab(UNDER), normal).swing, 2).jolts,
    ).toEqual([]);
  });

  it("가만히 매달려 있거나 팽팽한 사슬에 매달려 흔들리는 동안에는 덜컹하지 않는다", () => {
    for (const feel of [normal, reduced]) {
      expect(watch(restingSwing(), 3, feel).jolts).toEqual([]);
      expect(watch(hit(restingSwing(), RIGHT, feel), 3, feel).jolts).toEqual(
        [],
      );
    }

    for (const blow of [
      jab(RIGHT),
      jab(FRONT),
      swipe(TO_THE_RIGHT, FASTEST_SWIPE),
    ]) {
      expect(
        watch(strike(restingSwing(), blow, normal).swing, 5).jolts,
      ).toEqual([]);
    }
  });

  it("동작 줄이기에서는 덜컹해도 되튀지 않는다", () => {
    const { jolts, heights } = watch(moving(new Vector3(0, 4, 0)), 1, reduced);
    const [first] = jolts;

    if (!first) {
      throw new Error("덜컹이 있어야 합니다.");
    }

    expect(Math.max(...heights.slice(first.frame))).toBeLessThan(
      REST.y + 0.001,
    );
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

  it("멀어지는 공을 아주 빠르게 휘둘러 쫓아가도, 다가가는 빠르기가 같으면 예전과 같은 세기다", () => {
    const away = (speed: number) => moving(new Vector3(speed, 0, 0));

    expect(strengthOf(away(0.68), swipe(TO_THE_RIGHT, 6.5))).toBe(1);
    expect(strengthOf(away(0.3), swipe(TO_THE_RIGHT, 3))).toBeCloseTo(
      2.7 / 3.25,
      9,
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
