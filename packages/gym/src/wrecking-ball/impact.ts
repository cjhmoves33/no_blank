import type { BallFeel } from "@no-blank/ball-motion";
import type { Vector3 } from "three";

import { GYM } from "../measurements";

export interface Impact {
  readonly onLeather: Vector3;
  readonly strength: number;
  readonly sinceHitStop: number;
}

export interface DentFeel {
  readonly fadeSeconds: number;
  readonly overshootRate: number;
}

export const DENT_FEEL = {
  normal: { fadeSeconds: 0.035, overshootRate: (2 * Math.PI) / 0.14 },
  reduced: { fadeSeconds: 0.035, overshootRate: 0 },
} as const satisfies Record<BallFeel, DentFeel>;

const DEEPEST = 0.06;
const DENT_WIDTH = 0.1;
const IMPACT_LIFE = 0.45;

const { radius } = GYM.wreckingBall;

export function impactOf(onLeather: Vector3, strength: number): Impact | null {
  if (strength <= 0) {
    return null;
  }

  return {
    onLeather: onLeather.clone().normalize(),
    strength,
    sinceHitStop: 0,
  };
}

/** 히트스톱이 끝난 뒤 흐른 시간만 받습니다. 히트스톱 동안 패임은 가장 깊은 채로 머뭅니다. */
export function age(impact: Impact, movingSeconds: number): Impact | null {
  const sinceHitStop = impact.sinceHitStop + movingSeconds;

  return sinceHitStop > IMPACT_LIFE ? null : { ...impact, sinceHitStop };
}

export function dentDepth(impact: Impact, feel: DentFeel): number {
  const deepest = DEEPEST * impact.strength;

  return (
    deepest *
    Math.exp(-impact.sinceHitStop / feel.fadeSeconds) *
    Math.cos(feel.overshootRate * impact.sinceHitStop)
  );
}

export function sinking(
  direction: Vector3,
  onLeather: Vector3,
  depth: number,
): number {
  const apart = direction.distanceTo(onLeather) * radius;

  return depth * Math.exp(-((apart / DENT_WIDTH) ** 2));
}

export function dentedNormal(
  direction: Vector3,
  onLeather: Vector3,
  depth: number,
): Vector3 {
  const slope =
    (2 * sinking(direction, onLeather, depth) * radius) / DENT_WIDTH ** 2;
  const towardHit = onLeather
    .clone()
    .sub(direction.clone().multiplyScalar(direction.dot(onLeather)));

  return direction.clone().addScaledVector(towardHit, slope).normalize();
}
