import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { swallowClicksAfterDrag } from "./swallow-clicks-after-drag";

interface Range {
  readonly min: number;
  readonly max: number;
}

/** 원점을 바라보는 카메라가 머무를 수 있는 곳입니다. polar 는 바로 위(0)에서 잰 각도(라디안)입니다. */
export interface OrbitLimits {
  readonly distance: Range;
  readonly polar: Range;
}

export interface OrbitRigProps {
  readonly inertia: boolean;
  readonly limits: OrbitLimits;
}

/**
 * 드래그로 끝난 클릭은 장면에 보내지 않으므로, 장면의 오브젝트는 onClick 만 달면 됩니다.
 * 캔버스의 커서(grab, grabbing)도 여기서만 정합니다.
 */
export function OrbitRig({ inertia, limits }: OrbitRigProps) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const controls = useRef<OrbitControls>(null);

  useEffect(() => {
    const orbit = new OrbitControls(camera, canvas);

    orbit.enablePan = false;
    orbit.minDistance = limits.distance.min;
    orbit.maxDistance = limits.distance.max;
    orbit.minPolarAngle = limits.polar.min;
    orbit.maxPolarAngle = limits.polar.max;
    orbit.enableDamping = inertia;
    orbit.cursorStyle = "grab";
    controls.current = orbit;

    const stopSwallowing = swallowClicksAfterDrag(canvas);

    return () => {
      stopSwallowing();
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, canvas, inertia, limits]);

  useFrame(() => {
    // 관성은 매 프레임 update 를 불러야 줄어들며 멈춥니다.
    controls.current?.update();
  });

  return null;
}
