export interface Spring {
  readonly angle: number;
  readonly rate: number;
}

interface SpringFeel {
  readonly stiffness: number;
  readonly damping: number;
}

export const RESTING_SPRING: Spring = { angle: 0, rate: 0 };

export function settle(
  { angle, rate }: Spring,
  seconds: number,
  feel: SpringFeel,
): Spring {
  const natural = Math.sqrt(feel.stiffness);
  const ratio = feel.damping / (2 * natural);
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
