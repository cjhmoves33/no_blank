import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { agedKicks, pushBack, pushedBack, recoilAfter } from "./recoil";

const TARGET = new Vector3(0, 2.3, 0);
const SIDE_OF_BALL = new Vector3(0.3, 2.3, 0);

function cameraAt(distance: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(40, 1.6, 0.05, 100);

  camera.position.set(0, 2.3, distance);
  camera.lookAt(TARGET);
  camera.updateMatrixWorld();

  return camera;
}

function seenAt(camera: PerspectiveCamera): Vector3 {
  return SIDE_OF_BALL.clone().project(camera);
}

function over(seconds: number, strength: number): number[] {
  return Array.from({ length: Math.round(seconds / 0.001) + 1 }, (_, i) =>
    recoilAfter(i * 0.001, strength),
  );
}

describe("되밀림", () => {
  it("가장 센 타격에는 0.05초 만에 4 cm 밀린다", () => {
    const seen = over(0.3, 1);
    const farthest = Math.max(...seen);

    expect(farthest).toBeCloseTo(0.04, 4);
    expect(seen.indexOf(farthest) * 0.001).toBeCloseTo(0.05, 2);
  });

  it("넘어가지 않고 0.3초면 거의 제자리로 돌아온다", () => {
    const seen = over(0.3, 1);

    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
    expect(seen.at(-1)).toBeLessThan(0.04 * 0.05);
  });

  it("타격 세기에 정비례한다", () => {
    expect(recoilAfter(0.05, 0.4)).toBeCloseTo(0.4 * recoilAfter(0.05, 1), 9);
    expect(recoilAfter(0.05, 0)).toBe(0);
  });

  it("연달아 맞으면 밀림이 더해지고, 오래된 타격은 잊는다", () => {
    const kicks = [
      { age: 0.05, strength: 1 },
      { age: 0.02, strength: 0.4 },
    ];

    expect(pushedBack(kicks)).toBeCloseTo(
      recoilAfter(0.05, 1) + recoilAfter(0.02, 0.4),
      9,
    );
    const aged = agedKicks(kicks, 0.01);

    expect(aged.map((kick) => kick.strength)).toEqual([1, 0.4]);
    aged.forEach((kick, i) => {
      expect(kick.age).toBeCloseTo((kicks[i]?.age ?? 0) + 0.01, 9);
    });
    expect(agedKicks(kicks, 2)).toEqual([]);
  });

  it("카메라 위치는 그대로 두고, 그만큼 뒤로 물러난 카메라와 똑같이 보이게 한다", () => {
    const pushed = cameraAt(3);

    pushBack(pushed, { by: 0.04, from: TARGET });

    expect(pushed.position.distanceTo(TARGET)).toBeCloseTo(3, 12);
    expect(seenAt(pushed).x).toBeCloseTo(seenAt(cameraAt(3.04)).x, 9);
  });

  it("밀림이 없으면 원래대로 보인다", () => {
    const camera = cameraAt(3);

    pushBack(camera, { by: 0.04, from: TARGET });
    pushBack(camera, { by: 0, from: TARGET });

    expect(seenAt(camera).x).toBeCloseTo(seenAt(cameraAt(3)).x, 12);
  });
});
