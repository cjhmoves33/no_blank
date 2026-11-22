import type { Vector3 } from "three";

import { GYM } from "../measurements";
import type { SWING_FEEL } from "./swing";

export interface Impact {
  readonly at: Vector3;
  readonly strength: number;
  readonly hold: number;
  readonly since: number;
}

export interface DentFeel {
  readonly fade: number;
  readonly ring: number;
}

export const DENT_FEEL = {
  normal: { fade: 0.035, ring: (2 * Math.PI) / 0.14 },
  reduced: { fade: 0.035, ring: 0 },
} as const satisfies Record<keyof typeof SWING_FEEL, DentFeel>;

const HIT_STOP = { shortest: 0.03, longest: 0.1 } as const;
const DEEPEST = 0.03;
const DENT_WIDTH = 0.1;
const DENT_LIFE = 0.3;

const { radius } = GYM.wreckingBall;

export function impactOf(at: Vector3, strength: number): Impact | null {
  if (strength <= 0) {
    return null;
  }

  return {
    at: at.clone().normalize(),
    strength,
    hold: HIT_STOP.shortest + (HIT_STOP.longest - HIT_STOP.shortest) * strength,
    since: 0,
  };
}

export function age(
  impact: Impact,
  seconds: number,
): { readonly impact: Impact | null; readonly moving: number } {
  const held = Math.min(impact.hold, seconds);
  const moving = seconds - held;
  const since = impact.since + moving;

  return {
    impact:
      since > DENT_LIFE ? null : { ...impact, hold: impact.hold - held, since },
    moving,
  };
}

export function dentDepth(impact: Impact, feel: DentFeel): number {
  const deepest = DEEPEST * impact.strength;

  if (impact.hold > 0) {
    return deepest;
  }

  return (
    deepest *
    Math.exp(-impact.since / feel.fade) *
    Math.cos(feel.ring * impact.since)
  );
}

export function sinking(
  direction: Vector3,
  at: Vector3,
  depth: number,
): number {
  const apart = direction.distanceTo(at) * radius;

  return depth * Math.exp(-((apart / DENT_WIDTH) ** 2));
}

export function dentedNormal(
  direction: Vector3,
  at: Vector3,
  depth: number,
): Vector3 {
  const slope = (2 * sinking(direction, at, depth) * radius) / DENT_WIDTH ** 2;
  const towardHit = at
    .clone()
    .sub(direction.clone().multiplyScalar(direction.dot(at)));

  return direction.clone().addScaledVector(towardHit, slope).normalize();
}
