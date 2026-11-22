import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

interface Range {
  readonly min: number;
  readonly max: number;
}

/** target 을 바라보는 카메라가 머무를 수 있는 곳입니다. distance 는 target 에서 잰 거리, polar 는 바로 위(0)에서 잰 각도(라디안)입니다. */
export interface OrbitLimits {
  readonly target: readonly [x: number, y: number, z: number];
  readonly distance: Range;
  readonly polar: Range;
}

export interface OrbitRigProps {
  readonly surface: HTMLElement;
  readonly inertia: boolean;
  readonly limits: OrbitLimits;
}

/**
 * surface 를 끌면 카메라가 돌고, 휠을 굴리면 다가가거나 물러납니다. surface 의 커서(grab, grabbing)도 여기서만 정합니다.
 * surface 는 R3F 가 이벤트를 듣는 요소의 바깥에 있어야 합니다. pointerdown 은 안에서 밖으로 올라오므로 장면의 오브젝트가 먼저 받고,
 * 그 오브젝트가 nativeEvent.stopPropagation() 을 부르면 그 누름으로는 카메라가 돌지 않습니다.
 */
export function OrbitRig({ surface, inertia, limits }: OrbitRigProps) {
  const camera = useThree((state) => state.camera);
  const controls = useRef<OrbitControls>(null);

  useEffect(() => {
    const orbit = new OrbitControls(camera, surface);

    orbit.target.set(...limits.target);
    orbit.enablePan = false;
    orbit.minDistance = limits.distance.min;
    orbit.maxDistance = limits.distance.max;
    orbit.minPolarAngle = limits.polar.min;
    orbit.maxPolarAngle = limits.polar.max;
    orbit.enableDamping = inertia;
    orbit.cursorStyle = "grab";
    orbit.update();
    controls.current = orbit;

    return () => {
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, surface, inertia, limits]);

  useFrame(() => {
    // 관성은 매 프레임 update 를 불러야 줄어들며 멈춥니다.
    controls.current?.update();
  });

  return null;
}
