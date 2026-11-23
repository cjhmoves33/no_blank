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
