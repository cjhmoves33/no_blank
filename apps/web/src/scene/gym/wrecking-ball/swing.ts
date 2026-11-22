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

/**
 * 레킹볼에 닿는 순간의 주먹입니다.
 * - at: 맞은 자리를 레킹볼 중심에서 잰 벡터입니다. 길이는 반지름입니다.
 * - fist: 주먹이 나아가는 방향(단위 벡터)입니다. 잽은 카메라에서 커서를 지나는 광선, 휘두르기는 끈 방향입니다.
 * - speed: 휘두르기만 갖습니다. 레킹볼 깊이에서 잰 끄는 빠르기(m/s)입니다. 잽의 빠르기는 feel 이 정합니다.
 */
export type Blow =
  | { readonly kind: "jab"; readonly at: Vector3; readonly fist: Vector3 }
  | {
      readonly kind: "swipe";
      readonly at: Vector3;
      readonly fist: Vector3;
      readonly speed: number;
    };

/** 타격입니다. 효과음과 타격 반응은 이것만 보고 크기를 정합니다. */
export interface Strike {
  /** 타격 세기입니다. 0 이면 흔들림을 바꾸지 못했고, 1 이면 가장 빠른 휘두르기로 멈춘 레킹볼을 친 만큼 이상입니다. */
  readonly strength: number;
}

export interface Struck {
  readonly swing: Swing;
  readonly strike: Strike;
}

export const CHAIN_REACH =
  GYM.wreckingBall.pivotY - GYM.wreckingBall.restCenter[1];

/** 휘두르기의 끄는 빠르기를 잽 몇 번만큼인지로 바꿀 때 쓰는 잽 주먹의 빠르기(m/s)입니다. */
const JAB_SPEED = 1.3;

/** 잽보다 이 배수만큼 빠른 주먹이 멈춘 레킹볼에 더하는 속도를 타격 세기 1 로 봅니다. 더 빠른 주먹도 세기는 1 이고, 흔들림은 에너지 한도에 묶입니다. */
const FULL_STRENGTH_IN_JABS = 2.5;

export const SWING_FEEL = {
  normal: {
    fistSpeed: JAB_SPEED,
    maxBottomSpeed: 2.4,
    gravity: 9.81,
    drag: 0.6,
  },
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

/**
 * 주먹은 미는 방향으로 레킹볼을 자기 빠르기까지만 밉니다. 레킹볼이 이미 그보다 빨리 멀어지고 있으면 바꾸지 않습니다.
 * 타격 세기는 주먹이 더한 속도로 잽니다. 에너지 한도는 흔들림의 크기를 묶을 뿐 타격 세기를 줄이지 않습니다.
 */
export function strike(swing: Swing, blow: Blow, feel: SwingFeel): Struck {
  const { push, speed } = fistOf(blow, feel);
  const along = swing.velocity.dot(push);

  if (along >= speed) {
    return { swing, strike: { strength: 0 } };
  }

  const added = push.multiplyScalar(speed - along);
  const velocity = capSwingEnergy(
    swing.fromPivot,
    swing.velocity.clone().add(added),
    feel,
  );

  return {
    swing: { ...swing, velocity },
    strike: {
      strength: Math.min(
        added.length() / (feel.fistSpeed * FULL_STRENGTH_IN_JABS),
        1,
      ),
    },
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

function fistOf(
  blow: Blow,
  feel: SwingFeel,
): { readonly push: Vector3; readonly speed: number } {
  switch (blow.kind) {
    case "jab":
      return {
        push: blow.at.clone().negate().normalize(),
        speed: feel.fistSpeed,
      };
    case "swipe":
      return {
        push: blow.fist.clone().normalize(),
        speed: (feel.fistSpeed * blow.speed) / JAB_SPEED,
      };
  }
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
