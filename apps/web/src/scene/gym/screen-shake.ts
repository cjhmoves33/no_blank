export interface Tilt {
  readonly pitch: number;
  readonly yaw: number;
  readonly roll: number;
}

export const WIDEST_TILT = (0.3 * Math.PI) / 180;

const SETTLE_SECONDS = 0.4;

const WOBBLE_HZ = {
  pitch: [17, 27],
  yaw: [19, 31],
  roll: [23, 29],
} as const satisfies Record<keyof Tilt, readonly [number, number]>;

export function shaken(trauma: number, strength: number): number {
  return Math.min(trauma + strength, 1);
}

export function calmed(trauma: number, seconds: number): number {
  return Math.max(trauma - seconds / SETTLE_SECONDS, 0);
}

export function tiltOf(trauma: number, elapsedSeconds: number): Tilt {
  const widest = WIDEST_TILT * trauma ** 2;

  return {
    pitch: widest * wobble(WOBBLE_HZ.pitch, elapsedSeconds),
    yaw: widest * wobble(WOBBLE_HZ.yaw, elapsedSeconds),
    roll: widest * wobble(WOBBLE_HZ.roll, elapsedSeconds),
  };
}

function wobble(
  [slow, fast]: readonly [number, number],
  seconds: number,
): number {
  return (
    (Math.sin(2 * Math.PI * slow * seconds) +
      Math.sin(2 * Math.PI * fast * seconds + 1)) /
    2
  );
}
