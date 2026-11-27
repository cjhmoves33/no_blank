import type { Ref } from "react";
import type { Mesh, Quaternion, Vector3 } from "three";

import { STEEL } from "../finishes";

export const SWIVEL = {
  ring: { radius: 0.022, tube: 0.005 },
  body: { top: 0.013, bottom: 0.016, height: 0.05 },
} as const;

export const SWIVEL_EYE = { radius: 0.014, tube: 0.0045 } as const;

/** 회전 고리에서 사슬 가닥들이 걸리는 아래쪽 고리와 몸통입니다. 아래쪽 고리의 중심을 원점에 두고 그립니다. */
export function Swivel() {
  return (
    <>
      <mesh castShadow receiveShadow>
        <torusGeometry args={[SWIVEL.ring.radius, SWIVEL.ring.tube, 8, 20]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position-y={SWIVEL.ring.radius + SWIVEL.body.height / 2}
      >
        <cylinderGeometry
          args={[SWIVEL.body.top, SWIVEL.body.bottom, SWIVEL.body.height, 12]}
        />
        <meshStandardMaterial {...STEEL} />
      </mesh>
    </>
  );
}

export interface SwivelEyeProps {
  readonly ref?: Ref<Mesh>;
  readonly position: Vector3;
  readonly quaternion: Quaternion;
}

/** 회전 고리의 위쪽 고리입니다. 위쪽 사슬에 걸려 있어서, 매달린 물건이 비틀려도 따라 돌지 않습니다. */
export function SwivelEye({ ref, position, quaternion }: SwivelEyeProps) {
  return (
    <mesh
      ref={ref ?? null}
      name="swivel-eye"
      castShadow
      receiveShadow
      position={position}
      quaternion={quaternion}
    >
      <torusGeometry args={[SWIVEL_EYE.radius, SWIVEL_EYE.tube, 8, 16]} />
      <meshStandardMaterial {...STEEL} />
    </mesh>
  );
}
