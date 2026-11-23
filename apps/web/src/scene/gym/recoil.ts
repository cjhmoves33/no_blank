import { type Camera, PerspectiveCamera, type Vector3 } from "three";

export interface Kick {
  readonly age: number;
  readonly strength: number;
}

const FARTHEST = 0.04;
const PEAK_SECONDS = 0.05;
const FORGET_AFTER_SECONDS = 1;

export function recoilAfter(seconds: number, strength: number): number {
  const inPeaks = seconds / PEAK_SECONDS;

  return FARTHEST * strength * inPeaks * Math.exp(1 - inPeaks);
}

export function pushedBack(kicks: readonly Kick[]): number {
  return kicks.reduce(
    (sum, { age, strength }) => sum + recoilAfter(age, strength),
    0,
  );
}

export function agedKicks(kicks: readonly Kick[], seconds: number): Kick[] {
  return kicks
    .map(({ age, strength }) => ({ age: age + seconds, strength }))
    .filter(({ age }) => age < FORGET_AFTER_SECONDS);
}

// OrbitControls 는 이벤트를 받는 즉시 카메라 위치를 다시 정하므로, 되밀림은 위치를 건드리지 않고 그만큼 줌을 줄여서 보여 줍니다.
export function pushBack(
  camera: Camera,
  { by, from }: { readonly by: number; readonly from: Vector3 },
): void {
  if (!(camera instanceof PerspectiveCamera)) {
    return;
  }

  const distance = camera.position.distanceTo(from);
  const zoom = distance / (distance + by);

  if (camera.zoom !== zoom) {
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }
}
