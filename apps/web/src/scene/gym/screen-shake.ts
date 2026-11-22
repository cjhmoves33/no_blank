/**
 * 화면 떨림입니다. 타격마다 트라우마(0~1)를 더하고, 트라우마는 시간에 따라 줄어듭니다.
 * 떨림의 크기는 트라우마의 제곱을 따르므로 약한 타격은 거의 떨리지 않습니다(Eiserloh, GDC 2016).
 */
export interface Tilt {
  readonly pitch: number;
  readonly yaw: number;
  readonly roll: number;
}

/** 트라우마가 1 일 때 시점이 돌아가는 가장 큰 각(라디안)입니다. */
export const WIDEST_TILT = (0.3 * Math.PI) / 180;

/** 트라우마 1 이 0 으로 줄어드는 시간(초)입니다. */
const SETTLE = 0.4;

// 축마다 다른 두 주파수(Hz)를 겹쳐, 같은 모양이 되풀이되지 않는 떨림을 만듭니다.
const WOBBLE = {
  pitch: [17, 27],
  yaw: [19, 31],
  roll: [23, 29],
} as const satisfies Record<keyof Tilt, readonly [number, number]>;

export function shaken(trauma: number, strength: number): number {
  return Math.min(trauma + strength, 1);
}

export function calmed(trauma: number, seconds: number): number {
  return Math.max(trauma - seconds / SETTLE, 0);
}

/** seconds 는 떨림 모양을 고르는 시각(초)입니다. */
export function tiltOf(trauma: number, seconds: number): Tilt {
  const widest = WIDEST_TILT * trauma ** 2;

  return {
    pitch: widest * wobble(WOBBLE.pitch, seconds),
    yaw: widest * wobble(WOBBLE.yaw, seconds),
    roll: widest * wobble(WOBBLE.roll, seconds),
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
