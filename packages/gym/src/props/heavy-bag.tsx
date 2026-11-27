import { useMemo } from "react";
import { DoubleSide, Quaternion, Vector3 } from "three";

import {
  linkCount,
  type LinkPose,
  linksAlong,
  turnedRing,
} from "../chain/chain";
import { ChainLinks } from "../chain/chain-links";
import { SWIVEL, Swivel, SWIVEL_EYE, SwivelEye } from "../chain/swivel";
import { STEEL } from "../finishes";
import { PaintedTexture, type Painting } from "../painted-texture";
import { BAG_GRAIN, TAPE_GRIME, TAPE_WEAVE } from "./heavy-bag-paintings";
import {
  BAG,
  bagBody,
  BOTTOM_SAG,
  PILLOW,
  SEAM_ANGLES,
  sideRadius,
  WIDEST,
} from "./heavy-bag-shape";

const STRAP = {
  width: 0.045,
  down: 0.16,
  lift: 0.003,
  thickness: 0.006,
  above: 0.03,
} as const;
const D_RING = { radius: 0.022, tube: 0.005 } as const;
const SWIVEL_ABOVE_LID = 0.4;
// 회전 고리의 아래쪽 고리에서 위쪽 사슬이 걸리는 곳까지의 높이입니다. 레킹볼과 같은 회전 고리입니다.
const CHAIN_END_ABOVE_SWIVEL = 0.075;
const BOTTOM_LOOP = { radius: 0.03, tube: 0.007 } as const;
const TAPE = { width: 0.05, over: 0.005 } as const;
// 손으로 감은 테이프는 이 각도(라디안)보다 덜 기웁니다.
const MOST_TAPE_TILT = 0.03;

/** 회전 고리 축에서 잰, 샌드백 한 덩어리가 가장 멀리 나오는 거리입니다. 어느 쪽으로 돌아가도 이 안에 있습니다. */
export const HEAVY_BAG_REACH = Math.max(
  BAG.radius + STRAP.thickness / 2 + D_RING.radius + D_RING.tube,
  WIDEST + TAPE.over + (TAPE.width / 2) * Math.sin(MOST_TAPE_TILT),
);

/** 몸통 바닥 가장자리에서 아래로, 바닥 가운데의 가죽 고리 끝까지의 거리입니다. */
export const HEAVY_BAG_BELOW =
  BOTTOM_SAG + BOTTOM_LOOP.radius + BOTTOM_LOOP.tube;

const LEATHER = { roughness: 0.62, grainDepth: 2.5 } as const;
const STRAP_COLOR = "#2a1a12";

/** 몸통에 감은 덕트 테이프 한 바퀴입니다. 사람이 손으로 감아서 조금씩 기울었습니다. */
export interface TapeWrap {
  /** 바닥에서 테이프 가운데까지의 높이입니다. */
  readonly height: number;
  readonly tilt: readonly [x: number, z: number];
}

export interface HeavyBagProps {
  /** 걸쇠에서 몸통 바닥까지의 높이입니다. 걸쇠를 원점에 두고 그립니다. */
  readonly drop: number;
  readonly leather: Painting;
  /** 회전 고리 아래가 y 축 둘레로 돌아간 각도입니다. */
  readonly turn: number;
  readonly tape: readonly TapeWrap[];
}

