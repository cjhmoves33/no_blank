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

interface Dent {
  readonly onLeather: Vector3;
  readonly depth: number;
}

export interface LeatherHandle {
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

export const HANGING_HEIGHT = radius + CAP.height + SHACKLE.radius * 2;

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

interface UndentedMesh {
  readonly geometry: BufferGeometry;
  readonly positions: Float32Array;
  readonly toBall: Quaternion;
}

export function Leather({ ref }: LeatherProps) {
  const sphere = useRef<Mesh>(null);
  const seams = useRef<(Mesh | null)[]>([]);
  const rest = useRef<{
    readonly leather: UndentedMesh;
    readonly seams: UndentedMesh[];
  }>(null);
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
): {
  readonly leather: UndentedMesh;
  readonly seams: UndentedMesh[];
} | null {
  const seamMeshes = seams.filter((seam) => seam !== null);

  if (!leather || seamMeshes.length !== SEAM_TURNS.length) {
    return null;
  }

  return {
    leather: restOfMesh(leather),
    seams: seamMeshes.map(restOfMesh),
  };
}

function restOfMesh(mesh: Mesh): UndentedMesh {
  const { geometry } = mesh;

  return {
    geometry,
    positions: Float32Array.from(geometry.getAttribute("position").array),
    toBall: mesh.quaternion.clone(),
  };
}

const point = new Vector3();
const direction = new Vector3();

function dentLeather(rest: UndentedMesh, dent: Dent | null): void {
  const positions = rest.geometry.getAttribute("position");
  const normals = rest.geometry.getAttribute("normal");

  for (let i = 0; i < positions.count; i++) {
    point.fromArray(rest.positions, i * 3);
    direction.copy(point).normalize();

    const normal = dent
      ? dentedNormal(direction, dent.onLeather, dent.depth)
      : direction;

    point.addScaledVector(
      direction,
      dent ? -sinking(direction, dent.onLeather, dent.depth) : 0,
    );
    positions.setXYZ(i, point.x, point.y, point.z);
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }

  changed(positions, normals);
}

function dentSeam(rest: UndentedMesh, dent: Dent | null): void {
  const positions = rest.geometry.getAttribute("position");
  const toSeam = rest.toBall.clone().invert();

  for (let i = 0; i < positions.count; i++) {
    point.fromArray(rest.positions, i * 3);

    if (dent) {
      point.applyQuaternion(rest.toBall);
      direction.copy(point).normalize();
      point
        .addScaledVector(
          direction,
          -sinking(direction, dent.onLeather, dent.depth),
        )
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
