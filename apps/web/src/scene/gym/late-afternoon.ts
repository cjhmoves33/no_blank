import { Matrix4, Quaternion, Vector3 } from "three";

import { GYM } from "./measurements";

/**
 * 빛을 고칠 때는 이 표만 고칩니다. Space 가 노출과 환경광 세기를, Daylight 가 나머지를 읽습니다.
 * - exposure 는 화면 평균 밝기가 고른 프로토타입(ACES, 노출 1)과 같아지는 값입니다.
 * - sun.toward 는 빛이 나아가는 방향입니다. 링 가운데의 도형이 창 사이 벽 그림자에 들도록 골랐습니다.
 *   따뜻한 햇빛이 파란 면에 닿으면 보라색으로 뜨기 때문입니다.
 * - shapeLight 는 도형만 밝히는 흰 빛입니다. 카메라가 도는 쪽을 따라 돌아서 어디서 보아도 도형의 보이는 쪽을 밝히고,
 *   reach 너머에는 닿지 않아서 세트의 색을 바꾸지 않습니다.
 */
export const LATE_AFTERNOON = {
  exposure: 1.35,
  environmentIntensity: 0.3,
  background: "#141210",
  fog: { color: "#8f7258", near: 22, far: 70 },
  glass: { color: "#ffe2b8", gain: 2.8 },
  sun: {
    color: "#ffc68c",
    intensity: 5.5,
    toward: [-0.9, -0.42, -0.3],
    distance: 45,
    shadow: {
      mapSize: 2048,
      radius: 2,
      bias: -0.0005,
      normalBias: 0.04,
      camera: { left: -24, right: 24, top: 22, bottom: -22, near: 15, far: 80 },
    },
  },
  windowFill: {
    color: "#ffe0c0",
    intensity: 0.9,
    width: 18,
    height: 9,
    at: [GYM.room.halfX - 0.1, GYM.floorY + 7, 0],
    lookAt: [0, GYM.floorY + 5, 0],
  },
  sky: { color: "#f6e2cc", ground: "#8a5e3c", intensity: 0.5 },
  shapeLight: {
    color: "#ffffff",
    intensity: 3.4,
    height: 1.8,
    radius: 1.7,
    reach: 4.2,
  },
} as const;

/** 빛이 나아가는 단위 방향입니다. */
export function sunDirection(): Vector3 {
  return new Vector3(...LATE_AFTERNOON.sun.toward).normalize();
}

export function sunPosition(): [x: number, y: number, z: number] {
  const position = sunDirection().multiplyScalar(-LATE_AFTERNOON.sun.distance);

  return [position.x, position.y, position.z];
}

/** 카메라 쪽으로 돌리되 높이는 그대로 둡니다. 낮아지면 매트에 닿습니다. */
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
