import { type Ref, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { type InstancedMesh, Matrix4, Vector3 } from "three";

import { STEEL } from "../finishes";
import { CHAIN_LINK, type LinkPose } from "./chain";

export interface ChainLinksHandle {
  readonly place: (poses: readonly LinkPose[]) => void;
}

export interface ChainLinksProps {
  readonly poses: readonly LinkPose[];
  readonly ref?: Ref<ChainLinksHandle>;
}

const STRETCH = new Vector3(1, CHAIN_LINK.stretch, 1);
const matrix = new Matrix4();

export function ChainLinks({ poses, ref }: ChainLinksProps) {
  const links = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (links.current) {
      place(links.current, poses);
    }
  }, [poses]);

  useImperativeHandle(
    ref,
    () => ({
      place: (next) => {
        if (links.current) {
          place(links.current, next);
        }
      },
    }),
    [],
  );

  return (
    <instancedMesh
      ref={links}
      args={[undefined, undefined, poses.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      <torusGeometry args={[CHAIN_LINK.radius, CHAIN_LINK.wire, 6, 14]} />
      <meshStandardMaterial {...STEEL} />
    </instancedMesh>
  );
}

function place(links: InstancedMesh, poses: readonly LinkPose[]): void {
  poses.forEach(({ position, quaternion }, i) => {
    links.setMatrixAt(i, matrix.compose(position, quaternion, STRETCH));
  });
  links.instanceMatrix.needsUpdate = true;
}
