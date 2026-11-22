import { type ReactNode, useMemo } from "react";
import { FrontSide } from "three";

import { GYM } from "./measurements";

export type Point = readonly [x: number, y: number, z: number];

export interface Box {
  readonly min: Point;
  readonly max: Point;
}

interface SlabArrays {
  readonly position: Float32Array;
  readonly normal: Float32Array;
  readonly uv: Float32Array;
  readonly uv1: Float32Array;
  readonly index: Uint32Array;
}

type Axis = 0 | 1 | 2;

interface Face {
  readonly axis: Axis;
  /** 면 위에서 텍스처의 가로(u)와 세로(v)가 따라가는 월드 축입니다. */
  readonly u: Axis;
  readonly v: Axis;
  /** u 축과 v 축의 외적이 axis 의 + 쪽이면 1 입니다. 바깥에서 반시계로 감기 위해 씁니다. */
  readonly turn: 1 | -1;
}

// 벽(x, z 면)은 v 가 위를 향해 벽돌이 눕고, 바닥과 천장(y 면)은 u 가 x 를 따라 마루가 x 로 놓입니다.
const FACES: readonly Face[] = [
  { axis: 0, u: 2, v: 1, turn: -1 },
  { axis: 1, u: 0, v: 2, turn: -1 },
  { axis: 2, u: 0, v: 1, turn: 1 },
];

const ROOM_MIN: Point = [-GYM.room.halfX, GYM.floorY, -GYM.room.halfZ];
const ROOM_MAX: Point = [GYM.room.halfX, GYM.room.ceilingY, GYM.room.halfZ];

function roomFraction(axis: Axis, value: number): number {
  return (value - ROOM_MIN[axis]) / (ROOM_MAX[axis] - ROOM_MIN[axis]);
}

/**
 * 상자마다 면 6개(꼭짓점 24개, 삼각형 12개)를 이어 붙입니다.
 * - uv 는 월드 좌표를 tile 로 나눈 값이라, 텍스처가 모든 상자에서 같은 크기로 이어집니다.
 * - uv1 은 방 전체를 0~1 로 덮어서, 그림 하나(channel 1)로 모든 상자의 구석을 어둡게 합니다.
 */
export function slabArrays(boxes: readonly Box[], tile: number): SlabArrays {
  const faceCount = boxes.length * 6;
  const arrays: SlabArrays = {
    position: new Float32Array(faceCount * 12),
    normal: new Float32Array(faceCount * 12),
    uv: new Float32Array(faceCount * 8),
    uv1: new Float32Array(faceCount * 8),
    index: new Uint32Array(faceCount * 6),
  };
  let face = 0;

  for (const box of boxes) {
    for (const { axis, u, v, turn } of FACES) {
      for (const side of [-1, 1] as const) {
        writeFace(arrays, face, { box, tile, axis, u, v, turn, side });
        face++;
      }
    }
  }

  return arrays;
}

interface FacePlacement extends Face {
  readonly box: Box;
  readonly tile: number;
  readonly side: -1 | 1;
}

const CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

function writeFace(
  arrays: SlabArrays,
  face: number,
  { box, tile, axis, u, v, turn, side }: FacePlacement,
): void {
  const plane = side > 0 ? box.max[axis] : box.min[axis];

  const normal = [0, 0, 0];

  normal[axis] = side;

  CORNERS.forEach(([atU, atV], corner) => {
    const vertex = face * 4 + corner;
    const alongU = atU ? box.max[u] : box.min[u];
    const alongV = atV ? box.max[v] : box.min[v];
    const position = [0, 0, 0];

    position[axis] = plane;
    position[u] = alongU;
    position[v] = alongV;
    arrays.position.set(position, vertex * 3);
    arrays.normal.set(normal, vertex * 3);
    arrays.uv.set([alongU / tile, alongV / tile], vertex * 2);
    arrays.uv1.set(
      [roomFraction(u, alongU), roomFraction(v, alongV)],
      vertex * 2,
    );
  });

  const first = face * 4;
  const outward = turn * side > 0;

  arrays.index.set(
    outward
      ? [first, first + 1, first + 2, first, first + 2, first + 3]
      : [first, first + 2, first + 1, first, first + 3, first + 2],
    face * 6,
  );
}

interface SlabFinish {
  readonly color?: string;
  readonly roughness: number;
  readonly metalness?: number;
  readonly bumpScale?: number;
}

export interface SlabsProps {
  readonly boxes: readonly Box[];
  /** 텍스처 한 장이 덮는 월드 길이입니다. */
  readonly tile: number;
  readonly finish: SlabFinish;
  /** 재질에 붙일 PaintedTexture 들입니다. */
  readonly children?: ReactNode;
}

/**
 * 같은 마감의 상자들을 한 번에 그립니다.
 * 벽이 그림자를 드리워야 햇빛이 창으로만 들어오므로, 늘 그림자를 드리우고 받습니다.
 */
export function Slabs({ boxes, tile, finish, children }: SlabsProps) {
  const arrays = useMemo(() => slabArrays(boxes, tile), [boxes, tile]);

  return (
    <mesh castShadow receiveShadow>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[arrays.position, 3]}
        />
        <bufferAttribute attach="attributes-normal" args={[arrays.normal, 3]} />
        <bufferAttribute attach="attributes-uv" args={[arrays.uv, 2]} />
        <bufferAttribute attach="attributes-uv1" args={[arrays.uv1, 2]} />
        <bufferAttribute attach="index" args={[arrays.index, 1]} />
      </bufferGeometry>
      {/* three 는 기본으로 그림자 지도에 뒷면을 그려서, 천장과 벽이 맞닿은 모서리를 따라 햇빛이 샙니다. */}
      <meshStandardMaterial {...finish} shadowSide={FrontSide}>
        {children}
      </meshStandardMaterial>
    </mesh>
  );
}
