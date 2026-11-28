import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { advanceBall, type BallMotion, restingBall, strikeBall } from "./ball";
import { CHAIN_REACH } from "./measurements";
import { type Blow, farthestReach, SWING_FEEL } from "./swing";

const radius = 0.3;
const REST = new Vector3(0, -CHAIN_REACH, 0);
const FRONT = new Vector3(0, 0, radius);
const RIGHT = new Vector3(radius, 0, 0);
const UNDER = new Vector3(0, -radius, 0);
const FRAME = 1 / 60;
const UP = new Vector3(0, 1, 0);
const TO_THE_RIGHT = new Vector3(1, 0, 0);
const FASTEST_SWIPE = 100;

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

// 흔들림만 보도록, 맞은 직후의 히트스톱은 바로 흘려보냅니다.
function struckBy(motion: BallMotion, blow: Blow): BallMotion {
  const struck = strikeBall(motion, blow).motion;

  return advanceBall(struck, struck.hitStopLeft).motion;
}

function hit(motion: BallMotion, at: Vector3): BallMotion {
  return struckBy(motion, jab(at));
}

function advanced(motion: BallMotion, seconds: number): BallMotion {
  return advanceBall(motion, seconds).motion;
}

function track(motion: BallMotion, seconds: number): Vector3[] {
  const positions: Vector3[] = [];
  let current = motion;

  for (let t = 0; t < seconds; t += FRAME) {
    current = advanced(current, FRAME);
    positions.push(current.swing.fromPivot);
  }

  return positions;
}

function moving(velocity: Vector3): BallMotion {
  const rest = restingBall();

  return { ...rest, swing: { ...rest.swing, velocity } };
}

function largestOffset(positions: Vector3[]): number {
  return Math.max(...positions.map((position) => position.distanceTo(REST)));
}

