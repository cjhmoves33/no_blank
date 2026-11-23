import { Vector3 } from "three";

import { GYM } from "../measurements";

export interface Swing {
  readonly fromPivot: Vector3;
  readonly velocity: Vector3;
  readonly unsimulatedSeconds: number;
  readonly joltSpeed: number;
}

export interface SwingFeel {
  readonly fistSpeed: number;
  readonly closingSpeedShare: number;
  readonly maxBottomSpeed: number;
  readonly gravity: number;
  readonly drag: number;
  readonly rebound: number;
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

export interface Strike {
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

export const CHAIN_REACH =
  GYM.wreckingBall.pivotY - GYM.wreckingBall.restCenter[1];

export const STRAIGHT_CHAIN_AXIS = new Vector3(0, 1, 0);

const JAB_SPEED = 1.3;

const HARDEST_SWIPE_IN_JABS = 2.5;

const JOLT_MARGIN = 0.3;

export const SWING_FEEL = {
  normal: {
    fistSpeed: JAB_SPEED,
    closingSpeedShare: 0.21,
    maxBottomSpeed: 2.4,
    gravity: 9.81,
    drag: dragHalvingSwingIn(5),
    rebound: 0.35,
  },
  reduced: criticallyDamped({ fistSpeed: 0.4, gravity: 96 }),
} as const satisfies Record<string, SwingFeel>;

const HARDEST_SWIPE_LAUNCH_SPEED =
  JAB_SPEED * HARDEST_SWIPE_IN_JABS * SWING_FEEL.normal.closingSpeedShare;

const STEP = 1 / 240;

export function restingSwing(): Swing {
  return {
    fromPivot: new Vector3(0, -CHAIN_REACH, 0),
    velocity: new Vector3(),
    unsimulatedSeconds: 0,
    joltSpeed: 0,
  };
}

export function strike(swing: Swing, blow: Blow, feel: SwingFeel): Struck {
  const { push, speed } = fistOf(blow, feel);
  const along = swing.velocity.dot(push);

  if (along >= speed) {
    return { swing, strike: { strength: 0 }, push };
  }

  const closing = speed - along;
  const hardest = feel.fistSpeed * HARDEST_SWIPE_IN_JABS;
  const velocity = capSwingEnergy(
    swing.fromPivot,
    swing.velocity
      .clone()
      .addScaledVector(
        push,
        Math.min(closing, hardest) * feel.closingSpeedShare,
      ),
    feel,
  );

  return {
    swing: { ...swing, velocity },
    strike: { strength: Math.min(closing / hardest, 1) },
    push,
  };
}

export function advance(swing: Swing, seconds: number, feel: SwingFeel): Swing {
  const fromPivot = swing.fromPivot.clone();
  const velocity = swing.velocity.clone();
  const slowdown = Math.exp(-feel.drag * STEP);
  let unsimulatedSeconds = swing.unsimulatedSeconds + seconds;
  const caughtEveryStep = feel.gravity * STEP;
  const chain = {
    rebound: feel.rebound,
    joltAbove: JOLT_MARGIN + caughtEveryStep,
  };
  let joltSpeed = 0;

  while (unsimulatedSeconds >= STEP) {
    velocity.y -= feel.gravity * STEP;
    velocity.multiplyScalar(slowdown);
    fromPivot.addScaledVector(velocity, STEP);
    joltSpeed = Math.max(joltSpeed, catchOnChain(fromPivot, velocity, chain));
    unsimulatedSeconds -= STEP;
  }

  return { fromPivot, velocity, unsimulatedSeconds, joltSpeed };
}

export function joltOf(swing: Swing): Jolt | null {
  return swing.joltSpeed > 0
    ? { strength: Math.min(swing.joltSpeed / HARDEST_SWIPE_LAUNCH_SPEED, 1) }
    : null;
}

export function farthestReach(): number {
  const rise = Math.max(...Object.values(SWING_FEEL).map(highestRise));

  return Math.sqrt(CHAIN_REACH ** 2 - (CHAIN_REACH - rise) ** 2);
}

function fistOf(
  blow: Blow,
  feel: SwingFeel,
): { readonly push: Vector3; readonly speed: number } {
  switch (blow.kind) {
    case "jab":
      return {
        push: blow.hitFromCenter.clone().negate().normalize(),
        speed: feel.fistSpeed,
      };
    case "swipe": {
      const inJabs = blow.speed / JAB_SPEED;

      return {
        push: blow.fist.clone().normalize(),
        speed: feel.fistSpeed * inJabs,
      };
    }
  }
}

function criticallyDamped({
  fistSpeed,
  gravity,
}: Pick<SwingFeel, "fistSpeed" | "gravity">): SwingFeel {
  return {
    fistSpeed,
    closingSpeedShare: 1,
    maxBottomSpeed: fistSpeed,
    gravity,
    drag: 2 * Math.sqrt(gravity / CHAIN_REACH),
    rebound: 0,
  };
}

function dragHalvingSwingIn(seconds: number): number {
  return (2 * Math.LN2) / seconds;
}

function highestRise({ maxBottomSpeed, gravity }: SwingFeel): number {
  return maxBottomSpeed ** 2 / (2 * gravity);
}

function catchOnChain(
  fromPivot: Vector3,
  velocity: Vector3,
  {
    rebound,
    joltAbove,
  }: { readonly rebound: number; readonly joltAbove: number },
): number {
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

  const jolted = away > joltAbove;

  velocity.addScaledVector(outward, -away * (jolted ? 1 + rebound : 1));

  return jolted ? away : 0;
}

function capSwingEnergy(
  fromPivot: Vector3,
  velocity: Vector3,
  feel: SwingFeel,
): Vector3 {
  const rise = fromPivot.y + CHAIN_REACH;
  const allowed = 2 * feel.gravity * (highestRise(feel) - rise);

  if (allowed <= 0) {
    return new Vector3();
  }

  return velocity.lengthSq() > allowed
    ? velocity.clone().setLength(Math.sqrt(allowed))
    : velocity;
}
