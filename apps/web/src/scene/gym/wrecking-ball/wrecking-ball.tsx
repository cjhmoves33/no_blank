import type { ThreeEvent } from "@react-three/fiber";

import { addBlotches, addGrain } from "../brushes";
import type { Box } from "../building/slabs";
import { STEEL } from "../finishes";
import { GYM } from "../measurements";
import { PaintedTexture, type Painting } from "../painted-texture";

export interface WreckingBallProps {
  readonly onStrike: () => void;
}

const { center, radius, pivotY } = GYM.wreckingBall;
const TO_PIVOT = pivotY - center[1];
const TO_CEILING = GYM.building.ceilingY - pivotY;

const LEATHER_ROUGHNESS = 0.65;
const SEAM = { color: "#3a2214", roughness: 0.8, tube: 0.006 } as const;
const CAP_LEATHER = "#5a3420";
const CAP = { radius: 0.07, height: 0.04 } as const;
const SHACKLE = { radius: 0.03, tube: 0.008 } as const;
const CHAIN_RADIUS = 0.0125;
const ROD_RADIUS = 0.02;
const CHAIN_BOTTOM = radius + CAP.height + SHACKLE.radius * 2;
const CHAIN_LENGTH = TO_PIVOT - CHAIN_BOTTOM;
const PRIMARY_BUTTON = 0;

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

/** 원점은 멈춰 있을 때의 공 중심입니다. 매단 지점에서 천장까지 늘어나는 걸이는 뺀 크기입니다. */
export const WRECKING_BALL_SIZE: Box = {
  min: [-radius, -radius, -radius],
  max: [radius, TO_PIVOT, radius],
};

export function WreckingBall({ onStrike }: WreckingBallProps) {
  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    if (event.button !== PRIMARY_BUTTON) {
      return;
    }

    // R3F 는 광선이 지나는 모든 오브젝트에 이벤트를 보내므로, 가장 앞의 오브젝트만 맞도록 여기서 멈춥니다.
    event.stopPropagation();
    event.nativeEvent.stopPropagation();
    onStrike();
  }

  return (
    <>
      <mesh castShadow receiveShadow position-y={TO_PIVOT + TO_CEILING / 2}>
        <cylinderGeometry args={[ROD_RADIUS, ROD_RADIUS, TO_CEILING, 8]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position-y={CHAIN_BOTTOM + CHAIN_LENGTH / 2}
      >
        <cylinderGeometry
          args={[CHAIN_RADIUS, CHAIN_RADIUS, CHAIN_LENGTH, 6]}
        />
        <meshStandardMaterial {...STEEL} />
      </mesh>
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
    </>
  );
}
