/** 제자리(0)로 되돌아오려는 각입니다. angle 은 라디안, rate 는 그 각속도(라디안/초)입니다. */
export interface Spring {
  readonly angle: number;
  readonly rate: number;
}

/** stiffness 가 클수록 빨리 되돌아오고, damping 이 클수록 빨리 멈춥니다. damping 이 임계 감쇠보다 크면 임계 감쇠로 봅니다. */
export interface SpringFeel {
  readonly stiffness: number;
  readonly damping: number;
}

export const RESTING_SPRING: Spring = { angle: 0, rate: 0 };

export function criticallyDamped(stiffness: number): SpringFeel {
  return { stiffness, damping: 2 * Math.sqrt(stiffness) };
}

/** seconds 동안 제자리로 되돌아옵니다. 닫힌 꼴로 풀어 프레임 속도와 관계없이 같은 움직임이 됩니다. */
export function settle(
  spring: Spring,
  seconds: number,
  feel: SpringFeel,
): Spring {
  const natural = Math.sqrt(feel.stiffness);
  const ratio = feel.damping / (2 * natural);

  return ratio < 1
    ? oscillating(spring, seconds, { natural, ratio })
    : stopping(spring, seconds, natural);
}

function oscillating(
  { angle, rate }: Spring,
  seconds: number,
  { natural, ratio }: { readonly natural: number; readonly ratio: number },
): Spring {
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

function stopping(
  { angle, rate }: Spring,
  seconds: number,
  natural: number,
): Spring {
  const decay = Math.exp(-natural * seconds);
  const lean = rate + natural * angle;

  return {
    angle: decay * (angle + lean * seconds),
    rate: decay * (rate - natural * lean * seconds),
  };
}
