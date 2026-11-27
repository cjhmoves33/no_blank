import { type Ref, useImperativeHandle, useRef } from "react";
import { Matrix4, type Mesh, Vector3 } from "three";

import { linkCount, linksAlong } from "../chain/chain";
import { ChainLinks, type ChainLinksHandle } from "../chain/chain-links";
import { SWIVEL, Swivel } from "../chain/swivel";
import { STEEL } from "../finishes";
import { STRAP_TOPS } from "./leather";

/** 레킹볼 중심에서 회전 고리의 위쪽 고리까지의 높이입니다. 위쪽 사슬 한 가닥이 여기에 걸립니다. */
export const HANGING_HEIGHT = 0.75;

const D_RING = { radius: 0.02, tube: 0.0045, above: 0.012 } as const;
const SWIVEL_RING_BELOW = 0.075;
const SWIVEL_RING_Y = HANGING_HEIGHT - SWIVEL_RING_BELOW;

const UNSQUASHED = new Matrix4();

export interface HangingHandle {
  /** 몸통을 납작하게 만든 행렬을 받아, D링을 가죽 끈 탭 끝에 붙여 두고 사슬 가닥을 다시 잇습니다. */
  readonly follow: (squash: Matrix4) => void;
}

export interface HangingProps {
  readonly ref: Ref<HangingHandle>;
}

const RESTING_D_RINGS = dRingsOn(UNSQUASHED);
const RESTING_STRANDS = strandsFrom(RESTING_D_RINGS);

export function Hanging({ ref }: HangingProps) {
  const rings = useRef<(Mesh | null)[]>([]);
  const strands = useRef<ChainLinksHandle>(null);
  const applied = useRef(UNSQUASHED.clone());

  useImperativeHandle(
    ref,
    () => ({
      follow: (squash) => {
        if (squash.equals(applied.current)) {
          return;
        }

        const seats = dRingsOn(squash);

        seats.forEach((seat, i) => {
          rings.current[i]?.position.copy(seat);
        });
        strands.current?.place(strandsFrom(seats));
        applied.current.copy(squash);
      },
    }),
    [],
  );

  return (
    <>
      {RESTING_D_RINGS.map((seat, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            rings.current[i] = mesh;
          }}
          name="d-ring"
          castShadow
          receiveShadow
          position={seat}
          rotation-y={-(STRAP_TOPS[i]?.angle ?? 0)}
        >
          <torusGeometry args={[D_RING.radius, D_RING.tube, 8, 20]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}
      <ChainLinks ref={strands} name="strands" poses={RESTING_STRANDS} />
      <group position-y={SWIVEL_RING_Y}>
        <Swivel />
      </group>
    </>
  );
}

function dRingsOn(squash: Matrix4): Vector3[] {
  return STRAP_TOPS.map(({ position }) =>
    position
      .clone()
      .applyMatrix4(squash)
      .add(new Vector3(0, D_RING.above, 0)),
  );
}

function strandsFrom(dRings: readonly Vector3[]) {
  return dRings.flatMap((ring, i) => {
    const angle = STRAP_TOPS[i]?.angle ?? 0;
    const from = ring.clone().add(new Vector3(0, D_RING.radius, 0));
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
}
