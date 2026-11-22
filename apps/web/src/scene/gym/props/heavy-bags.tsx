import type { Box } from "../building/slabs";
import { STEEL } from "../finishes";

// 기준점은 샌드백 세 개를 단 보의 가운데입니다.
const BEAM = { length: 7, size: 0.15 } as const;
const BAG = { radius: 0.2, length: 1.4 } as const;
const BAG_BOTTOM = -4;
// 기울어진 샌드백의 끝은 옆으로 1.5 cm 쯤 비켜납니다.
const SWAY = 0.02;

const BAGS = [
  { z: -2.25, leather: "#5e2a22", lean: -0.015 },
  { z: 0, leather: "#2b2421", lean: 0.015 },
  { z: 2.25, leather: "#6a4127", lean: -0.015 },
] as const;

/** 천장까지 늘어나는 걸이는 뺀 크기입니다. */
export const HEAVY_BAGS_SIZE: Box = {
  min: [-BAG.radius - SWAY, BAG_BOTTOM, -BEAM.length / 2],
  max: [BAG.radius + SWAY, BEAM.size / 2, BEAM.length / 2],
};

export interface HeavyBagsProps {
  /** 보에서 천장까지의 높이입니다. 걸이가 이만큼 늘어납니다. */
  readonly toCeiling: number;
}

export function HeavyBags({ toCeiling }: HeavyBagsProps) {
  return (
    <>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[BEAM.size, BEAM.size, BEAM.length]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {[-1, 1].map((end) => (
        <mesh
          key={end}
          castShadow
          position={[0, toCeiling / 2, end * (BEAM.length / 2 - 0.5)]}
        >
          <cylinderGeometry args={[0.02, 0.02, toCeiling, 8]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}
      {BAGS.map((bag) => (
        <HeavyBag key={bag.z} {...bag} />
      ))}
    </>
  );
}

interface HeavyBagProps {
  readonly z: number;
  readonly leather: string;
  readonly lean: number;
}

function HeavyBag({ z, leather, lean }: HeavyBagProps) {
  const topY = BAG_BOTTOM + BAG.length + BAG.radius * 2;
  const chainLength = -topY;

  return (
    <group position-z={z}>
      <mesh
        castShadow
        receiveShadow
        position-y={(BAG_BOTTOM + topY) / 2}
        rotation-z={lean}
      >
        <capsuleGeometry args={[BAG.radius, BAG.length, 8, 24]} />
        <meshStandardMaterial color={leather} roughness={0.6} />
      </mesh>
      <mesh position-y={BAG_BOTTOM + 1.3}>
        <cylinderGeometry
          args={[BAG.radius + 0.0025, BAG.radius + 0.0025, 0.11, 24, 1, true]}
        />
        <meshStandardMaterial color="#cdc3ae" roughness={0.85} />
      </mesh>
      <mesh castShadow position-y={-chainLength / 2}>
        <cylinderGeometry args={[0.0125, 0.0125, chainLength, 6]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
    </group>
  );
}
