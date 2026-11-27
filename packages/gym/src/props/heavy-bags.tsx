import { useMemo } from "react";
import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  TorusGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { Box } from "../building/slabs";
import { PaintedTexture, type Painting } from "../painted-texture";
import {
  HEAVY_BAG_BELOW,
  HEAVY_BAG_REACH,
  HeavyBag,
  type TapeWrap,
} from "./heavy-bag";
import {
  bagLeather,
  PAINTED_STEEL,
  STEEL_TILE_METERS,
} from "./heavy-bag-paintings";

/** I형강 보입니다. 길이는 z 축을 따라 잽니다. */
const BEAM = {
  length: 7,
  height: 0.16,
  flange: 0.12,
  flangeThickness: 0.012,
  web: 0.008,
} as const;
const DROP = { size: 0.06, fromEnd: 0.5 } as const;
const PLATE = { size: 0.2, thickness: 0.012 } as const;
const BOLT = { radius: 0.01, height: 0.012 } as const;
const HOOK = {
  clamp: [0.14, 0.018, 0.06],
  shank: { radius: 0.008, length: 0.03 },
  eye: { radius: 0.024, tube: 0.006 },
} as const;
const BAG_BOTTOM = -4;

const HOOK_EYE_Y =
  -BEAM.height / 2 - HOOK.clamp[1] - HOOK.shank.length - HOOK.eye.radius;
// 위쪽 사슬은 걸쇠 고리의 안쪽 아래에 걸립니다.
const HOOK_Y = HOOK_EYE_Y - HOOK.eye.radius + HOOK.eye.tube;

interface BagSpot {
  readonly z: number;
  readonly leather: Painting;
  readonly turn: number;
  readonly tape: readonly TapeWrap[];
}

const BAGS = [
  {
    z: -2.25,
    turn: 0.5,
    tape: [],
    leather: bagLeather({
      leather: "#5e2a22",
      stripe: "rgba(214, 200, 170, 0.85)",
      wear: 0.55,
      seed: 31,
    }),
  },
  {
    z: 0,
    turn: -0.35,
    tape: [
      { height: 0.62, tilt: [0.02, -0.015] },
      { height: 0.66, tilt: [-0.012, 0.02] },
      { height: 0.86, tilt: [0.015, 0.01] },
    ],
    leather: bagLeather({
      leather: "#2b2421",
      stripe: "rgba(150, 40, 34, 0.9)",
      wear: 1,
      seed: 47,
    }),
  },
  {
    z: 2.25,
    turn: 2.2,
    tape: [],
    leather: bagLeather({
      leather: "#6a4127",
      stripe: "rgba(36, 52, 84, 0.9)",
      wear: 0.25,
      seed: 59,
    }),
  },
] as const satisfies readonly BagSpot[];

const HALF_WIDTH = Math.max(HEAVY_BAG_REACH, BEAM.flange / 2, PLATE.size / 2);

/** 천장까지 늘어나는 지지대는 뺀 크기입니다. */
export const HEAVY_BAGS_SIZE: Box = {
  min: [-HALF_WIDTH, BAG_BOTTOM - HEAVY_BAG_BELOW, -BEAM.length / 2],
  max: [
    HALF_WIDTH,
    BEAM.height / 2 + PLATE.thickness + BOLT.height,
    BEAM.length / 2,
  ],
};

export interface HeavyBagsProps {
  /** 보 가운데에서 천장까지의 높이입니다. 지지대가 이만큼 늘어납니다. */
  readonly toCeiling: number;
}

export function HeavyBags({ toCeiling }: HeavyBagsProps) {
  const hanger = useMemo(() => hangerGeometry(toCeiling), [toCeiling]);

  return (
    <>
      <mesh name="heavy-bag-hanger" geometry={hanger} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.6} metalness={0.35}>
          <PaintedTexture attach="map" painting={PAINTED_STEEL} />
        </meshStandardMaterial>
      </mesh>
      {BAGS.map(({ z, turn, tape, leather }) => (
        <group key={z} position={[0, HOOK_Y, z]}>
          <HeavyBag
            drop={HOOK_Y - BAG_BOTTOM}
            leather={leather}
            turn={turn}
            tape={tape}
          />
        </group>
      ))}
    </>
  );
}

