import { Vector3 } from "three";

export interface Grain {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly age: number;
  readonly life: number;
}

export const GRAINS_AT_FULL_STRENGTH = 40;

const SPEED = { slowest: 0.08, fastest: 0.35 } as const;
const LIFE = { shortest: 1.5, longest: 2.5 } as const;
const AIR_DRAG = 2.5;
const SETTLING = 0.06;
const FADE_IN = 0.08;
const UP = new Vector3(0, 1, 0);

export function burst(
  at: Vector3,
  fromCenter: Vector3,
  {
    strength,
    random,
  }: { readonly strength: number; readonly random: () => number },
): Grain[] {
  const outward = fromCenter.clone().normalize();
  const count = Math.round(GRAINS_AT_FULL_STRENGTH * strength);
  const side = alongSurface(outward);
  const across = outward.clone().cross(side);

  return Array.from({ length: count }, () => {
    const turn = random() * 2 * Math.PI;
    const direction = side
      .clone()
      .multiplyScalar(Math.cos(turn))
      .addScaledVector(across, Math.sin(turn))
      .addScaledVector(outward, 0.3 + random() * 0.5)
      .normalize();
    const speed =
      (SPEED.slowest + random() * (SPEED.fastest - SPEED.slowest)) *
      (0.5 + strength);

    return {
      position: at.clone(),
      velocity: direction.multiplyScalar(speed),
      age: 0,
      life: LIFE.shortest + random() * (LIFE.longest - LIFE.shortest),
    };
  });
}

export function drift(grains: readonly Grain[], seconds: number): Grain[] {
  const slowdown = Math.exp(-AIR_DRAG * seconds);

  return grains
    .filter((grain) => grain.age + seconds < grain.life)
    .map((grain) => {
      const velocity = grain.velocity
        .clone()
        .multiplyScalar(slowdown)
        .addScaledVector(UP, -SETTLING * (1 - slowdown));

      return {
        ...grain,
        position: grain.position.clone().addScaledVector(velocity, seconds),
        velocity,
        age: grain.age + seconds,
      };
    });
}

export function glow({ age, life }: Grain): number {
  return Math.min(age / FADE_IN, 1) * Math.max(1 - age / life, 0);
}

function alongSurface(outward: Vector3): Vector3 {
  const side = outward.clone().cross(UP);

  return side.lengthSq() > 1e-9
    ? side.normalize()
    : new Vector3(1, 0, 0).cross(outward).normalize();
}