describe("swing", () => {
  it("치지 않으면 제자리에 멈춰 있다", () => {
    const after = advanced(restingBall(), 5);

    expect(after.swing.fromPivot.distanceTo(REST)).toBeLessThan(1e-9);
  });

  it("멈춘 공을 잽으로 치면 10 cm 남짓만 밀린다", () => {
    const offset = largestOffset(track(hit(restingBall(), RIGHT), 2));

    expect(offset).toBeGreaterThan(0.08);
    expect(offset).toBeLessThan(0.12);
  });

  it("앞면 가운데를 잽으로 치면 뒤로 밀린다", () => {
    const struck = hit(restingBall(), FRONT);
    const after = advanced(struck, 0.4);

    expect(after.swing.fromPivot.z).toBeLessThan(-0.05);
    expect(Math.abs(after.swing.fromPivot.x)).toBeLessThan(1e-9);
  });

  it("오른쪽 가장자리를 잽으로 치면 왼쪽으로 밀린다", () => {
    const struck = hit(restingBall(), RIGHT);
    const after = advanced(struck, 0.4);

    expect(after.swing.fromPivot.x).toBeLessThan(-0.05);
    expect(Math.abs(after.swing.fromPivot.z)).toBeLessThan(1e-9);
  });

  it("잽으로 올려 쳐서는 1 cm 도 들리지 않는다", () => {
    const struck = hit(restingBall(), UNDER);
    const highest = Math.max(...track(struck, 1).map((position) => position.y));

    expect(highest).toBeGreaterThan(REST.y);
    expect(highest).toBeLessThan(REST.y + 0.01);
  });

  it("세게 올려 치면 공이 들려 사슬이 느슨해졌다가, 떨어져 다시 팽팽해진다", () => {
    const struck = struckBy(restingBall(), swipe(UP, FASTEST_SWIPE));
    const lifted = advanced(struck, 0.08);

    expect(lifted.swing.fromPivot.y).toBeGreaterThan(REST.y + 0.02);
    expect(lifted.swing.fromPivot.length()).toBeLessThan(CHAIN_REACH - 0.02);

    const fallen = advanced(lifted, 1);

    expect(fallen.swing.fromPivot.length()).toBeCloseTo(CHAIN_REACH, 9);
  });

  it("휘두르면 맞은 자리와 관계없이 끈 방향으로 밀린다", () => {
    const blow: Blow = {
      kind: "swipe",
      hitFromCenter: FRONT,
      fist: TO_THE_RIGHT,
      speed: 2,
    };
    const after = advanced(struckBy(restingBall(), blow), 0.4);

    expect(after.swing.fromPivot.x).toBeGreaterThan(0.05);
    expect(Math.abs(after.swing.fromPivot.z)).toBeLessThan(1e-9);
  });

  it("빨리 휘두를수록 멀리 밀리지만, 아무리 빨리 휘둘러도 한 번에 25 cm 남짓까지만 밀린다", () => {
    const reach = (speed: number) =>
      largestOffset(
        track(struckBy(restingBall(), swipe(TO_THE_RIGHT, speed)), 2),
      );

    expect(reach(1.5)).toBeLessThan(reach(2.5));
    expect(reach(FASTEST_SWIPE)).toBeGreaterThan(0.2);
    expect(reach(FASTEST_SWIPE)).toBeLessThan(0.28);
    expect(reach(FASTEST_SWIPE)).toBeCloseTo(reach(FASTEST_SWIPE / 10), 9);
  });

  it("사슬은 늘어나지 않는다", () => {
    let motion = restingBall();

    for (const offset of hitOffsets(60)) {
      motion = struckBy(motion, swipe(offset.clone().negate(), FASTEST_SWIPE));

      for (const position of track(motion, 0.3)) {
        expect(position.length()).toBeLessThanOrEqual(CHAIN_REACH + 1e-9);
      }

      motion = advanced(motion, 0.3);
    }
  });

  it("빠르게 되돌아오는 공은 맞받아쳐도 늦추기만 하고, 천천히 되돌아오는 공은 되밀린다", () => {
    const fast = hit(moving(new Vector3(0.5, 0, 0)), RIGHT);
    const slow = hit(moving(new Vector3(0.2, 0, 0)), RIGHT);

    expect(fast.swing.velocity.x).toBeGreaterThan(0);
    expect(fast.swing.velocity.x).toBeLessThan(0.5);
    expect(slow.swing.velocity.x).toBeLessThan(0);
  });

  it("공이 주먹보다 빨리 멀어지고 있으면 쳐도 흔들림이 바뀌지 않는다", () => {
    const leaving = moving(new Vector3(-1.4, 0, 0));
    const untouched = advanced(leaving, 1);
    const struck = advanced(hit(leaving, RIGHT), 1);

    expect(
      struck.swing.fromPivot.distanceTo(untouched.swing.fromPivot),
    ).toBeLessThan(1e-9);
  });

  it("같은 자리를 빠르게 연달아 치면 흔들림이 쌓여, 열 번쯤이면 45 cm 남짓 밀린다", () => {
    const flurry = (jabs: number) => {
      let motion = restingBall();

      for (let i = 0; i < jabs; i++) {
        motion = advanced(hit(motion, RIGHT), 0.05);
      }

      return largestOffset(track(motion, 3));
    };

    expect(flurry(2)).toBeGreaterThan(flurry(1) * 1.5);
    expect(flurry(10)).toBeGreaterThan(0.38);
    expect(flurry(10)).toBeLessThan(0.52);
  });

  it("맞은 직후 공이 주먹 방향으로 가는 빠르기는 주먹보다 빠르지 않다", () => {
    let motion = restingBall();

    for (let i = 0; i < 40; i++) {
      motion = hit(motion, RIGHT);
      expect(-motion.swing.velocity.x).toBeLessThanOrEqual(
        SWING_FEEL.fistSpeed + 1e-9,
      );
      motion = advanced(motion, 0.05);
    }
  });

  it("어디로 몇 번 휘두르든 공은 정해진 범위 안에서 흔들린다", () => {
    let motion = restingBall();
    let farthest = 0;

    for (const [i, offset] of hitOffsets(400).entries()) {
      motion = struckBy(motion, swipe(offset.clone().negate(), FASTEST_SWIPE));

      for (const position of track(motion, 0.05 + (i % 7) * 0.12)) {
        farthest = Math.max(farthest, Math.hypot(position.x, position.z));
      }

      motion = advanced(motion, 0.05 + (i % 7) * 0.12);
    }

    expect(farthest).toBeLessThanOrEqual(farthestReach() + 1e-3);
    expect(farthest).toBeGreaterThan(0.25);
  });

  it("움직이는 방향과 직각으로 빠르게 이어 쳐서 흔들림을 키워도 정해진 범위를 넘지 않는다", () => {
    let motion = restingBall();
    let farthest = 0;

    for (let i = 0; i < 50; i++) {
      const sideways = motion.swing.velocity.clone().cross(UP);
      const push =
        sideways.lengthSq() > 0 ? sideways.normalize() : new Vector3(-1, 0, 0);

      motion = struckBy(motion, swipe(push, FASTEST_SWIPE));

      for (const position of track(motion, 0.1)) {
        farthest = Math.max(farthest, Math.hypot(position.x, position.z));
      }

      motion = advanced(motion, 0.1);
    }

    expect(farthest).toBeLessThanOrEqual(farthestReach() + 1e-3);
    expect(farthest).toBeGreaterThan(farthestReach() * 0.5);
  });

  it("무거워서 흔들림이 오래 가고, 5초쯤 지나야 절반으로 줄어든다", () => {
    const struck = hit(restingBall(), RIGHT);
    const first = largestOffset(track(struck, 2));
    const fiveSecondsLater = largestOffset(track(advanced(struck, 4.4), 2.5));

    expect(fiveSecondsLater / first).toBeGreaterThan(0.4);
    expect(fiveSecondsLater / first).toBeLessThan(0.6);
  });

  it("흔들림은 저절로 잦아든다", () => {
    const struck = hit(restingBall(), RIGHT);

    expect(advanced(struck, 30).swing.fromPivot.distanceTo(REST)).toBeLessThan(
      0.01,
    );
  });

  it("프레임 속도와 관계없이 같은 흔들림이 된다", () => {
    const struck = hit(restingBall(), RIGHT);
    const atOnce = advanced(struck, 1.5).swing.fromPivot;

    for (const fps of [60, 144]) {
      let byFrames = struck;

      for (let i = 0; i < 1.5 * fps; i++) {
        byFrames = advanced(byFrames, 1 / fps);
      }

      expect(byFrames.swing.fromPivot.distanceTo(atOnce)).toBeLessThan(0.01);
    }
  });
});

