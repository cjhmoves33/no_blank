import type { Vector3 } from "three";

import { GYM } from "../measurements";
import type { SWING_FEEL } from "./swing";

export interface Impact {
  readonly onLeather: Vector3;
  readonly strength: number;
  readonly hitStopLeft: number;
  readonly sinceHitStop: number;
}

export interface DentFeel {
  readonly fadeSeconds: number;
  readonly overshootRate: number;
}

export const DENT_FEEL = {
  normal: { fadeSeconds: 0.035, overshootRate: (2 * Math.PI) / 0.14 },
  reduced: { fadeSeconds: 0.035, overshootRate: 0 },
} as const satisfies Record<keyof typeof SWING_FEEL, DentFeel>;

const HIT_STOP = { shortest: 0.05, longest: 0.12 } as const;
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
    hitStopLeft:
      HIT_STOP.shortest + (HIT_STOP.longest - HIT_STOP.shortest) * strength,
    sinceHitStop: 0,
  };
}

export function age(
  impact: Impact,
  seconds: number,
): { readonly impact: Impact | null; readonly movingSeconds: number } {
  const held = Math.min(impact.hitStopLeft, seconds);
  const movingSeconds = seconds - held;
  const sinceHitStop = impact.sinceHitStop + movingSeconds;

  return {
    impact:
      sinceHitStop > IMPACT_LIFE
        ? null
        : { ...impact, hitStopLeft: impact.hitStopLeft - held, sinceHitStop },
    movingSeconds,
  };
}

export function dentDepth(impact: Impact, feel: DentFeel): number {
  const deepest = DEEPEST * impact.strength;

  if (impact.hitStopLeft > 0) {
    return deepest;
  }

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
