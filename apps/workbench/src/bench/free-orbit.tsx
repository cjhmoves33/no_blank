import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Box3, MOUSE, type Object3D, type Vector3Tuple } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface FreeOrbitProps {
  readonly around: Object3D;
  /** 처음 바라볼 곳입니다. 없으면 around 의 한가운데를 봅니다. */
  readonly focus: Vector3Tuple | undefined;
}

/** around 를 거리와 각도 제한 없이 돌아봅니다. 버튼은 web 처럼 오른쪽이 회전이고, 왼쪽은 이동입니다. */
export function FreeOrbit({ around, focus }: FreeOrbitProps) {
  const camera = useThree((state) => state.camera);
  const surface = useThree((state) => state.gl.domElement);
  const controls = useRef<OrbitControls>(null);

  useEffect(() => {
    const orbit = new OrbitControls(camera, surface);

    if (focus) {
      orbit.target.set(...focus);
    } else {
      new Box3().setFromObject(around).getCenter(orbit.target);
    }

    orbit.mouseButtons = {
      LEFT: MOUSE.PAN,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.ROTATE,
    };
    orbit.zoomToCursor = true;
    orbit.enableDamping = true;
    orbit.update();
    controls.current = orbit;

    return () => {
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, surface, around, focus]);

  useFrame(() => {
    controls.current?.update();
  });

  return null;
}
