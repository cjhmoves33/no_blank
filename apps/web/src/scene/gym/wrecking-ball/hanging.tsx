import { Vector3 } from "three";

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
  eye: { radius: 0.014, tube: 0.0045 },
} as const;
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
      <ChainLinks poses={STRAND_LINKS} />
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
      <mesh
        castShadow
        receiveShadow
        position-y={HANGING_HEIGHT - SWIVEL.eye.radius}
        rotation-y={Math.PI / 2}
      >
        <torusGeometry args={[SWIVEL.eye.radius, SWIVEL.eye.tube, 8, 16]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
    </>
  );
}
