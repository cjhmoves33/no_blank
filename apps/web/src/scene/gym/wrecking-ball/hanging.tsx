import type { Ref } from "react";
import { type Mesh, type Quaternion, Vector3 } from "three";

import { STEEL } from "../finishes";
import { linkCount, linksAlong } from "./chain";
import { ChainLinks } from "./chain-links";
import { STRAP_TOPS } from "./leather";

/** 레킹볼 중심에서 회전 고리의 위쪽 고리까지의 높이입니다. 위쪽 사슬 한 가닥이 여기에 걸립니다. */
export const HANGING_HEIGHT = 0.75;

const D_RING = { radius: 0.02, tube: 0.0045, above: 0.012 } as const;
const SWIVEL = {
  ring: { radius: 0.022, tube: 0.005, below: 0.075 },
  body: { top: 0.013, bottom: 0.016, height: 0.05 },
} as const;

export const SWIVEL_EYE = { radius: 0.014, tube: 0.0045 } as const;
const SWIVEL_RING_Y = HANGING_HEIGHT - SWIVEL.ring.below;

const STRAND_LINKS = STRAP_TOPS.flatMap(({ position, angle }) => {
  const from = position.clone().setY(position.y + D_RING.above + D_RING.radius);
  const to = new Vector3(
    0.012 * Math.cos(angle),
    SWIVEL_RING_Y - SWIVEL.ring.radius + SWIVEL.ring.tube,
    0.012 * Math.sin(angle),
  );

  return linksAlong(
    (t) => from.clone().lerp(to, t),
    linkCount(from.distanceTo(to)),
  );
});

export function Hanging() {
  return (
    <>
      {STRAP_TOPS.map(({ position, angle }) => (
        <mesh
          key={angle}
          castShadow
          receiveShadow
          position={[position.x, position.y + D_RING.above, position.z]}
          rotation-y={-angle}
        >
          <torusGeometry args={[D_RING.radius, D_RING.tube, 8, 20]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}
      <ChainLinks name="strands" poses={STRAND_LINKS} />
      <mesh castShadow receiveShadow position-y={SWIVEL_RING_Y}>
        <torusGeometry args={[SWIVEL.ring.radius, SWIVEL.ring.tube, 8, 20]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position-y={SWIVEL_RING_Y + SWIVEL.ring.radius + SWIVEL.body.height / 2}
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
  readonly ref: Ref<Mesh>;
  readonly position: Vector3;
  readonly quaternion: Quaternion;
}

/** 회전 고리의 위쪽 고리입니다. 위쪽 사슬에 걸려 있어서, 레킹볼이 비틀려도 따라 돌지 않습니다. */
export function SwivelEye({ ref, position, quaternion }: SwivelEyeProps) {
  return (
    <mesh
      ref={ref}
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
