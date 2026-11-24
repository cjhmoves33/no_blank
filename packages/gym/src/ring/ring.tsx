import {
  BoxGeometry,
  BufferAttribute,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  Matrix4,
  TubeGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { Box } from "../building/slabs";
import { GYM } from "../measurements";
import { PaintedTexture } from "../painted-texture";
import { LOOK } from "./look";
import {
  MAT,
  MAT_RELIEF,
  PAD_GRIME,
  PAD_SEAMS,
  ROPE_GRIME,
  ROPE_RELIEF,
} from "./paintings";
import {
  CORNERS,
  PAD,
  ROPE_LINES,
  type RopeLine,
  type Tie,
  TIE_HEIGHT,
  TIES,
} from "./rigging";

const { ropes, mat } = GYM;
const HIGHEST_ROPE = ropes.heights[3];
const PLATFORM_HEIGHT = mat.y;
const POST_HEIGHT = HIGHEST_ROPE + 0.175;
const STEP_COUNT = 4;
const STEP_DEPTH = 0.275;
const MAT_FOLD = { depth: 0.06, overhang: 0.004 };
const TIE_STRAP = { width: 0.04, thickness: 0.004 };
const TIE_WRAP_RADIUS = ropes.radius + TIE_STRAP.thickness;
const RING_HALF = mat.half + MAT_FOLD.overhang;

/** 링은 원점에 놓이고, 이 상자가 매트와 코너 기둥, 계단을 덮습니다. */
export const RING_SIZE: Box = {
  min: [-RING_HALF, 0, -RING_HALF],
  max: [RING_HALF, mat.y + POST_HEIGHT, mat.half + STEP_DEPTH * STEP_COUNT],
};

// 로프를 한 메시로 합치므로, 로프마다의 색은 꼭짓점 색으로 줍니다.
function coloredRope({ level, curve }: RopeLine): TubeGeometry {
  const tube = new TubeGeometry(curve, 64, ropes.radius, 16);
  const color = new Color(LOOK.ropesFromBottom[level]);
  const colors = new Float32Array(tube.getAttribute("position").count * 3);

  for (let i = 0; i < colors.length; i += 3) {
    color.toArray(colors, i);
  }

  tube.setAttribute("color", new BufferAttribute(colors, 3));

  return tube;
}

const ROPE_GEOMETRY = mergeGeometries(ROPE_LINES.map(coloredRope));

function tieParts(tie: Tie): BufferGeometry[] {
  const place = new Matrix4().makeRotationY(tie.turn).setPosition(tie.position);
  const strapOffset = ropes.radius + TIE_STRAP.thickness / 2;
  const straps = [-strapOffset, strapOffset].map((x) =>
    new BoxGeometry(TIE_STRAP.thickness, TIE_HEIGHT, TIE_STRAP.width)
      .translate(x, 0, 0)
      .applyMatrix4(place),
  );
  const wraps = tie.wrapOffsets.map((offset) =>
    new CylinderGeometry(TIE_WRAP_RADIUS, TIE_WRAP_RADIUS, TIE_STRAP.width, 16)
      .rotateX(Math.PI / 2)
      .translate(offset.x, offset.y, offset.z)
      .applyMatrix4(place),
  );

  return [...straps, ...wraps];
}

const TIE_GEOMETRY = mergeGeometries(TIES.flatMap(tieParts));

const PAD_FACE = { side: 0, end: 1 } as const;

// BoxGeometry 의 면 순서는 +x, -x, +y, -y, +z, -z 입니다. 윗면과 아랫면에는 로프 자국과 박음질이 없습니다.
const PAD_GEOMETRY = (() => {
  const geometry = new RoundedBoxGeometry(
    PAD.width,
    PAD.top - PAD.bottom,
    PAD.depth,
    PAD.segments,
    PAD.radius,
  );

  geometry.groups.forEach((group, face) => {
    group.materialIndex =
      face === 2 || face === 3 ? PAD_FACE.end : PAD_FACE.side;
  });

  return geometry;
})();

export function Ring() {
  return (
    <group>
      <Platform />
      <Mat />
      {CORNERS.map((corner) => (
        <Corner key={`${corner.x}:${corner.z}`} {...corner} />
      ))}
      <mesh castShadow receiveShadow geometry={ROPE_GEOMETRY}>
        <meshPhysicalMaterial
          vertexColors
          roughness={0.55}
          clearcoat={0.15}
          clearcoatRoughness={0.5}
          bumpScale={0.4}
        >
          <PaintedTexture attach="map" painting={ROPE_GRIME} />
          <PaintedTexture attach="bumpMap" painting={ROPE_RELIEF} />
        </meshPhysicalMaterial>
      </mesh>
      <mesh castShadow receiveShadow geometry={TIE_GEOMETRY}>
        <meshStandardMaterial color={LOOK.ties} roughness={0.85} />
      </mesh>
      <Steps />
    </group>
  );
}

function Platform() {
  return (
    <>
      <mesh castShadow receiveShadow position-y={mat.y / 2 - 0.0025}>
        <boxGeometry
          args={[mat.half * 2, PLATFORM_HEIGHT - 0.005, mat.half * 2]}
        />
        <meshStandardMaterial color="#1c1a18" roughness={0.85} />
      </mesh>
      <mesh receiveShadow position-y={mat.y - 0.001 - MAT_FOLD.depth / 2}>
        <boxGeometry args={[RING_HALF * 2, MAT_FOLD.depth, RING_HALF * 2]} />
        <meshStandardMaterial color={LOOK.mat} roughness={0.93} />
      </mesh>
    </>
  );
}

function Mat() {
  return (
    <mesh receiveShadow position-y={mat.y} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[mat.half * 2, mat.half * 2]} />
      <meshStandardMaterial roughness={0.93} bumpScale={0.5}>
        <PaintedTexture attach="map" painting={MAT} />
        <PaintedTexture attach="bumpMap" painting={MAT_RELIEF} />
      </meshStandardMaterial>
    </mesh>
  );
}