describe("덜컹", () => {
  function watch(motion: BallMotion, seconds: number) {
    const jolts: { frame: number; strength: number }[] = [];
    const heights: number[] = [];
    let current = motion;

    for (let i = 0; i * FRAME < seconds; i++) {
      const { motion: next, jolt } = advanceBall(current, FRAME);

      current = next;
      heights.push(current.swing.fromPivot.y);

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
    expect(last.swing.fromPivot.length()).toBeCloseTo(CHAIN_REACH, 9);
    expect(advanceBall(last, 1).jolt).toBeNull();
  });

  it("세게 올려 칠수록 세게 덜컹한다", () => {
    const firstJolt = (blow: Blow) =>
      watch(struckBy(restingBall(), blow), 1.5).jolts[0]?.strength ?? 0;

    expect(firstJolt(swipe(UP, FASTEST_SWIPE))).toBeGreaterThan(
      firstJolt(swipe(UP, 2.5)),
    );
    expect(firstJolt(swipe(UP, 2.5))).toBeGreaterThan(0);
    expect(firstJolt(swipe(UP, FASTEST_SWIPE))).toBeGreaterThan(0.8);
  });

  it("잽으로 올려 쳐서는 덜컹하지 않는다", () => {
    expect(watch(hit(restingBall(), UNDER), 2).jolts).toEqual([]);
  });

  it("가만히 매달려 있거나 팽팽한 사슬에 매달려 흔들리는 동안에는 덜컹하지 않는다", () => {
    expect(watch(restingBall(), 3).jolts).toEqual([]);
    expect(watch(hit(restingBall(), RIGHT), 3).jolts).toEqual([]);

    for (const blow of [
      jab(RIGHT),
      jab(FRONT),
      swipe(TO_THE_RIGHT, FASTEST_SWIPE),
    ]) {
      expect(watch(struckBy(restingBall(), blow), 5).jolts).toEqual([]);
    }
  });
});

describe("타격 세기", () => {
  const strengthOf = (motion: BallMotion, blow: Blow) =>
    strikeBall(motion, blow).strength;

  it("가장 빠른 휘두르기로 멈춘 공을 치면 1 이고, 잽은 그보다 약하다", () => {
    const jabbed = strengthOf(restingBall(), jab(RIGHT));

    expect(strengthOf(restingBall(), swipe(TO_THE_RIGHT, FASTEST_SWIPE))).toBe(
      1,
    );
    expect(jabbed).toBeGreaterThan(0.2);
    expect(jabbed).toBeLessThan(0.6);
  });

  it("빨리 휘두를수록 세다", () => {
    expect(strengthOf(restingBall(), swipe(TO_THE_RIGHT, 1.5))).toBeLessThan(
      strengthOf(restingBall(), swipe(TO_THE_RIGHT, 2.5)),
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
    const still = strengthOf(restingBall(), jab(RIGHT));
    const chased = strengthOf(moving(new Vector3(-1, 0, 0)), jab(RIGHT));
    const met = strengthOf(moving(new Vector3(1, 0, 0)), jab(RIGHT));

    expect(chased).toBeLessThan(still * 0.5);
    expect(met).toBeGreaterThan(still * 1.5);
  });

  it("주먹보다 빨리 멀어지는 공을 치면 0 이다", () => {
    expect(strengthOf(moving(new Vector3(-1.4, 0, 0)), jab(RIGHT))).toBe(0);
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