// 걸이의 강철은 모두 한 재질이므로 하나로 합쳐 텍스처를 한 번만 올립니다.
function hangerGeometry(toCeiling: number): BufferGeometry {
  const { height, flange, flangeThickness, web, length } = BEAM;
  const dropLength = toCeiling - height / 2;
  const parts = [
    box(
      [flange, flangeThickness, length],
      [0, (height - flangeThickness) / 2, 0],
    ),
    box(
      [flange, flangeThickness, length],
      [0, -(height - flangeThickness) / 2, 0],
    ),
    box([web, height - 2 * flangeThickness, length], [0, 0, 0]),
    ...[-1, 1].flatMap((end) => {
      const z = end * (length / 2 - DROP.fromEnd);

      return [
        box(
          [DROP.size, dropLength, DROP.size],
          [0, height / 2 + dropLength / 2, z],
        ),
        box(
          [PLATE.size, PLATE.thickness, PLATE.size],
          [0, toCeiling - PLATE.thickness / 2, z],
        ),
        box(
          [PLATE.size * 0.8, PLATE.thickness, PLATE.size * 0.6],
          [0, height / 2 + PLATE.thickness / 2, z],
        ),
        ...boltsAround(
          [0, toCeiling - PLATE.thickness - BOLT.height / 2, z],
          PLATE.size * 0.35,
        ),
        ...boltsAround(
          [0, height / 2 + PLATE.thickness + BOLT.height / 2, z],
          PLATE.size * 0.3,
        ),
      ];
    }),
    ...BAGS.flatMap(({ z }) => [
      box(HOOK.clamp, [0, -height / 2 - HOOK.clamp[1] / 2, z]),
      new CylinderGeometry(
        HOOK.shank.radius,
        HOOK.shank.radius,
        HOOK.shank.length,
        10,
      ).translate(0, -height / 2 - HOOK.clamp[1] - HOOK.shank.length / 2, z),
      new TorusGeometry(HOOK.eye.radius, HOOK.eye.tube, 8, 20).translate(
        0,
        HOOK_EYE_Y,
        z,
      ),
    ]),
  ];

  return mergeGeometries(parts);
}

// 상자마다 면 전체에 텍스처 한 장을 늘이면 긴 보에서 무늬가 길게 늘어지므로, 미터 단위로 반복해 깝니다.
function box(
  size: readonly [number, number, number],
  [x, y, z]: readonly [number, number, number],
): BoxGeometry {
  const geometry = new BoxGeometry(...size).translate(x, y, z);
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const uvs = geometry.getAttribute("uv");

  for (let i = 0; i < positions.count; i++) {
    const [u, v] = acrossFace(
      [positions.getX(i), positions.getY(i), positions.getZ(i)],
      [normals.getX(i), normals.getY(i), normals.getZ(i)],
    );

    uvs.setXY(i, u / STEEL_TILE_METERS, v / STEEL_TILE_METERS);
  }

  return geometry;
}

function acrossFace(
  [x, y, z]: readonly [number, number, number],
  [nx, ny]: readonly [number, number, number],
): [number, number] {
  if (Math.abs(nx) > 0.5) {
    return [z, y];
  }

  if (Math.abs(ny) > 0.5) {
    return [z, x];
  }

  return [x, y];
}

function boltsAround(
  [x, y, z]: readonly [number, number, number],
  offset: number,
): CylinderGeometry[] {
  return [-1, 1].flatMap((dx) =>
    [-1, 1].map((dz) =>
      new CylinderGeometry(BOLT.radius, BOLT.radius, BOLT.height, 6).translate(
        x + dx * offset,
        y,
        z + dz * offset,
      ),
    ),
  );
}
