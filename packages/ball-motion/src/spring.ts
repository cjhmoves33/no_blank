export interface Spring {
  readonly angle: number;
  readonly rate: number;
}

export interface SpringFeel {
  readonly stiffness: number;
  readonly damping: number;
}

export const RESTING_SPRING: Spring = { angle: 0, rate: 0 };

export function criticallyDamped(stiffness: number): SpringFeel {
  return { stiffness, damping: 2 * Math.sqrt(stiffness) };
}

export function settle(
  spring: Spring,
  seconds: number,
  feel: SpringFeel,
): Spring {
  const natural = Math.sqrt(feel.stiffness);
  const ratio = feel.damping / (2 * natural);

  return ratio < 1
    ? oscillating(spring, seconds, { natural, ratio })
    : settleCriticallyDamped(spring, seconds, natural);
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

function settleCriticallyDamped(
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
