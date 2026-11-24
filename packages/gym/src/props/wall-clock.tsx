import type { Box } from "../building/slabs";
import { STEEL } from "../finishes";
import { PaintedTexture, type Painting } from "../painted-texture";

const RIM = { radius: 0.375, depth: 0.06 } as const;
const FACE_RADIUS = 0.34;

const HANDS = [
  { turn: (5 + 20 / 60) / 12, length: 0.22, width: 9 },
  { turn: 20 / 60, length: 0.34, width: 6 },
] as const;

const FACE: Painting = {
  width: 256,
  height: 256,
  tiles: false,
  paint: (context) => {
    const { width, height } = context.canvas;

    context.fillStyle = "#efe7d6";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#1b1b1b";
    context.lineCap = "round";

    for (let hour = 0; hour < 12; hour++) {
      context.lineWidth = hour % 3 === 0 ? 9 : 4;
      strokeFromCenter(context, hour / 12, [0.4, 0.46]);
    }

    for (const hand of HANDS) {
      context.lineWidth = hand.width;
      strokeFromCenter(context, hand.turn, [0, hand.length]);
    }
  },
};

function strokeFromCenter(
  context: CanvasRenderingContext2D,
  turn: number,
  [from, to]: readonly [number, number],
): void {
  const size = context.canvas.width;
  const angle = turn * Math.PI * 2;
  const pointAt = (fraction: number) =>
    [
      size / 2 + Math.sin(angle) * size * fraction,
      size / 2 - Math.cos(angle) * size * fraction,
    ] as const;

  context.beginPath();
  context.moveTo(...pointAt(from));
  context.lineTo(...pointAt(to));
  context.stroke();
}

const FACE_Z = RIM.depth + 0.002;

export const WALL_CLOCK_SIZE: Box = {
  min: [-RIM.radius, -RIM.radius, 0],
  max: [RIM.radius, RIM.radius, FACE_Z],
};

export function WallClock() {
  return (
    <>
      <mesh
        castShadow
        receiveShadow
        position-z={RIM.depth / 2}
        rotation-x={Math.PI / 2}
      >
        <cylinderGeometry args={[RIM.radius, RIM.radius, RIM.depth, 48]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {/* 원기둥 뚜껑의 uv 는 90도 돌아가 있어서, 판을 원으로 따로 붙여야 12시가 위로 옵니다. */}
      <mesh receiveShadow position-z={FACE_Z}>
        <circleGeometry args={[FACE_RADIUS, 48]} />
        <meshStandardMaterial roughness={0.4}>
          <PaintedTexture attach="map" painting={FACE} />
        </meshStandardMaterial>
      </mesh>
    </>
  );
}
