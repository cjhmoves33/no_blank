import type { Blow } from "@no-blank/ball-motion";
import { Plane, Ray, type Sphere, Vector3 } from "three";

export interface PointerSample {
  readonly ray: Ray;
  readonly seconds: number;
}

export type Press =
  | { readonly kind: "spent" }
  | {
      readonly kind: "swiping";
      readonly latest: PointerSample;
      readonly withinSpeedWindow: readonly PointerSample[];
    };

/** 레킹볼이 차지한 모양입니다. 구에서 납작한 덮개(lid) 바깥쪽을 잘라 낸 모양입니다. */
export interface BallShape {
  readonly sphere: Sphere;
  readonly lid: Plane;
}

export interface PressStep {
  readonly press: Press;
  readonly blow: Blow | null;
}

type Swiping = Extract<Press, { kind: "swiping" }>;

const MIN_SWIPE_SPEED = 0.5;

const SPEED_WINDOW_SECONDS = 0.05;

const SPENT: Press = { kind: "spent" };

export function touches(ray: Ray, ball: BallShape): boolean {
  return entryOf(ray, ball) !== null;
}

export function pressDown(sample: PointerSample, ball: BallShape): PressStep {
  const hit = entryOf(sample.ray, ball);

  if (!hit) {
    return {
      press: { kind: "swiping", latest: sample, withinSpeedWindow: [] },
      blow: null,
    };
  }

  return {
    press: SPENT,
    blow: {
      kind: "jab",
      hitFromCenter: hit.sub(ball.sphere.center),
      fist: sample.ray.direction.clone().normalize(),
    },
  };
}

export function dragTo(
  press: Press,
  sample: PointerSample,
  ball: BallShape,
): PressStep {
  if (press.kind === "spent") {
    return { press, blow: null };
  }

  const entry = enteredAt(
    {
      eye: press.latest.ray.origin,
      from: press.latest.ray.direction,
      to: sample.ray.direction,
    },
    ball,
  );
  const hand = entry ? handVelocity(press, sample, ball) : null;

  if (!entry || !hand || hand.length() < MIN_SWIPE_SPEED) {
    return { press: movedOn(press, sample), blow: null };
  }

  return {
    press: SPENT,
    blow: {
      kind: "swipe",
      hitFromCenter: (entryOf(sample.ray, ball) ?? entry).sub(
        ball.sphere.center,
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
    withinSpeedWindow: recent(
      [...press.withinSpeedWindow, press.latest],
      sample,
    ),
  };
}

function recent(
  samples: readonly PointerSample[],
  now: PointerSample,
): PointerSample[] {
  return samples.filter(
    (sample) => sample.seconds >= now.seconds - SPEED_WINDOW_SECONDS,
  );
}

interface CursorPath {
  readonly eye: Vector3;
  readonly from: Vector3;
  readonly to: Vector3;
}

function entryOf(ray: Ray, { sphere, lid }: BallShape): Vector3 | null {
  const onSphere = ray.intersectSphere(sphere, new Vector3());

  if (!onSphere) {
    return null;
  }

  if (lid.distanceToPoint(onSphere) <= 0) {
    return onSphere;
  }

  const onLid = ray.intersectPlane(lid, new Vector3());

  return onLid && sphere.containsPoint(onLid) ? onLid : null;
}

// 구로 들어가는 순간을 먼저 구하고, 그 자리가 덮개 위의 빈 곳이면 이번 이벤트의 끝 커서로 다시 봅니다.
function enteredAt(path: CursorPath, ball: BallShape): Vector3 | null {
  if (entryOf(new Ray(path.eye, path.from.clone().normalize()), ball)) {
    return null;
  }

  const onSphere = firstEntry(path, ball.sphere);
  const throughSphere = onSphere
    ? entryOf(
        new Ray(path.eye, onSphere.clone().sub(path.eye).normalize()),
        ball,
      )
    : null;

  return (
    throughSphere ??
    entryOf(new Ray(path.eye, path.to.clone().normalize()), ball)
  );
}

function firstEntry(
  { eye, from, to }: CursorPath,
  ball: Sphere,
): Vector3 | null {
  const toCenter = ball.center.clone().sub(eye);
  const turn = to.clone().sub(from);
  const t = firstRootUpToOne(
    entryQuadratic({ toCenter, radius: ball.radius, from, turn }),
  );

  if (t === null) {
    return null;
  }

  const direction = from.clone().addScaledVector(turn, t).normalize();
  const ahead = toCenter.dot(direction);

  if (ahead <= 0) {
    return null;
  }

  const closest = eye.clone().addScaledVector(direction, ahead);

  return closest.sub(ball.center).setLength(ball.radius).add(ball.center);
}

interface Quadratic {
  readonly square: number;
  readonly linear: number;
  readonly constant: number;
}

function entryQuadratic({
  toCenter,
  radius,
  from,
  turn,
}: {
  readonly toCenter: Vector3;
  readonly radius: number;
  readonly from: Vector3;
  readonly turn: Vector3;
}): Quadratic {
  const outside = toCenter.lengthSq() - radius ** 2;
  const fromAlong = toCenter.dot(from);
  const turnAlong = toCenter.dot(turn);

  return {
    square: outside * turn.lengthSq() - turnAlong ** 2,
    linear: 2 * (outside * from.dot(turn) - fromAlong * turnAlong),
    constant: outside * from.lengthSq() - fromAlong ** 2,
  };
}

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

function handVelocity(
  press: Swiping,
  sample: PointerSample,
  { sphere: ball }: BallShape,
): Vector3 | null {
  const [oldest = press.latest] = recent(
    [...press.withinSpeedWindow, press.latest],
    sample,
  );
  const seconds = Math.min(
    sample.seconds - oldest.seconds,
    SPEED_WINDOW_SECONDS,
  );
  const ballFacingPlane = new Plane().setFromNormalAndCoplanarPoint(
    sample.ray.origin.clone().sub(ball.center).normalize(),
    ball.center,
  );
  const from = oldest.ray.intersectPlane(ballFacingPlane, new Vector3());
  const to = sample.ray.intersectPlane(ballFacingPlane, new Vector3());

  if (!from || !to || seconds <= 0) {
    return null;
  }

  return to.sub(from).divideScalar(seconds);
}
