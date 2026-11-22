import { STEEL } from "../finishes";
import { GYM } from "../measurements";

const X = -GYM.building.halfX + 2.8;
const BEAM = { y: GYM.floorY + 9.6, z: -2.5, length: 14, size: 0.3 } as const;
const HANGER_LENGTH = GYM.building.ceilingY - BEAM.y;
const BOTTOM_Y = GYM.floorY + 1.6;

const BAG = { radius: 0.4, length: 2.8 } as const;

const BAGS = [
  { z: -7, leather: "#5e2a22", lean: -0.015 },
  { z: -2.5, leather: "#2b2421", lean: 0.015 },
  { z: 2, leather: "#6a4127", lean: -0.015 },
] as const;

export function HeavyBags() {
  return (
    <group position-x={X}>
      <mesh castShadow receiveShadow position={[0, BEAM.y, BEAM.z]}>
        <boxGeometry args={[BEAM.size, BEAM.size, BEAM.length]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {[-1, 1].map((end) => (
        <mesh
          key={end}
          castShadow
          position={[
            0,
            BEAM.y + HANGER_LENGTH / 2,
            BEAM.z + end * (BEAM.length / 2 - 1),
          ]}
        >
          <cylinderGeometry args={[0.04, 0.04, HANGER_LENGTH, 8]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}
      {BAGS.map((bag) => (
        <HeavyBag key={bag.z} {...bag} />
      ))}
    </group>
  );
}

interface HeavyBagProps {
  readonly z: number;
  readonly leather: string;
  readonly lean: number;
}

function HeavyBag({ z, leather, lean }: HeavyBagProps) {
  const topY = BOTTOM_Y + BAG.length + BAG.radius * 2;
  const chainLength = BEAM.y - topY;

  return (
    <group position-z={z}>
      <mesh
        castShadow
        receiveShadow
        position-y={(BOTTOM_Y + topY) / 2}
        rotation-z={lean}
      >
        <capsuleGeometry args={[BAG.radius, BAG.length, 8, 24]} />
        <meshStandardMaterial color={leather} roughness={0.6} />
      </mesh>
      <mesh position-y={BOTTOM_Y + 2.6}>
        <cylinderGeometry
          args={[BAG.radius + 0.005, BAG.radius + 0.005, 0.22, 24, 1, true]}
        />
        <meshStandardMaterial color="#cdc3ae" roughness={0.85} />
      </mesh>
      <mesh castShadow position-y={BEAM.y - chainLength / 2}>
        <cylinderGeometry args={[0.025, 0.025, chainLength, 6]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
    </group>
  );
}
