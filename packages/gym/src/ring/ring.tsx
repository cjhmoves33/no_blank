import { extend } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

import type { Box } from "../building/slabs";
import { GYM } from "../measurements";
import { PaintedTexture } from "../painted-texture";
import { LOOK } from "./look";
import {
  MAT,
  MAT_RELIEF,
  PAD_SEAMS,
  PAD_WEAR,
  ROPE_COVER,
  ROPE_RELIEF,
} from "./paintings";
import { CORNERS, PAD, ROPES, type Tie, TIE_HEIGHT, TIES } from "./rigging";

const RoundedBox = extend(RoundedBoxGeometry);

const { ropes, mat } = GYM;
const HIGHEST_ROPE = ropes.heights[3];
const PLATFORM_HEIGHT = mat.y;
const POST_HEIGHT = HIGHEST_ROPE + 0.175;
const STEP_COUNT = 4;
const STEP_DEPTH = 0.275;
// 매트 천은 플랫폼 가장자리를 덮고 옆면으로 조금 접혀 내려갑니다.
const CANVAS_FOLD = { depth: 0.06, overhang: 0.004 };
const TIE_STRAP = { width: 0.04, thickness: 0.004 };
const TIE_WRAP_RADIUS = ropes.radius + TIE_STRAP.thickness;

/** 링은 원점에 놓이고, 이 상자가 매트와 코너 기둥, 계단을 덮습니다. */
export const RING_SIZE: Box = {
  min: [-mat.half, 0, -mat.half],
  max: [mat.half, mat.y + POST_HEIGHT, mat.half + STEP_DEPTH * STEP_COUNT],
};

export function Ring() {
  return (
    <group>
      <Platform />
      <Mat />
      {CORNERS.map((corner) => (
        <Corner key={`${corner.x}:${corner.z}`} {...corner} />
      ))}
      {ROPES.map((rope) => (
        <mesh key={rope.key} castShadow receiveShadow>
          <tubeGeometry args={[rope.curve, 64, ropes.radius, 16]} />
          <meshPhysicalMaterial
            color={LOOK.ropes[rope.level]}
            roughness={0.55}
            clearcoat={0.15}
            clearcoatRoughness={0.5}
            bumpScale={0.4}
          >
            <PaintedTexture attach="map" painting={ROPE_COVER} />
            <PaintedTexture attach="bumpMap" painting={ROPE_RELIEF} />
          </meshPhysicalMaterial>
        </mesh>
      ))}
      {TIES.map((tie) => (
        <RopeTie key={tie.key} tie={tie} />
      ))}
      <Steps />
    </group>
  );
}

function Platform() {
  const foldHalf = mat.half + CANVAS_FOLD.overhang;

  return (
    <>
      <mesh castShadow receiveShadow position-y={mat.y / 2 - 0.0025}>
        <boxGeometry
          args={[mat.half * 2, PLATFORM_HEIGHT - 0.005, mat.half * 2]}
        />
        <meshStandardMaterial color="#1c1a18" roughness={0.85} />
      </mesh>
      <mesh receiveShadow position-y={mat.y - 0.001 - CANVAS_FOLD.depth / 2}>
        <boxGeometry args={[foldHalf * 2, CANVAS_FOLD.depth, foldHalf * 2]} />
        <meshStandardMaterial color={LOOK.canvas} roughness={0.93} />
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

interface RopeTieProps {
  readonly tie: Tie;
}

/** 로프 네 줄의 안쪽과 바깥쪽을 세로로 지나며, 로프마다 한 바퀴씩 감기는 끈입니다. */
function RopeTie({ tie }: RopeTieProps) {
  const strapOffset = ropes.radius + TIE_STRAP.thickness / 2;

  return (
    <group position={tie.position} rotation-y={tie.turn}>
      {[-strapOffset, strapOffset].map((x) => (
        <mesh key={x} castShadow receiveShadow position-x={x}>
          <boxGeometry
            args={[TIE_STRAP.thickness, TIE_HEIGHT, TIE_STRAP.width]}
          />
          <meshStandardMaterial color={LOOK.ties} roughness={0.85} />
        </mesh>
      ))}
      {tie.wraps.map((wrap) => (
        <mesh
          key={wrap.y}
          castShadow
          receiveShadow
          position={wrap}
          rotation-x={Math.PI / 2}
        >
          <cylinderGeometry
            args={[TIE_WRAP_RADIUS, TIE_WRAP_RADIUS, TIE_STRAP.width, 16]}
          />
          <meshStandardMaterial color={LOOK.ties} roughness={0.85} />
        </mesh>
      ))}
    </group>
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
        position={[
          x * ropes.half,
          mat.y + (PAD.top + PAD.bottom) / 2,
          z * ropes.half,
        ]}
        rotation-y={Math.atan2(x, z)}
      >
        <RoundedBox args={[0.31, PAD.top - PAD.bottom, 0.17, 6, 0.075]} />
        <meshPhysicalMaterial
          color={pad}
          roughness={0.55}
          clearcoat={0.12}
          clearcoatRoughness={0.4}
          bumpScale={0.6}
        >
          <PaintedTexture attach="map" painting={PAD_WEAR} />
          <PaintedTexture attach="bumpMap" painting={PAD_SEAMS} />
        </meshPhysicalMaterial>
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
