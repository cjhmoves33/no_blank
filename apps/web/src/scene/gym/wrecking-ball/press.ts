import { Plane, type Ray, type Sphere, Vector3 } from "three";

import type { Blow } from "./swing";

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

export interface PressStep {
  readonly press: Press;
  readonly blow: Blow | null;
}

type Swiping = Extract<Press, { kind: "swiping" }>;

const MIN_SWIPE_SPEED = 0.5;

const SPEED_WINDOW_SECONDS = 0.05;

const SPENT: Press = { kind: "spent" };

export function touches(ray: Ray, ball: Sphere): boolean {
  return ray.intersectsSphere(ball);
}

export function pressDown(sample: PointerSample, ball: Sphere): PressStep {
  const hit = sample.ray.intersectSphere(ball, new Vector3());

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
      hitFromCenter: hit.sub(ball.center),
      fist: sample.ray.direction.clone().normalize(),
    },
  };
}

export function dragTo(
  press: Press,
  sample: PointerSample,
  ball: Sphere,
): PressStep {
  if (press.kind === "spent") {
    return { press, blow: null };
  }

  const entry = firstEntry(
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
      hitFromCenter: (
        sample.ray.intersectSphere(ball, new Vector3()) ?? entry
      ).sub(ball.center),
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
  ball: Sphere,
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
