import { Vector3 } from "three";

import { GYM } from "../measurements";

/** 공 중심의 위치(매단 지점이 원점)와 속도, 그리고 아직 계산하지 않은 시간입니다. */
export interface Swing {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly lag: number;
}

export interface SwingFeel {
  /** 주먹이 맞은 자리를 미는 속도(m/s)입니다. */
  readonly fistSpeed: number;
  /** 공이 가장 낮은 곳을 지날 때 낼 수 있는 가장 빠른 속도(m/s)이고, 흔들림의 최대 크기를 정합니다. */
  readonly topSpeed: number;
  readonly gravity: number;
  /** 속도가 1초마다 e^-drag 배로 줄어듭니다. */
  readonly drag: number;
}

export const SWING_FEEL = {
  normal: { fistSpeed: 1.3, topSpeed: 1.8, gravity: 9.81, drag: 0.6 },
  // 동작 줄이기에서는 조금만 밀리고 곧바로 제자리로 돌아오도록, 빠르고 임계 감쇠된 진자로 만듭니다.
  reduced: { fistSpeed: 0.4, topSpeed: 0.4, gravity: 96, drag: 16 },
} as const satisfies Record<string, SwingFeel>;

/** 매단 지점에서 공 중심까지의 거리입니다. 사슬은 이보다 늘어나지 않고, 느슨해지면 짧아질 수 있습니다. */
export const ROPE = GYM.wreckingBall.pivotY - GYM.wreckingBall.center[1];

const STEP = 1 / 240;

export function restingSwing(): Swing {
  return {
    position: new Vector3(0, -ROPE, 0),
    velocity: new Vector3(),
    lag: 0,
  };
}

/**
 * 맞은 자리(매단 지점이 원점)에서 공 중심 쪽으로 주먹이 fistSpeed 로 밉니다.
 * 공이 이미 그 방향으로 주먹보다 빠르면 더 밀지 않고, 다가오던 공은 방향이 뒤집힙니다.
 */
export function strike(swing: Swing, hit: Vector3, feel: SwingFeel): Swing {
  const push = swing.position.clone().sub(hit).normalize();
  const along = swing.velocity.dot(push);

  if (along >= feel.fistSpeed) {
    return swing;
  }

  const velocity = swing.velocity
    .clone()
    .addScaledVector(push, feel.fistSpeed - along);

  return { ...swing, velocity: withinTopSpeed(swing.position, velocity, feel) };
}

/** 시간을 STEP 단위로 계산하고, 남은 시간은 lag 로 넘겨서 프레임 속도와 관계없이 같은 흔들림을 만듭니다. */
export function advance(swing: Swing, seconds: number, feel: SwingFeel): Swing {
  const position = swing.position.clone();
  const velocity = swing.velocity.clone();
  const slowdown = Math.exp(-feel.drag * STEP);
  let lag = swing.lag + seconds;

  while (lag >= STEP) {
    velocity.y -= feel.gravity * STEP;
    velocity.multiplyScalar(slowdown);
    position.addScaledVector(velocity, STEP);
    keepOnChain(position, velocity);
    lag -= STEP;
  }

  return { position, velocity, lag };
}

/** 공 중심이 축에서 옆으로 가장 멀리 갈 수 있는 거리입니다. */
export function farthestReach(): number {
  const rise = Math.max(
    ...Object.values(SWING_FEEL).map(
      ({ topSpeed, gravity }) => (topSpeed * topSpeed) / (2 * gravity),
    ),
  );

  return Math.sqrt(ROPE * ROPE - (ROPE - rise) ** 2);
}

function keepOnChain(position: Vector3, velocity: Vector3): void {
  const distance = position.length();

  if (distance <= ROPE) {
    return;
  }

  position.multiplyScalar(ROPE / distance);

  const outward = position.clone().divideScalar(ROPE);
  const away = velocity.dot(outward);

  // 사슬이 팽팽해지는 순간 사슬 바깥쪽 속도는 사라집니다. 공이 덜컹하고 멈추는 까닭입니다.
  if (away > 0) {
    velocity.addScaledVector(outward, -away);
  }
}

function withinTopSpeed(
  position: Vector3,
  velocity: Vector3,
  { topSpeed, gravity }: SwingFeel,
): Vector3 {
  const rise = position.y + ROPE;
  const allowed = topSpeed * topSpeed - 2 * gravity * rise;

  if (allowed <= 0) {
    return new Vector3();
  }

  return velocity.lengthSq() > allowed
    ? velocity.clone().setLength(Math.sqrt(allowed))
    : velocity;
}
