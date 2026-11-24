/** 링의 색과 낡은 정도입니다. */
export interface RingLook {
  readonly canvas: string;
  /** 0 이면 새것이고 1 이면 오래 써서 많이 닳은 링입니다. */
  readonly wear: number;
  readonly apronLine: string;
  readonly emblem: string;
  /** 아래 로프부터 위 로프까지의 덮개 색입니다. */
  readonly ropes: readonly [string, string, string, string];
  readonly ties: string;
}

export const LOOK: RingLook = {
  canvas: "#cdc2ae",
  wear: 0.6,
  apronLine: "#7d3a30",
  emblem: "#2c3d5c",
  ropes: ["#8a2f27", "#8a2f27", "#8a2f27", "#8a2f27"],
  ties: "#d6cab2",
};
