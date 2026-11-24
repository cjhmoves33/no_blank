import { ORBIT_BUTTONS } from "@no-blank/gym";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import {
  Box3,
  MOUSE,
  type Object3D,
  type Vector3,
  type Vector3Tuple,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// 카메라의 near(0.05 m)보다 가까워지면 보려던 곳이 잘려 나갑니다.
const CLOSEST = 0.15;

export interface FreeOrbitProps {
  readonly around: Object3D;
  readonly lookAt: Vector3Tuple | undefined;
}

export function FreeOrbit({ around, lookAt }: FreeOrbitProps) {
  const camera = useThree((state) => state.camera);
  const surface = useThree((state) => state.gl.domElement);
  const controls = useRef<OrbitControls>(null);

  useEffect(() => {
    const orbit = new OrbitControls(camera, surface);

    if (lookAt) {
      orbit.target.set(...lookAt);
    } else {
      centerOf(around, orbit.target);
    }

    orbit.mouseButtons = { ...ORBIT_BUTTONS, LEFT: MOUSE.PAN };
    orbit.zoomToCursor = true;
    orbit.minDistance = CLOSEST;
    orbit.enableDamping = true;
    orbit.update();
    controls.current = orbit;

    return () => {
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, surface, around, lookAt]);

  useFrame(() => {
    controls.current?.update();
  });

  return null;
}

function centerOf(object: Object3D, target: Vector3): void {
  new Box3().setFromObject(object).getCenter(target);
}
