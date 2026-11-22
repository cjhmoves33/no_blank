import { STEEL } from "../finishes";
import { GYM } from "../measurements";

const X = -GYM.building.halfX + 1.4;
const BEAM = { y: GYM.floorY + 4.8, z: -1.25, length: 7, size: 0.15 } as const;
const HANGER_LENGTH = GYM.building.ceilingY - BEAM.y;
const BOTTOM_Y = GYM.floorY + 0.8;

const BAG = { radius: 0.2, length: 1.4 } as const;

const BAGS = [
  { z: -3.5, leather: "#5e2a22", lean: -0.015 },
  { z: -1.25, leather: "#2b2421", lean: 0.015 },
  { z: 1, leather: "#6a4127", lean: -0.015 },
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
            BEAM.z + end * (BEAM.length / 2 - 0.5),
          ]}
        >
          <cylinderGeometry args={[0.02, 0.02, HANGER_LENGTH, 8]} />
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
      <mesh position-y={BOTTOM_Y + 1.3}>
        <cylinderGeometry
          args={[BAG.radius + 0.0025, BAG.radius + 0.0025, 0.11, 24, 1, true]}
        />
        <meshStandardMaterial color="#cdc3ae" roughness={0.85} />
      </mesh>
      <mesh castShadow position-y={BEAM.y - chainLength / 2}>
        <cylinderGeometry args={[0.0125, 0.0125, chainLength, 6]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
    </group>
  );
}
