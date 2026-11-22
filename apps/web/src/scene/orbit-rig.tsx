import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { swallowClicksAfterDrag } from "./swallow-clicks-after-drag";

export interface OrbitRigProps {
  readonly inertia: boolean;
}

const MIN_DISTANCE = 3.5;
const MAX_DISTANCE = 12;

/**
 * 드래그로 끝난 클릭은 장면에 보내지 않으므로, 장면의 오브젝트는 onClick 만 달면 됩니다.
 * 캔버스의 커서(grab, grabbing)도 여기서만 정합니다.
 */
export function OrbitRig({ inertia }: OrbitRigProps) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const controls = useRef<OrbitControls>(null);

  useEffect(() => {
    const orbit = new OrbitControls(camera, canvas);

    orbit.enablePan = false;
    orbit.minDistance = MIN_DISTANCE;
    orbit.maxDistance = MAX_DISTANCE;
    orbit.enableDamping = inertia;
    orbit.cursorStyle = "grab";
    controls.current = orbit;

    const stopSwallowing = swallowClicksAfterDrag(canvas);

    return () => {
      stopSwallowing();
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, canvas, inertia]);

  useFrame(() => {
    // 관성은 매 프레임 update 를 불러야 줄어들며 멈춥니다.
    controls.current?.update();
  });

  return null;
}
