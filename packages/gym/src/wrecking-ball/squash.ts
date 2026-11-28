import { Matrix4, type Vector3 } from "three";

import type { Impact, ImpactFeel } from "./impact";

export interface SquashFeel {
  readonly flattestAtFullStrength: number;
  readonly wobblesPerSecond: number;
  readonly settleSeconds: number;
}

export const SQUASH_FEEL = {
  normal: {
    flattestAtFullStrength: 0.08,
    wobblesPerSecond: 6,
    settleSeconds: 0.4,
  },
  reduced: { flattestAtFullStrength: 0, wobblesPerSecond: 6, settleSeconds: 0 },
} as const satisfies Record<ImpactFeel, SquashFeel>;

// 지수 감쇠는 시간 상수의 세 배가 지나면 처음의 5% 아래로 줄어듭니다.
const TIME_CONSTANTS_TO_SETTLE = 3;

export function flattening(impact: Impact, feel: SquashFeel): number {
  const flattest = feel.flattestAtFullStrength * impact.strength;

  if (flattest === 0) {
    return flattest;
  }

  const since = impact.sinceHitStop;
  const fade = Math.exp(
    (-since * TIME_CONSTANTS_TO_SETTLE) / feel.settleSeconds,
  );

  return (
    flattest * fade * Math.cos(2 * Math.PI * feel.wobblesPerSecond * since)
  );
}

export function squashMatrix(along: Vector3, amount: number): Matrix4 {
  const squeezed = 1 - amount;
  const bulged = 1 / Math.sqrt(squeezed);
  const { x, y, z } = along.clone().normalize();
  const toward = squeezed - bulged;

  return new Matrix4().set(
    bulged + toward * x * x,
    toward * x * y,
    toward * x * z,
    0,
    toward * y * x,
    bulged + toward * y * y,
    toward * y * z,
    0,
    toward * z * x,
    toward * z * y,
    bulged + toward * z * z,
    0,
    0,
    0,
    0,
    1,
  );
}