/** 샌드백 하나입니다. 위쪽 사슬과 회전 고리의 위쪽 고리 아래로 몸통, 가죽 끈, D링, 사슬 가닥이 한 덩어리로 매달립니다. */
export function HeavyBag({ drop, leather, turn, tape }: HeavyBagProps) {
  const hanging = useMemo(() => hangingOf(drop), [drop]);
  const body = useMemo(() => bagBody(), []);

  return (
    <>
      <ChainLinks name="heavy-bag-chain" poses={hanging.upperChain} />
      <SwivelEye
        position={hanging.eye.position}
        quaternion={hanging.eye.quaternion}
      />
      <group position-y={hanging.chainEnd} rotation-y={turn}>
        <group position-y={-hanging.chainEnd}>
          <group position-y={hanging.swivelY}>
            <Swivel />
          </group>
          <ChainLinks name="heavy-bag-strands" poses={hanging.strands} />
          {hanging.dRings.map(({ position, angle }) => (
            <mesh
              key={angle}
              name="d-ring"
              castShadow
              receiveShadow
              position={position}
              rotation-y={angle - Math.PI / 2}
            >
              <torusGeometry args={[D_RING.radius, D_RING.tube, 8, 20]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
          ))}
          <group position-y={-drop}>
            <mesh name="heavy-bag" geometry={body} castShadow receiveShadow>
              <meshStandardMaterial
                roughness={LEATHER.roughness}
                bumpScale={LEATHER.grainDepth}
              >
                <PaintedTexture attach="map" painting={leather} />
                <PaintedTexture attach="bumpMap" painting={BAG_GRAIN} />
              </meshStandardMaterial>
            </mesh>
            <Straps />
            <mesh castShadow position-y={-BOTTOM_SAG} rotation-z={Math.PI}>
              <torusGeometry
                args={[BOTTOM_LOOP.radius, BOTTOM_LOOP.tube, 8, 16, Math.PI]}
              />
              <meshStandardMaterial color={STRAP_COLOR} roughness={0.7} />
            </mesh>
            {tape.map(({ height, tilt }) => (
              <mesh
                key={height}
                name="tape"
                castShadow
                receiveShadow
                position-y={height}
                rotation-x={tilt[0]}
                rotation-z={tilt[1]}
              >
                <cylinderGeometry
                  args={[
                    sideRadius(height) + PILLOW + TAPE.over,
                    sideRadius(height) + PILLOW + TAPE.over,
                    TAPE.width,
                    64,
                    1,
                    true,
                  ]}
                />
                <meshStandardMaterial
                  roughness={0.55}
                  metalness={0.15}
                  bumpScale={1.5}
                  side={DoubleSide}
                >
                  <PaintedTexture attach="map" painting={TAPE_GRIME} />
                  <PaintedTexture attach="bumpMap" painting={TAPE_WEAVE} />
                </meshStandardMaterial>
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </>
  );
}

const STRAP_TOP = BAG.height - BAG.edge;
const STRAP_RADIUS = sideRadius(STRAP_TOP - STRAP.down / 2) + STRAP.lift;
const STRAP_ARC = STRAP.width / STRAP_RADIUS;

// 가죽 끈은 솔기 위에 박혀 옆면을 따라 내려오고, 윗면 가장자리 위로 탭이 솟아 D링을 붙잡습니다.
function Straps() {
  return SEAM_ANGLES.map((angle) => (
    <group key={angle}>
      <mesh castShadow receiveShadow position-y={STRAP_TOP - STRAP.down / 2}>
        <cylinderGeometry
          args={[
            STRAP_RADIUS,
            STRAP_RADIUS,
            STRAP.down,
            8,
            1,
            true,
            angle - STRAP_ARC / 2,
            STRAP_ARC,
          ]}
        />
        <meshStandardMaterial
          color={STRAP_COLOR}
          roughness={0.65}
          side={DoubleSide}
        />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position={[
          Math.sin(angle) * (BAG.radius + STRAP.thickness / 2),
          (STRAP_TOP + BAG.height + STRAP.above) / 2,
          Math.cos(angle) * (BAG.radius + STRAP.thickness / 2),
        ]}
        rotation-y={angle}
      >
        <boxGeometry
          args={[
            STRAP.width * 0.8,
            BAG.height + STRAP.above - STRAP_TOP,
            STRAP.thickness,
          ]}
        />
        <meshStandardMaterial color={STRAP_COLOR} roughness={0.65} />
      </mesh>
    </group>
  ));
}

interface DRing {
  readonly position: Vector3;
  readonly angle: number;
}

interface Hanging {
  readonly upperChain: LinkPose[];
  readonly eye: LinkPose;
  readonly chainEnd: number;
  readonly swivelY: number;
  readonly dRings: DRing[];
  readonly strands: LinkPose[];
}

// 걸쇠(원점)에서 몸통 바닥(-drop)까지, 사슬과 고리가 놓일 자리를 정합니다.
function hangingOf(drop: number): Hanging {
  const lid = -drop + BAG.height;
  const swivelY = lid + SWIVEL_ABOVE_LID;
  const chainEnd = swivelY + CHAIN_END_ABOVE_SWIVEL;
  const top = new Vector3(0, 0, 0);
  const end = new Vector3(0, chainEnd, 0);
  const upperChain = linksAlong(
    (t) => top.clone().lerp(end, t),
    linkCount(-chainEnd),
  );
  const last = upperChain.at(-1);
  const ringY = lid + STRAP.above + D_RING.radius - D_RING.tube;
  const dRings = SEAM_ANGLES.map((angle) => ({
    angle,
    position: new Vector3(
      Math.sin(angle) * (BAG.radius + STRAP.thickness / 2),
      ringY,
      Math.cos(angle) * (BAG.radius + STRAP.thickness / 2),
    ),
  }));
  const strands = dRings.flatMap(({ position, angle }) => {
    const from = position.clone().add(new Vector3(0, D_RING.radius, 0));
    const to = new Vector3(
      0.012 * Math.sin(angle),
      swivelY - SWIVEL.ring.radius + SWIVEL.ring.tube,
      0.012 * Math.cos(angle),
    );

    return linksAlong(
      (t) => from.clone().lerp(to, t),
      linkCount(from.distanceTo(to)),
    );
  });

  return {
    upperChain,
    eye: {
      position: end.clone().add(new Vector3(0, -SWIVEL_EYE.radius, 0)),
      quaternion: last ? turnedRing(last) : new Quaternion(),
    },
    chainEnd,
    swivelY,
    dRings,
    strands,
  };
}
