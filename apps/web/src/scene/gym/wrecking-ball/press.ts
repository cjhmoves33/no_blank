import { Plane, type Ray, type Sphere, Vector3 } from "three";

import type { Blow } from "./swing";

/** 커서의 한 순간입니다. ray 는 카메라에서 커서를 지나는 광선, seconds 는 포인터 이벤트의 시각(초)입니다. */
export interface PointerSample {
  readonly ray: Ray;
  readonly seconds: number;
}

/**
 * 주 버튼을 누르고 있는 동안의 손입니다. 버튼을 놓으면 버립니다.
 * - spent: 이번 누름으로는 더 치지 않습니다. 잽을 쳤거나, 휘두르기로 이미 맞혔습니다.
 * - swiping: 레킹볼 밖에서 눌러 끄는 중입니다. 커서가 레킹볼 밖에서 안으로 들어가는 순간을 기다립니다.
 *   레킹볼이 커서 밑으로 흔들려 와서 커서가 이미 레킹볼 위에 있으면, 커서가 나갔다가 다시 들어와야 칩니다.
 */
export type Press =
  | { readonly kind: "spent" }
  | {
      readonly kind: "swiping";
      readonly latest: PointerSample;
      /** latest 앞의 커서 가운데 HAND_WINDOW 안에 든 것입니다. 끄는 빠르기를 재는 데만 씁니다. */
      readonly earlier: readonly PointerSample[];
    };

export interface PressStep {
  readonly press: Press;
  /** 이 순간 레킹볼에 닿은 주먹입니다. 닿지 않았으면 null 입니다. */
  readonly blow: Blow | null;
}

type Swiping = Extract<Press, { kind: "swiping" }>;

/** 이보다 느리게 끌면 레킹볼에 들어가도 치지 않습니다(m/s, 레킹볼 깊이에서). */
const MIN_SWIPE_SPEED = 0.5;

// 포인터 이벤트 간격이 고르지 않아 한 구간만 보면 빠르기가 튀므로, 이 시간(초) 동안의 커서로 잽니다.
const HAND_WINDOW = 0.05;

const SPENT: Press = { kind: "spent" };

/** 커서가 레킹볼 위에 있는지입니다. 잽과 커서 모양이 이 기준 하나를 함께 씁니다. */
export function touches(ray: Ray, ball: Sphere): boolean {
  return ray.intersectsSphere(ball);
}

/** 주 버튼을 누른 순간입니다. 레킹볼 위면 잽을 치고, 밖이면 휘두르기를 기다립니다. */
export function pressDown(sample: PointerSample, ball: Sphere): PressStep {
  const hit = sample.ray.intersectSphere(ball, new Vector3());

  if (!hit) {
    return {
      press: { kind: "swiping", latest: sample, earlier: [] },
      blow: null,
    };
  }

  return {
    press: SPENT,
    blow: {
      kind: "jab",
      at: hit.sub(ball.center),
      fist: sample.ray.direction.clone().normalize(),
    },
  };
}

/**
 * 주 버튼을 누른 채 커서가 움직인 순간입니다. ball 은 지금 자리입니다(끄는 동안에도 레킹볼은 흔들립니다).
 * 한 번 누르는 동안 많아야 한 번 칩니다. 너무 느리게 들어가면 치지 않고, 나갔다가 다시 들어올 때 다시 봅니다.
 */
export function dragTo(
  press: Press,
  sample: PointerSample,
  ball: Sphere,
): PressStep {
  if (press.kind === "spent") {
    return { press, blow: null };
  }

  const entry = firstEntry(press.latest.ray, sample.ray, ball);
  const hand = entry ? handVelocity(press, sample, ball) : null;

  if (!entry || !hand || hand.length() < MIN_SWIPE_SPEED) {
    return { press: movedOn(press, sample), blow: null };
  }

  return {
    press: SPENT,
    blow: {
      kind: "swipe",
      at: (sample.ray.intersectSphere(ball, new Vector3()) ?? entry).sub(
        ball.center,
      ),
      fist: hand.clone().normalize(),
      speed: hand.length(),
    },
  };
}

