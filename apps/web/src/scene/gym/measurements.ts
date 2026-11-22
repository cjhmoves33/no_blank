import type { OrbitLimits } from "../orbit-rig";

const FLOOR_Y = -4.6;

/** 1 = 0.5 m 이고, 원점은 링 가운데에 떠 있는 도형의 중심입니다. */
export const GYM = {
  shape: { radius: 1 },
  floorY: FLOOR_Y,
  mat: { y: -2.6, half: 7.3 },
  ropes: {
    half: 6.3,
    heights: [0.92, 1.52, 2.14, 2.74],
    radius: 0.05,
    sag: 0.07,
  },
  posts: { at: 6.5, radius: 0.11 },
  building: { halfX: 15, halfZ: 12, ceilingY: FLOOR_Y + 13.5, wall: 0.6 },
  windows: {
    spans: [
      [-8.8, -6.2],
      [-3.8, -1.2],
      [1.2, 3.8],
      [6.2, 8.8],
    ],
    sillY: FLOOR_Y + 2.8,
    headY: FLOOR_Y + 12.4,
    mullions: 1,
    transoms: 4,
  },
} as const;

// 맨 위 로프가 도형 높이에 있어서, 로프 밖에서 보면 로프가 도형을 가로지릅니다.
const ROPE_CLEARANCE = 0.3;

export interface RingView extends OrbitLimits {
  readonly fov: number;
  readonly home: [x: number, y: number, z: number];
}

export const RING_VIEW: RingView = {
  fov: 40,
  home: [3.15, 1.65, 4.8],
  distance: { min: 4.2, max: GYM.ropes.half - ROPE_CLEARANCE },
  polar: { min: Math.PI * 0.28, max: Math.PI * 0.55 },
};