interface CornerProps {
  readonly x: -1 | 1;
  readonly z: -1 | 1;
  readonly pad: string;
}

function Corner({ x, z, pad }: CornerProps) {
  return (
    <>
      <mesh
        castShadow
        receiveShadow
        position={[x * GYM.posts.at, mat.y + POST_HEIGHT / 2, z * GYM.posts.at]}
      >
        <cylinderGeometry
          args={[GYM.posts.radius, GYM.posts.radius, POST_HEIGHT, 24]}
        />
        <meshStandardMaterial
          color="#5a5f63"
          roughness={0.35}
          metalness={0.7}
        />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        geometry={PAD_GEOMETRY}
        position={[
          x * ropes.half,
          mat.y + (PAD.top + PAD.bottom) / 2,
          z * ropes.half,
        ]}
        rotation-y={Math.atan2(x, z)}
      >
        <meshPhysicalMaterial
          attach={`material-${PAD_FACE.side}`}
          color={pad}
          roughness={0.55}
          clearcoat={0.12}
          clearcoatRoughness={0.4}
          bumpScale={0.6}
        >
          <PaintedTexture attach="map" painting={PAD_GRIME} />
          <PaintedTexture attach="bumpMap" painting={PAD_SEAMS} />
        </meshPhysicalMaterial>
        <meshPhysicalMaterial
          attach={`material-${PAD_FACE.end}`}
          color={pad}
          roughness={0.55}
          clearcoat={0.12}
          clearcoatRoughness={0.4}
        />
      </mesh>
    </>
  );
}

function Steps() {
  const rise = PLATFORM_HEIGHT / STEP_COUNT;

  return (
    <group position-x={-mat.half + 0.7}>
      {Array.from({ length: STEP_COUNT }, (_, i) => {
        const height = rise * (i + 1);
        const depth = STEP_DEPTH * (STEP_COUNT - i);

        return (
          <mesh
            key={height}
            castShadow
            receiveShadow
            position={[0, height / 2, mat.half + depth / 2]}
          >
            <boxGeometry args={[0.8, height, depth]} />
            <meshStandardMaterial color="#4a3324" roughness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}