function movedOn(press: Swiping, sample: PointerSample): Press {
  return {
    kind: "swiping",
    latest: sample,
    earlier: recent([...press.earlier, press.latest], sample),
  };
}

function recent(
  samples: readonly PointerSample[],
  now: PointerSample,
): PointerSample[] {
  return samples.filter(
    (sample) => sample.seconds >= now.seconds - HAND_WINDOW,
  );
}

/**
 * 커서가 from 광선에서 to 광선으로 곧게 움직이는 동안 처음 레킹볼에 닿는 가장자리의 점입니다. 닿지 않으면 null 입니다.
 * 빠르게 끌면 이벤트 사이에 수십 픽셀을 건너뛰므로, 두 끝점만 보지 않고 그 사이 길 전체를 봅니다.
 * 왼쪽으로 끄는 동안 카메라는 돌지 않으므로, 두 광선이 같은 곳(from.origin)에서 나온다고 봅니다.
 */
function firstEntry(from: Ray, to: Ray, ball: Sphere): Vector3 | null {
  const toCenter = ball.center.clone().sub(from.origin);
  const outside = toCenter.lengthSq() - ball.radius ** 2;
  const start = from.direction;
  const turn = to.direction.clone().sub(start);
  const startAlong = toCenter.dot(start);
  const turnAlong = toCenter.dot(turn);
  // 광선 방향 d(t) = start + t·turn 이 공에 닿을 조건 (|중심|² − r²)|d|² − (중심·d)² ≤ 0 을 t 의 이차식으로 풉니다.
  const t = firstRootUpToOne({
    square: outside * turn.lengthSq() - turnAlong ** 2,
    linear: 2 * (outside * start.dot(turn) - startAlong * turnAlong),
    constant: outside * start.lengthSq() - startAlong ** 2,
  });

  if (t === null) {
    return null;
  }

  const direction = start.clone().addScaledVector(turn, t).normalize();
  const ahead = toCenter.dot(direction);

  if (ahead <= 0) {
    return null;
  }

  const closest = from.origin.clone().addScaledVector(direction, ahead);

  return closest.sub(ball.center).setLength(ball.radius).add(ball.center);
}

interface Quadratic {
  readonly square: number;
  readonly linear: number;
  readonly constant: number;
}

/** 0 에서 양수인 이차식이 처음 0 이 되는 t 를 [0, 1] 안에서 찾습니다. 0 에서 이미 0 이하면(처음부터 닿아 있으면) null 입니다. */
function firstRootUpToOne({
  square,
  linear,
  constant,
}: Quadratic): number | null {
  if (constant <= 0) {
    return null;
  }

  const roots =
    Math.abs(square) < 1e-12
      ? [-constant / linear]
      : quadraticRoots(square, linear, constant);

  return (
    roots
      .filter((t) => Number.isFinite(t) && t >= 0 && t <= 1)
      .sort((a, b) => a - b)[0] ?? null
  );
}

function quadraticRoots(a: number, b: number, c: number): number[] {
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return [];
  }

  const root = Math.sqrt(discriminant);

  return [(-b - root) / (2 * a), (-b + root) / (2 * a)];
}

/**
 * 레킹볼 중심을 지나며 카메라를 마주 보는 평면에 커서 길을 옮겨 잰 손의 속도(m/s)입니다.
 * 가만히 있다가 바로 끌면 앞선 커서가 오래전 것이라 빠르기가 작게 나오므로, 시간 차이는 HAND_WINDOW 를 넘지 않게 자릅니다.
 */
function handVelocity(
  press: Swiping,
  sample: PointerSample,
  ball: Sphere,
): Vector3 | null {
  const [oldest = press.latest] = recent(
    [...press.earlier, press.latest],
    sample,
  );
  const seconds = Math.min(sample.seconds - oldest.seconds, HAND_WINDOW);
  const facing = new Plane().setFromNormalAndCoplanarPoint(
    sample.ray.origin.clone().sub(ball.center).normalize(),
    ball.center,
  );
  const from = oldest.ray.intersectPlane(facing, new Vector3());
  const to = sample.ray.intersectPlane(facing, new Vector3());

  if (!from || !to || seconds <= 0) {
    return null;
  }

  return to.sub(from).divideScalar(seconds);
}
