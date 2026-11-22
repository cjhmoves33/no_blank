import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { MathUtils, type Mesh, type MeshStandardMaterial } from "three";

export interface SpinningShapeProps {
  readonly spinning: boolean;
  readonly onPress: () => void;
}

const SPIN_RADIANS_PER_SECOND = { x: 0.3, y: 0.5 };
const REST_ROTATION: [x: number, y: number, z: number] = [0.4, 0.6, 0];
const HOVER_GLOW = 0.15;
const PRESS_GLOW = 1.2;
const GLOW_DECAY = 6;

export function SpinningShape({ spinning, onPress }: SpinningShapeProps) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const pressGlow = useRef(0);
  const [hovered, setHovered] = useState(false);

  useFrame((_state, delta) => {
    if (!mesh.current || !material.current) {
      return;
    }

    if (spinning) {
      mesh.current.rotation.x += SPIN_RADIANS_PER_SECOND.x * delta;
      mesh.current.rotation.y += SPIN_RADIANS_PER_SECOND.y * delta;
    }

    pressGlow.current = MathUtils.damp(pressGlow.current, 0, GLOW_DECAY, delta);
    material.current.emissiveIntensity =
      (hovered ? HOVER_GLOW : 0) + pressGlow.current;
  });

  function handleClick(event: ThreeEvent<MouseEvent>) {
    // R3F 는 광선이 지나는 모든 오브젝트에 이벤트를 보내므로, 가장 앞의 오브젝트만 눌리도록 여기서 멈춥니다.
    event.stopPropagation();
    pressGlow.current = PRESS_GLOW;
    onPress();
  }

  return (
    <mesh
      ref={mesh}
      rotation={REST_ROTATION}
      onClick={handleClick}
      onPointerOver={() => {
        setHovered(true);
      }}
      onPointerOut={() => {
        setHovered(false);
      }}
    >
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        ref={material}
        color="#6366f1"
        emissive="#a5b4fc"
        roughness={0.35}
        metalness={0.1}
        flatShading
      />
    </mesh>
  );
}
