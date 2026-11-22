import type { OrbitLimits } from "../orbit-rig";

const FLOOR_Y = -2.3;

/** 길이는 미터이고, 원점은 링 가운데에 떠 있는 도형의 중심입니다. */
export const GYM = {
  shape: { radius: 0.5 },
  floorY: FLOOR_Y,
  mat: { y: -1.3, half: 3.65 },
  ropes: {
    half: 3.15,
    heights: [0.46, 0.76, 1.07, 1.37],
    radius: 0.025,
    sag: 0.035,
  },
  posts: { at: 3.25, radius: 0.055 },
  building: { halfX: 7.5, halfZ: 6, ceilingY: FLOOR_Y + 6.75, wall: 0.3 },
  windows: {
    spans: [
      [-4.4, -3.1],
      [-1.9, -0.6],
      [0.6, 1.9],
      [3.1, 4.4],
    ],
    sillY: FLOOR_Y + 1.4,
    headY: FLOOR_Y + 6.2,
    mullions: 1,
    transoms: 4,
  },
} as const;

// 맨 위 로프가 도형 높이에 있어서, 로프 밖에서 보면 로프가 도형을 가로지릅니다.
const ROPE_CLEARANCE = 0.15;

export interface RingView extends OrbitLimits {
  readonly fov: number;
  readonly home: [x: number, y: number, z: number];
}

export const RING_VIEW: RingView = {
  fov: 40,
  home: [1.575, 0.825, 2.4],
  distance: { min: 2.1, max: GYM.ropes.half - ROPE_CLEARANCE },
  polar: { min: Math.PI * 0.28, max: Math.PI * 0.55 },
};
