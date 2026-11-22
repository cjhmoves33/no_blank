import type { OrbitLimits } from "../orbit-rig";

/** 길이는 미터입니다. 원점은 링 가운데 아래의 건물 바닥이고, y 가 위쪽입니다. */
export const GYM = {
  wreckingBall: { restCenter: [0, 2.3, 0], radius: 0.3, pivotY: 3.8 },
  mat: { y: 1, half: 3.65 },
  ropes: {
    half: 3.15,
    heights: [0.46, 0.76, 1.07, 1.37],
    radius: 0.025,
    sag: 0.035,
  },
  posts: { at: 3.25, radius: 0.055 },
  building: { halfX: 7.5, halfZ: 6, ceilingY: 6.75, wall: 0.3 },
  windows: {
    spans: [
      [-4.4, -3.1],
      [-1.9, -0.6],
      [0.6, 1.9],
      [3.1, 4.4],
    ],
    sillY: 1.4,
    headY: 6.2,
    mullions: 1,
    transoms: 4,
  },
} as const;

const ROPE_CLEARANCE = 0.15;

export interface RingView extends OrbitLimits {
  readonly fov: number;
  readonly near: number;
  readonly home: [x: number, y: number, z: number];
}

export const RING_VIEW: RingView = {
  fov: 40,
  near: 0.05,
  target: GYM.wreckingBall.restCenter,
  home: [1.575, GYM.wreckingBall.restCenter[1] + 0.825, 2.4],
  distance: { min: 2.1, max: GYM.ropes.half - ROPE_CLEARANCE },
  polar: { min: Math.PI * 0.28, max: Math.PI * 0.55 },
};
