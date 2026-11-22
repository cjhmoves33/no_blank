import { Matrix4, Quaternion, Vector3 } from "three";

import { GYM } from "../measurements";

export const LATE_AFTERNOON = {
  // 화면 평균 밝기가 고른 프로토타입(ACES, 노출 1)과 같아지는 값입니다.
  exposure: 1.35,
  environmentIntensity: 0.3,
  background: "#141210",
  fog: { color: "#8f7258", near: 11, far: 35 },
  glass: { color: "#ffe2b8", gain: 2.8 },
  sun: {
    color: "#ffc68c",
    intensity: 5.5,
    toward: [-0.9, -0.42, -0.3],
    distance: 22.5,
    shadow: {
      mapSize: 2048,
      radius: 2,
      bias: -0.0005,
      normalBias: 0.02,
      camera: {
        left: -12,
        right: 12,
        top: 11,
        bottom: -11,
        near: 7.5,
        far: 40,
      },
    },
  },
  windowFill: {
    color: "#ffe0c0",
    intensity: 0.9,
    width: 9,
    height: 4.5,
    at: [GYM.building.halfX - 0.05, GYM.floorY + 3.5, 0],
    lookAt: [0, GYM.floorY + 2.5, 0],
  },
  sky: { color: "#f6e2cc", ground: "#8a5e3c", intensity: 0.5 },
  haze: { color: "#ffd2a0", density: 0.04 },
  shapeLight: {
    color: "#ffffff",
    intensity: 3.4,
    height: 0.9,
    radius: 0.85,
    reach: 2.1,
  },
  dust: {
    count: 1100,
    color: "#ffe2bd",
    opacity: 0.5,
    size: 0.0125,
    min: [-6, GYM.mat.y - 0.5, -4],
    max: [4, 3.5, 4],
  },
} as const;

export function sunlightTravel(): Vector3 {
  return new Vector3(...LATE_AFTERNOON.sun.toward).normalize();
}

export function sunPosition(): [x: number, y: number, z: number] {
  const position = sunlightTravel().multiplyScalar(
    -LATE_AFTERNOON.sun.distance,
  );

  return [position.x, position.y, position.z];
}

export function hazeShaftFrames(): Matrix4[] {
  const sun = sunlightTravel();
  const { spans, sillY, headY } = GYM.windows;
  const outerX = GYM.building.halfX + GYM.building.wall;
  const centerY = (sillY + headY) / 2;
  const along = sun.clone().multiplyScalar((centerY - GYM.floorY) / -sun.y);

  return spans.map(([start, end]) => {
    const origin = new Vector3(outerX, centerY, (start + end) / 2);

    return new Matrix4()
      .makeBasis(
        new Vector3(0, 0, end - start),
        new Vector3(0, headY - sillY, 0),
        along,
      )
      .setPosition(origin.addScaledVector(along, 0.5));
  });
}

export function shapeLightPosition(camera: {
  readonly x: number;
  readonly z: number;
}): [x: number, y: number, z: number] {
  const { height, radius } = LATE_AFTERNOON.shapeLight;
  const azimuth = Math.atan2(camera.x, camera.z);

  return [radius * Math.sin(azimuth), height, radius * Math.cos(azimuth)];
}

/** 빛은 -z 로 비추므로 -z 가 lookAt 을 향하게 돌립니다. */
export function windowFillRotation(): Quaternion {
  const { at, lookAt } = LATE_AFTERNOON.windowFill;
  const facing = new Matrix4().lookAt(
    new Vector3(...at),
    new Vector3(...lookAt),
    new Vector3(0, 1, 0),
  );

  return new Quaternion().setFromRotationMatrix(facing);
}
