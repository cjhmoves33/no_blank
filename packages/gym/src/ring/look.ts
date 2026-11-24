export interface RingLook {
  readonly mat: string;
  readonly wear: number;
  readonly apronLine: string;
  readonly emblem: string;
  readonly ropesFromBottom: readonly [string, string, string, string];
  readonly ties: string;
}

export const LOOK: RingLook = {
  mat: "#cdc2ae",
  wear: 0.6,
  apronLine: "#7d3a30",
  emblem: "#2c3d5c",
  ropesFromBottom: ["#9a2b25", "#2c4672", "#e3ded2", "#9a2b25"],
  ties: "#d6cab2",
};
