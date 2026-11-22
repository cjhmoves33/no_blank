import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { type Group, type Mesh, Quaternion, Vector3 } from "three";

import { addBlotches, addGrain } from "../brushes";
import type { Box } from "../building/slabs";
import { STEEL } from "../finishes";
import { GYM } from "../measurements";
import { PaintedTexture, type Painting } from "../painted-texture";
import {
  advance,
  farthestReach,
  restingSwing,
  ROPE,
  strike,
  SWING_FEEL,
} from "./swing";

export interface WreckingBallProps {
  readonly reducedMotion: boolean;
  readonly onStrike: () => void;
}

const { radius, pivotY } = GYM.wreckingBall;
const TO_CEILING = GYM.building.ceilingY - pivotY;

const LEATHER_ROUGHNESS = 0.65;
const SEAM = { color: "#3a2214", roughness: 0.8, tube: 0.006 } as const;
const CAP_LEATHER = "#5a3420";
const CAP = { radius: 0.07, height: 0.04 } as const;
const SHACKLE = { radius: 0.03, tube: 0.008 } as const;
const CHAIN_RADIUS = 0.0125;
const ROD_RADIUS = 0.02;
const CHAIN_BOTTOM = radius + CAP.height + SHACKLE.radius * 2;
const CHAIN_LENGTH = ROPE - CHAIN_BOTTOM;
const LINKS = 12;
const PRIMARY_BUTTON = 0;
// 탭이 가려졌다 돌아오면 delta 가 몇 초가 되므로, 그동안의 흔들림은 건너뜁니다.
const LONGEST_FRAME = 0.1;
const UP = new Vector3(0, 1, 0);
const SWEEP = farthestReach() + radius;

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

/** 원점은 멈춰 있을 때의 공 중심이고, 공이 흔들리며 지나는 자리까지 담습니다. 매단 지점에서 천장까지 늘어나는 걸이는 뺀 크기입니다. */
export const WRECKING_BALL_SIZE: Box = {
  min: [-SWEEP, -radius, -SWEEP],
  max: [SWEEP, ROPE, SWEEP],
};

const REST_LINKS = chainLinks(restingSwing().position);

export function WreckingBall({ reducedMotion, onStrike }: WreckingBallProps) {
  const pivot = useRef<Group>(null);
  const ball = useRef<Group>(null);
  const links = useRef<(Mesh | null)[]>([]);
  const swing = useRef(restingSwing());
  const feel = reducedMotion ? SWING_FEEL.reduced : SWING_FEEL.normal;

  useFrame((_state, delta) => {
    swing.current = advance(
      swing.current,
      Math.min(delta, LONGEST_FRAME),
      feel,
    );

    const { position } = swing.current;

    ball.current?.position.copy(position);
    ball.current?.quaternion.copy(facingPivot(position));
    chainLinks(position).forEach((link, i) => {
      const mesh = links.current[i];

      mesh?.position.copy(link.position);
      mesh?.quaternion.copy(link.quaternion);
      mesh?.scale.setY(link.length);
    });
  });

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    if (event.button !== PRIMARY_BUTTON || !pivot.current) {
      return;
    }

    // R3F 는 광선이 지나는 모든 오브젝트에 이벤트를 보내므로, 가장 앞의 오브젝트만 맞도록 여기서 멈춥니다.
    event.stopPropagation();
    event.nativeEvent.stopPropagation();

    const hit = event.point
      .clone()
      .sub(pivot.current.getWorldPosition(new Vector3()));

    swing.current = strike(swing.current, hit, feel);
    onStrike();
  }

  return (
    <>
      <mesh castShadow receiveShadow position-y={ROPE + TO_CEILING / 2}>
        <cylinderGeometry args={[ROD_RADIUS, ROD_RADIUS, TO_CEILING, 8]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <group ref={pivot} position-y={ROPE}>
        {REST_LINKS.map((link, i) => (
          <mesh
            key={i}
            ref={(mesh) => {
              links.current[i] = mesh;
            }}
            castShadow
            receiveShadow
            position={link.position}
            quaternion={link.quaternion}
            scale-y={link.length}
          >
            <cylinderGeometry args={[CHAIN_RADIUS, CHAIN_RADIUS, 1, 6]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        ))}
        <group ref={ball} position-y={-ROPE}>
          <mesh castShadow receiveShadow onPointerDown={handlePointerDown}>
            <sphereGeometry args={[radius, 48, 32]} />
            <meshStandardMaterial roughness={LEATHER_ROUGHNESS}>
              <PaintedTexture attach="map" painting={LEATHER} />
            </meshStandardMaterial>
            {[
              [Math.PI / 2, 0],
              [0, 0],
              [0, Math.PI / 2],
            ].map(([tilt, turn]) => (
              <mesh
                key={`${tilt}-${turn}`}
                receiveShadow
                rotation-x={tilt}
                rotation-y={turn}
              >
                <torusGeometry args={[radius, SEAM.tube, 6, 96]} />
                <meshStandardMaterial
                  color={SEAM.color}
                  roughness={SEAM.roughness}
                />
              </mesh>
            ))}
            <mesh castShadow receiveShadow position-y={radius + CAP.height / 2}>
              <cylinderGeometry
                args={[CAP.radius, CAP.radius, CAP.height, 24]}
              />
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
        </group>
      </group>
    </>
  );
}

/** 공은 마개가 매단 지점을 보도록 기웁니다. */
function facingPivot(position: Vector3): Quaternion {
  return new Quaternion().setFromUnitVectors(
    UP,
    position.clone().negate().normalize(),
  );
}

interface ChainLink {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  readonly length: number;
}

/**
 * 매단 지점(원점)에서 공의 고리까지 사슬을 마디로 나눠 놓습니다.
 * 공이 들려 사슬이 느슨해지면, 같은 길이의 사슬이 옆으로 휜 포물선이 되게 그립니다.
 */
function chainLinks(position: Vector3): ChainLink[] {
  const end = position
    .clone()
    .addScaledVector(position.clone().negate().normalize(), CHAIN_BOTTOM);
  const span = end.length();
  const sag = Math.sqrt((3 * span * Math.max(CHAIN_LENGTH - span, 0)) / 8);
  // 공은 대개 카메라 반대쪽으로 밀리므로, 밀린 방향의 옆으로 휘어야 화면에서 보입니다.
  const side = new Vector3(position.x, 0, position.z).cross(UP);

  if (side.lengthSq() === 0) {
    side.set(1, 0, 0);
  }

  // 2차 베지어 곡선은 가운데에서 조절점까지 거리의 절반만큼 휩니다.
  const bend = end
    .clone()
    .multiplyScalar(0.5)
    .addScaledVector(side.normalize(), 2 * sag);
  const along = (t: number) =>
    bend
      .clone()
      .multiplyScalar(2 * t * (1 - t))
      .addScaledVector(end, t * t);

  return Array.from({ length: LINKS }, (_, i) => {
    const from = along(i / LINKS);
    const to = along((i + 1) / LINKS);
    const length = from.distanceTo(to);

    return {
      position: from.clone().add(to).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(
        UP,
        to.clone().sub(from).divideScalar(length),
      ),
      length,
    };
  });
}
