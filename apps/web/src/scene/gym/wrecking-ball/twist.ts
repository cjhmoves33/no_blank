import { Vector3 } from "three";

import type { Blow, SWING_FEEL } from "./swing";

/** 비틀림입니다. angle 은 쉬는 자세에서 사슬 축으로 돈 각(라디안), rate 는 그 각속도(라디안/초)입니다. */
export interface Twist {
  readonly angle: number;
  readonly rate: number;
}

/** 꼬인 사슬이 되감기는 느낌입니다. stiffness 가 클수록 빨리 되돌아오고, damping 이 클수록 빨리 멈춥니다. */
export interface TwistFeel {
  readonly stiffness: number;
  readonly damping: number;
}

export const TWIST_FEEL = {
  normal: { stiffness: 6, damping: 0.5 },
  reduced: criticallyDamped(96),
} as const satisfies Record<keyof typeof SWING_FEEL, TwistFeel>;

/** 타격 세기 1 인 주먹이 맞은 자리의 접선 방향으로 지날 때 더하는 각속도(라디안/초)입니다. */
const KICK = 3;

const UP = new Vector3(0, 1, 0);

export function restingTwist(): Twist {
  return { angle: 0, rate: 0 };
}

/**
 * 주먹이 맞은 자리의 법선에서 벗어날수록, 타격 세기가 클수록 크게 비틉니다.
 * 사슬은 거의 곧게 매달려 있으므로 사슬 축을 위쪽으로 봅니다.
 */
export function twistBy(twist: Twist, blow: Blow, strength: number): Twist {
  const turn = blow.at.clone().normalize().cross(blow.fist).dot(UP);

  return { angle: twist.angle, rate: twist.rate + KICK * strength * turn };
}

/** seconds 동안 비틀림이 되감깁니다. 닫힌 꼴로 풀어 프레임 속도와 관계없이 같은 비틀림이 됩니다. */
export function unwind(twist: Twist, seconds: number, feel: TwistFeel): Twist {
  const natural = Math.sqrt(feel.stiffness);
  const ratio = feel.damping / (2 * natural);

  return ratio < 1
    ? oscillating(twist, seconds, { natural, ratio })
    : settling(twist, seconds, natural);
}

function criticallyDamped(stiffness: number): TwistFeel {
  return { stiffness, damping: 2 * Math.sqrt(stiffness) };
}

function oscillating(
  { angle, rate }: Twist,
  seconds: number,
  { natural, ratio }: { readonly natural: number; readonly ratio: number },
): Twist {
  const fade = ratio * natural;
  const frequency = natural * Math.sqrt(1 - ratio * ratio);
  const sine = (rate + fade * angle) / frequency;
  const decay = Math.exp(-fade * seconds);
  const cos = Math.cos(frequency * seconds);
  const sin = Math.sin(frequency * seconds);

  return {
    angle: decay * (angle * cos + sine * sin),
    rate:
      decay *
      ((sine * frequency - fade * angle) * cos -
        (angle * frequency + fade * sine) * sin),
  };
}

function settling(
  { angle, rate }: Twist,
  seconds: number,
  natural: number,
): Twist {
  const decay = Math.exp(-natural * seconds);
  const lean = rate + natural * angle;

  return {
    angle: decay * (angle + lean * seconds),
    rate: decay * (rate - natural * lean * seconds),
  };
}
