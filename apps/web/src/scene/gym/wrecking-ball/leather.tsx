import { type Ref, useImperativeHandle, useRef } from "react";
import {
  type BufferAttribute,
  type BufferGeometry,
  type InterleavedBufferAttribute,
  type Mesh,
  type Quaternion,
  Vector3,
} from "three";

import { addBlotches, addGrain } from "../brushes";
import { STEEL } from "../finishes";
import { GYM } from "../measurements";
import { PaintedTexture, type Painting } from "../painted-texture";
import { dentedNormal, sinking } from "./impact";

/** 가죽 공의 패임입니다. at 은 공의 좌표에서 본 맞은 자리의 방향, depth 는 그 자리가 들어간 깊이(m)입니다. */
interface Dent {
  readonly at: Vector3;
  readonly depth: number;
}

export interface LeatherHandle {
  /** 가죽과 솔기를 이 패임 모양으로 바꿉니다. null 이면 둥근 모양으로 되돌립니다. 매 프레임 불러도 됩니다. */
  readonly dent: (dent: Dent | null) => void;
}

export interface LeatherProps {
  readonly ref: Ref<LeatherHandle>;
}

const { radius } = GYM.wreckingBall;

const LEATHER_ROUGHNESS = 0.65;
const SEAM = { color: "#3a2214", roughness: 0.8, tube: 0.006 } as const;
const SEAM_TURNS = [
  [Math.PI / 2, 0],
  [0, 0],
  [0, Math.PI / 2],
] as const;
const CAP_LEATHER = "#5a3420";
const CAP = { radius: 0.07, height: 0.04 } as const;
const SHACKLE = { radius: 0.03, tube: 0.008 } as const;

/** 공의 중심에서 사슬이 걸리는 걸이 꼭대기까지의 높이(m)입니다. */
export const HANGING_POINT = radius + CAP.height + SHACKLE.radius * 2;

const LEATHER: Painting = {
  width: 1024,
  height: 512,
  tiles: true,
  paint: (context) => {
    const { width, height } = context.canvas;

    context.fillStyle = "#7d4a2a";
    context.fillRect(0, 0, width, height);
    addBlotches(context, {
      count: 90,
      colors: [
        "rgba(60, 32, 16, 0.35)",
        "rgba(160, 106, 64, 0.25)",
        "rgba(40, 22, 12, 0.2)",
      ],
      maxRadius: 90,
      seed: 23,
    });
    addGrain(context, 18, 29);
  },
};

type Attribute = BufferAttribute | InterleavedBufferAttribute;

/** 패이기 전의 정점입니다. 솔기는 자기 좌표로 그려지므로 공의 좌표로 옮기는 회전을 함께 둡니다. */
interface Rest {
  readonly geometry: BufferGeometry;
  readonly positions: Float32Array;
  readonly toBall: Quaternion;
}

/** 가죽 공입니다. 가죽, 솔기 셋, 마개, 걸이로 이루어지고, 원점이 공의 중심입니다. */
export function Leather({ ref }: LeatherProps) {
  const sphere = useRef<Mesh>(null);
  const seams = useRef<(Mesh | null)[]>([]);
  const rest = useRef<{ readonly leather: Rest; readonly seams: Rest[] }>(null);
  const dented = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      dent: (dent) => {
        if (!dent && !dented.current) {
          return;
        }

        rest.current ??= restOf(sphere.current, seams.current);

        if (!rest.current) {
          return;
        }

        dentLeather(rest.current.leather, dent);
        rest.current.seams.forEach((seam) => {
          dentSeam(seam, dent);
        });
        dented.current = dent !== null;
      },
    }),
    [],
  );

  return (
    <mesh ref={sphere} castShadow receiveShadow>
      <sphereGeometry args={[radius, 48, 32]} />
      <meshStandardMaterial roughness={LEATHER_ROUGHNESS}>
        <PaintedTexture attach="map" painting={LEATHER} />
      </meshStandardMaterial>
      {SEAM_TURNS.map(([tilt, turn], i) => (
        <mesh
          key={`${tilt}-${turn}`}
          ref={(mesh) => {
            seams.current[i] = mesh;
          }}
          receiveShadow
          rotation-x={tilt}
          rotation-y={turn}
        >
          <torusGeometry args={[radius, SEAM.tube, 6, 96]} />
          <meshStandardMaterial color={SEAM.color} roughness={SEAM.roughness} />
        </mesh>
      ))}
      <mesh castShadow receiveShadow position-y={radius + CAP.height / 2}>
        <cylinderGeometry args={[CAP.radius, CAP.radius, CAP.height, 24]} />
        <meshStandardMaterial
          color={CAP_LEATHER}
          roughness={LEATHER_ROUGHNESS}
        />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position-y={radius + CAP.height + SHACKLE.radius}
      >
        <torusGeometry args={[SHACKLE.radius, SHACKLE.tube, 8, 24]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
    </mesh>
  );
}

function restOf(
  leather: Mesh | null,
  seams: readonly (Mesh | null)[],
): { readonly leather: Rest; readonly seams: Rest[] } | null {
  const seamMeshes = seams.filter((seam) => seam !== null);

  if (!leather || seamMeshes.length !== SEAM_TURNS.length) {
    return null;
  }

  return {
    leather: restOfMesh(leather),
    seams: seamMeshes.map(restOfMesh),
  };
}

function restOfMesh(mesh: Mesh): Rest {
  const { geometry } = mesh;

  return {
    geometry,
    positions: Float32Array.from(geometry.getAttribute("position").array),
    toBall: mesh.quaternion.clone(),
  };
}

const point = new Vector3();
const direction = new Vector3();

/** 가죽은 중심 쪽으로 들어가고, 법선도 패인 모양을 따라 기울어 그늘이 집니다. 둥근 가죽의 법선은 중심에서 본 방향입니다. */
function dentLeather(rest: Rest, dent: Dent | null): void {
  const positions = rest.geometry.getAttribute("position");
  const normals = rest.geometry.getAttribute("normal");

  for (let i = 0; i < positions.count; i++) {
    point.fromArray(rest.positions, i * 3);
    direction.copy(point).normalize();

    const normal = dent
      ? dentedNormal(direction, dent.at, dent.depth)
      : direction;

    point.addScaledVector(
      direction,
      dent ? -sinking(direction, dent.at, dent.depth) : 0,
    );
    positions.setXYZ(i, point.x, point.y, point.z);
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }

  changed(positions, normals);
}

/** 솔기는 가죽과 같은 만큼 들어가 가죽 위에 떠 보이지 않습니다. */
function dentSeam(rest: Rest, dent: Dent | null): void {
  const positions = rest.geometry.getAttribute("position");
  const toSeam = rest.toBall.clone().invert();

  for (let i = 0; i < positions.count; i++) {
    point.fromArray(rest.positions, i * 3);

    if (dent) {
      point.applyQuaternion(rest.toBall);
      direction.copy(point).normalize();
      point
        .addScaledVector(direction, -sinking(direction, dent.at, dent.depth))
        .applyQuaternion(toSeam);
    }

    positions.setXYZ(i, point.x, point.y, point.z);
  }

  changed(positions);
}

function changed(...attributes: Attribute[]): void {
  for (const attribute of attributes) {
    attribute.needsUpdate = true;
  }
}
