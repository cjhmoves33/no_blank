import type { Vector3 } from "three";

import { GYM } from "../measurements";
import type { SWING_FEEL } from "./swing";

/**
 * 한 타격이 가죽 공에 남기는 히트스톱과 패임입니다. 새 타격이 오면 통째로 바뀝니다.
 * - at: 맞은 자리를 가죽 공의 좌표에서 본 방향(단위 벡터)입니다. 공이 비틀려도 패임이 같은 가죽에 남습니다.
 * - hold: 남은 히트스톱(초)입니다. 이 동안 패임은 가장 깊고, 레킹볼과 사슬은 멈춥니다.
 * - since: 히트스톱이 끝나고 흐른 시간(초)입니다. 패임은 이때부터 돌아옵니다.
 */
export interface Impact {
  readonly at: Vector3;
  readonly strength: number;
  readonly hold: number;
  readonly since: number;
}

/** 패임이 돌아오는 느낌입니다. ring 은 살짝 튀어나왔다 돌아오는 진동(라디안/초)이고, 0 이면 튀지 않습니다. */
export interface DentFeel {
  readonly fade: number;
  readonly ring: number;
}

export const DENT_FEEL = {
  normal: { fade: 0.035, ring: (2 * Math.PI) / 0.14 },
  reduced: { fade: 0.035, ring: 0 },
} as const satisfies Record<keyof typeof SWING_FEEL, DentFeel>;

const HIT_STOP = { shortest: 0.03, longest: 0.1 } as const;
/** 타격 세기 1 일 때 패이는 깊이(m)입니다. */
const DEEPEST = 0.03;
/** 패인 자리의 크기(m)입니다. 맞은 자리에서 이만큼 떨어진 곳은 가장 깊은 곳의 1/e 만큼 패입니다. */
const DENT_WIDTH = 0.1;
// 이만큼 지나면 패임이 눈에 띄지 않을 만큼 돌아와 있습니다.
const DENT_LIFE = 0.3;

const { radius } = GYM.wreckingBall;

/** 타격 세기가 0 이면 레킹볼을 바꾸지 못한 타격이라 멈추지도 패지도 않습니다. */
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

/** seconds 가 흐른 뒤의 타격 자국과, 그동안 레킹볼이 움직여도 되는 시간(초)입니다. 히트스톱이 먼저 시간을 씁니다. */
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

/** 지금 맞은 자리가 패인 깊이(m)입니다. 음수면 살짝 튀어나와 있습니다. */
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

/**
 * 가죽 공 표면의 한 점이 패임 때문에 중심 쪽으로 들어간 거리(m)입니다.
 * direction 은 그 점을 공의 중심에서 본 방향(단위 벡터), at 은 맞은 자리의 방향입니다.
 */
export function sinking(
  direction: Vector3,
  at: Vector3,
  depth: number,
): number {
  const apart = direction.distanceTo(at) * radius;

  return depth * Math.exp(-((apart / DENT_WIDTH) ** 2));
}

/** 패인 가죽 표면의 법선입니다. 패인 벽은 맞은 자리 쪽을 봅니다. */
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
