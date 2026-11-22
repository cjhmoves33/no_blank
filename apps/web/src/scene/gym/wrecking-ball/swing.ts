import { Vector3 } from "three";

import { GYM } from "../measurements";

export interface Swing {
  readonly fromPivot: Vector3;
  readonly velocity: Vector3;
  readonly unsimulatedSeconds: number;
}

export interface SwingFeel {
  readonly fistSpeed: number;
  readonly maxBottomSpeed: number;
  readonly gravity: number;
  readonly drag: number;
}

export const CHAIN_REACH =
  GYM.wreckingBall.pivotY - GYM.wreckingBall.restCenter[1];

export const SWING_FEEL = {
  normal: { fistSpeed: 1.3, maxBottomSpeed: 1.8, gravity: 9.81, drag: 0.6 },
  reduced: criticallyDamped({ fistSpeed: 0.4, gravity: 96 }),
} as const satisfies Record<string, SwingFeel>;

const STEP = 1 / 240;

export function restingSwing(): Swing {
  return {
    fromPivot: new Vector3(0, -CHAIN_REACH, 0),
    velocity: new Vector3(),
    unsimulatedSeconds: 0,
  };
}

export function strike(
  swing: Swing,
  hitFromPivot: Vector3,
  feel: SwingFeel,
): Swing {
  const push = swing.fromPivot.clone().sub(hitFromPivot).normalize();
  const along = swing.velocity.dot(push);

  if (along >= feel.fistSpeed) {
    return swing;
  }

  const velocity = swing.velocity
    .clone()
    .addScaledVector(push, feel.fistSpeed - along);

  return {
    ...swing,
    velocity: capSwingEnergy(swing.fromPivot, velocity, feel),
  };
}

export function advance(swing: Swing, seconds: number, feel: SwingFeel): Swing {
  const fromPivot = swing.fromPivot.clone();
  const velocity = swing.velocity.clone();
  const slowdown = Math.exp(-feel.drag * STEP);
  let unsimulatedSeconds = swing.unsimulatedSeconds + seconds;

  while (unsimulatedSeconds >= STEP) {
    velocity.y -= feel.gravity * STEP;
    velocity.multiplyScalar(slowdown);
    fromPivot.addScaledVector(velocity, STEP);
    keepOnChain(fromPivot, velocity);
    unsimulatedSeconds -= STEP;
  }

  return { fromPivot, velocity, unsimulatedSeconds };
}

export function farthestReach(): number {
  const rise = Math.max(...Object.values(SWING_FEEL).map(highestRise));

  return Math.sqrt(CHAIN_REACH ** 2 - (CHAIN_REACH - rise) ** 2);
}

function criticallyDamped({
  fistSpeed,
  gravity,
}: Pick<SwingFeel, "fistSpeed" | "gravity">): SwingFeel {
  return {
    fistSpeed,
    maxBottomSpeed: fistSpeed,
    gravity,
    drag: 2 * Math.sqrt(gravity / CHAIN_REACH),
  };
}

function highestRise({ maxBottomSpeed, gravity }: SwingFeel): number {
  return maxBottomSpeed ** 2 / (2 * gravity);
}

function keepOnChain(fromPivot: Vector3, velocity: Vector3): void {
  const distance = fromPivot.length();

  if (distance <= CHAIN_REACH) {
    return;
  }

  fromPivot.multiplyScalar(CHAIN_REACH / distance);

  const outward = fromPivot.clone().divideScalar(CHAIN_REACH);
  const away = velocity.dot(outward);

  if (away > 0) {
    velocity.addScaledVector(outward, -away);
  }
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
