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
  CHAIN_REACH,
  farthestReach,
  restingSwing,
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
const CHAIN_LENGTH = CHAIN_REACH - CHAIN_BOTTOM;
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

export const WRECKING_BALL_SIZE: Box = {
  min: [-SWEEP, -radius, -SWEEP],
  max: [SWEEP, CHAIN_REACH, SWEEP],
};

const REST_LINKS = chainLinks(restingSwing().fromPivot);

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

    const { fromPivot } = swing.current;

    ball.current?.position.copy(fromPivot);
    ball.current?.quaternion.copy(facingPivot(fromPivot));
    chainLinks(fromPivot).forEach((link, i) => {
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

    const hitFromPivot = event.point
      .clone()
      .sub(pivot.current.getWorldPosition(new Vector3()));

    swing.current = strike(swing.current, hitFromPivot, feel);
    onStrike();
  }

  return (
    <>
      <mesh castShadow receiveShadow position-y={CHAIN_REACH + TO_CEILING / 2}>
        <cylinderGeometry args={[ROD_RADIUS, ROD_RADIUS, TO_CEILING, 8]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <group ref={pivot} position-y={CHAIN_REACH}>
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
        <group ref={ball} position-y={-CHAIN_REACH}>
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

function facingPivot(fromPivot: Vector3): Quaternion {
  return new Quaternion().setFromUnitVectors(
    UP,
    fromPivot.clone().negate().normalize(),
  );
}

interface ChainLink {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  readonly length: number;
}

function chainLinks(fromPivot: Vector3): ChainLink[] {
  const end = fromPivot
    .clone()
    .addScaledVector(fromPivot.clone().negate().normalize(), CHAIN_BOTTOM);
  const bow = visibleBendSide(fromPivot).multiplyScalar(
    sagOfSlackChain(end.length()),
  );
  const along = (t: number) =>
    end
      .clone()
      .multiplyScalar(t)
      .addScaledVector(bow, 4 * t * (1 - t));

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

function sagOfSlackChain(span: number): number {
  const slack = Math.max(CHAIN_LENGTH - span, 0);

  return Math.sqrt((3 * span * slack) / 8);
}

function visibleBendSide(fromPivot: Vector3): Vector3 {
  const side = new Vector3(fromPivot.x, 0, fromPivot.z).cross(UP);

  return side.lengthSq() > 0 ? side.normalize() : new Vector3(1, 0, 0);
}
