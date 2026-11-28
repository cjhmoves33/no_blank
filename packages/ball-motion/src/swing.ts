import { Vector3 } from "three";

import { CHAIN_REACH } from "./measurements";

export interface Swing {
  readonly fromPivot: Vector3;
  readonly velocity: Vector3;
}

export type Blow =
  | {
      readonly kind: "jab";
      readonly hitFromCenter: Vector3;
      readonly fist: Vector3;
    }
  | {
      readonly kind: "swipe";
      readonly hitFromCenter: Vector3;
      readonly fist: Vector3;
      readonly speed: number;
    };

interface Strike {
  readonly strength: number;
}

export interface Jolt {
  readonly strength: number;
}

export interface Struck {
  readonly swing: Swing;
  readonly strike: Strike;
  readonly push: Vector3;
}

export const STRAIGHT_CHAIN_AXIS = new Vector3(0, 1, 0);

const JAB_SPEED = 1.3;

const HARDEST_SWIPE_IN_JABS = 2.5;

const JOLT_MARGIN = 0.3;

export const SWING_FEEL = {
  fistSpeed: JAB_SPEED,
  closingSpeedShare: 0.21,
  maxBottomSpeed: 2.4,
  gravity: 9.81,
  drag: dragHalvingSwingIn(5),
  rebound: 0.35,
} as const;

const HARDEST_SWIPE_LAUNCH_SPEED =
  JAB_SPEED * HARDEST_SWIPE_IN_JABS * SWING_FEEL.closingSpeedShare;

const HIGHEST_RISE = SWING_FEEL.maxBottomSpeed ** 2 / (2 * SWING_FEEL.gravity);

export const STEP = 1 / 240;

const SLOWDOWN_PER_STEP = Math.exp(-SWING_FEEL.drag * STEP);

const CAUGHT_EVERY_STEP = SWING_FEEL.gravity * STEP;

const JOLT_ABOVE = JOLT_MARGIN + CAUGHT_EVERY_STEP;

export function restingSwing(): Swing {
  return {
    fromPivot: new Vector3(0, -CHAIN_REACH, 0),
    velocity: new Vector3(),
  };
}

export function strike(swing: Swing, blow: Blow): Struck {
  const { push, speed } = fistOf(blow);
  const along = swing.velocity.dot(push);

  if (along >= speed) {
    return { swing, strike: { strength: 0 }, push };
  }

  const closing = speed - along;
  const hardest = SWING_FEEL.fistSpeed * HARDEST_SWIPE_IN_JABS;
  const velocity = capSwingEnergy(
    swing.fromPivot,
    swing.velocity
      .clone()
      .addScaledVector(
        push,
        Math.min(closing, hardest) * SWING_FEEL.closingSpeedShare,
      ),
  );

  return {
    swing: { ...swing, velocity },
    strike: { strength: Math.min(closing / hardest, 1) },
    push,
  };
}

export function stepSwing(swing: Swing): {
  readonly swing: Swing;
  readonly jolt: Jolt | null;
} {
  const fromPivot = swing.fromPivot.clone();
  const velocity = swing.velocity.clone();

  velocity.y -= SWING_FEEL.gravity * STEP;
  velocity.multiplyScalar(SLOWDOWN_PER_STEP);
  fromPivot.addScaledVector(velocity, STEP);

  const joltSpeed = catchOnChain(fromPivot, velocity);

  return {
    swing: { fromPivot, velocity },
    jolt:
      joltSpeed > 0
        ? { strength: Math.min(joltSpeed / HARDEST_SWIPE_LAUNCH_SPEED, 1) }
        : null,
  };
}

export function farthestReach(): number {
  return Math.sqrt(CHAIN_REACH ** 2 - (CHAIN_REACH - HIGHEST_RISE) ** 2);
}

function fistOf(blow: Blow): {
  readonly push: Vector3;
  readonly speed: number;
} {
  switch (blow.kind) {
    case "jab":
      return {
        push: blow.hitFromCenter.clone().negate().normalize(),
        speed: SWING_FEEL.fistSpeed,
      };
    case "swipe": {
      const inJabs = blow.speed / JAB_SPEED;

      return {
        push: blow.fist.clone().normalize(),
        speed: SWING_FEEL.fistSpeed * inJabs,
      };
    }
  }
}

function dragHalvingSwingIn(seconds: number): number {
  return (2 * Math.LN2) / seconds;
}

function catchOnChain(fromPivot: Vector3, velocity: Vector3): number {
  const distance = fromPivot.length();

  if (distance <= CHAIN_REACH) {
    return 0;
  }

  fromPivot.multiplyScalar(CHAIN_REACH / distance);

  const outward = fromPivot.clone().divideScalar(CHAIN_REACH);
  const away = velocity.dot(outward);

  if (away <= 0) {
    return 0;
  }

  const jolted = away > JOLT_ABOVE;

  velocity.addScaledVector(
    outward,
    -away * (jolted ? 1 + SWING_FEEL.rebound : 1),
  );

  return jolted ? away : 0;
}

function capSwingEnergy(fromPivot: Vector3, velocity: Vector3): Vector3 {
  const rise = fromPivot.y + CHAIN_REACH;
  const allowed = 2 * SWING_FEEL.gravity * (HIGHEST_RISE - rise);

  if (allowed <= 0) {
    return new Vector3();
  }

  return velocity.lengthSq() > allowed
    ? velocity.clone().setLength(Math.sqrt(allowed))
    : velocity;
}
