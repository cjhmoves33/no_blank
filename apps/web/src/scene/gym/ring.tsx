import { extend } from "@react-three/fiber";
import { CatmullRomCurve3, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

import { addBlotches, addGrain } from "./brushes";
import { GYM } from "./measurements";
import { PaintedTexture, type Painting } from "./painted-texture";

const RoundedBox = extend(RoundedBoxGeometry);

const { ropes, mat } = GYM;
const LOWEST_ROPE = ropes.heights[0];
const HIGHEST_ROPE = ropes.heights[3];
const PLATFORM_HEIGHT = mat.y;

const MAT: Painting = {
  width: 2048,
  height: 2048,
  tiles: false,
  paint: (context) => {
    const { width, height } = context.canvas;

    context.fillStyle = "#cdc2ae";
    context.fillRect(0, 0, width, height);
    addGrain(context, 20, 7);
    context.globalAlpha = 0.05;
    context.strokeStyle = "#000000";
    context.beginPath();

    for (let x = 0; x < width; x += 6) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }

    context.stroke();
    context.globalAlpha = 1;
    addBlotches(context, {
      count: 150,
      colors: [
        "rgba(120, 90, 60, 0.08)",
        "rgba(90, 70, 50, 0.07)",
        "rgba(130, 60, 45, 0.04)",
        "rgba(255, 250, 240, 0.08)",
      ],
      maxRadius: 230,
      seed: 11,
    });

    const apron = (width / 2) * (1 - ropes.half / mat.half);

    context.strokeStyle = "#7d3a30";
    context.lineWidth = apron * 0.12;
    context.strokeRect(
      apron * 0.7,
      apron * 0.7,
      width - apron * 1.4,
      height - apron * 1.4,
    );

    const radius = width * 0.16;

    context.globalAlpha = 0.28;
    context.strokeStyle = "#2c3d5c";
    strokeCircle(context, radius, radius * 0.08);
    strokeCircle(context, radius * 0.86, radius * 0.02);
    context.globalAlpha = 1;
  },
};

function strokeCircle(
  context: CanvasRenderingContext2D,
  radius: number,
  lineWidth: number,
): void {
  const { width, height } = context.canvas;

  context.lineWidth = lineWidth;
  context.beginPath();
  context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  context.stroke();
}

const CORNERS = [
  { x: -1, z: -1, pad: "#33435e" },
  { x: 1, z: -1, pad: "#d6cab2" },
  { x: 1, z: 1, pad: "#7f2b24" },
  { x: -1, z: 1, pad: "#d6cab2" },
] as const;

interface Side {
  readonly from: Vector3;
  readonly to: Vector3;
}

const SIDES: readonly Side[] = CORNERS.map((corner, index) => {
  const next = CORNERS[(index + 1) % CORNERS.length] ?? corner;

  return {
    from: new Vector3(corner.x * ropes.half, 0, corner.z * ropes.half),
    to: new Vector3(next.x * ropes.half, 0, next.z * ropes.half),
  };
});

function sagAt(along: number): number {
  return ropes.sag * 4 * along * (1 - along);
}

function ropePointAt(
  { from, to }: Side,
  along: number,
  height: number,
): Vector3 {
  return from
    .clone()
    .lerp(to, along)
    .setY(mat.y + height - sagAt(along));
}

const ROPES = SIDES.flatMap((side, sideIndex) =>
  ropes.heights.map((height) => ({
    key: `${sideIndex}:${height}`,
    curve: new CatmullRomCurve3(
      Array.from({ length: 9 }, (_, i) => ropePointAt(side, i / 8, height)),
    ),
  })),
);

const TIE_HEIGHT = HIGHEST_ROPE - LOWEST_ROPE + 0.06;

const TIES = SIDES.flatMap((side, sideIndex) =>
  [1 / 3, 2 / 3].map((along) => {
    const direction = side.to.clone().sub(side.from);

    return {
      key: `${sideIndex}:${along}`,
      position: ropePointAt(side, along, (HIGHEST_ROPE + LOWEST_ROPE) / 2),
      turn: Math.atan2(direction.x, direction.z),
    };
  }),
);

export function Ring() {
  return (
    <group>
      <mesh castShadow receiveShadow position-y={mat.y / 2 - 0.0025}>
        <boxGeometry
          args={[mat.half * 2, PLATFORM_HEIGHT - 0.005, mat.half * 2]}
        />
        <meshStandardMaterial color="#1c1a18" roughness={0.85} />
      </mesh>
      <mesh receiveShadow position-y={mat.y} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[mat.half * 2, mat.half * 2]} />
        <meshStandardMaterial roughness={0.93}>
          <PaintedTexture attach="map" painting={MAT} />
        </meshStandardMaterial>
      </mesh>
      {CORNERS.map((corner) => (
        <Corner key={`${corner.x}:${corner.z}`} {...corner} />
      ))}
      {ROPES.map((rope) => (
        <mesh key={rope.key} castShadow>
          <tubeGeometry args={[rope.curve, 64, ropes.radius, 12]} />
          <meshPhysicalMaterial
            color="#7f2b24"
            roughness={0.65}
            clearcoat={0.6}
            clearcoatRoughness={0.3}
          />
        </mesh>
      ))}
      {TIES.map((tie) => (
        <mesh
          key={tie.key}
          castShadow
          position={tie.position}
          rotation-y={tie.turn}
        >
          <boxGeometry args={[0.06, TIE_HEIGHT, 0.025]} />
          <meshStandardMaterial color="#d6cab2" roughness={0.8} />
        </mesh>
      ))}
      <Steps />
    </group>
  );
}

interface CornerProps {
  readonly x: -1 | 1;
  readonly z: -1 | 1;
  readonly pad: string;
}

function Corner({ x, z, pad }: CornerProps) {
  const postHeight = HIGHEST_ROPE + 0.175;
  const padBottom = LOWEST_ROPE - 0.125;
  const padTop = HIGHEST_ROPE + 0.125;

  return (
    <>
      <mesh
        castShadow
        position={[x * GYM.posts.at, mat.y + postHeight / 2, z * GYM.posts.at]}
      >
        <cylinderGeometry
          args={[GYM.posts.radius, GYM.posts.radius, postHeight, 24]}
        />
        <meshStandardMaterial
          color="#5a5f63"
          roughness={0.35}
          metalness={0.7}
        />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position={[
          x * ropes.half,
          mat.y + (padTop + padBottom) / 2,
          z * ropes.half,
        ]}
        rotation-y={Math.atan2(x, z)}
      >
        <RoundedBox args={[0.31, padTop - padBottom, 0.17, 4, 0.06]} />
        <meshPhysicalMaterial
          color={pad}
          roughness={0.62}
          clearcoat={0.08}
          clearcoatRoughness={0.35}
        />
      </mesh>
    </>
  );
}

const STEP_COUNT = 4;

function Steps() {
  const rise = PLATFORM_HEIGHT / STEP_COUNT;

  return (
    <group position-x={-mat.half + 0.7}>
      {Array.from({ length: STEP_COUNT }, (_, i) => {
        const height = rise * (i + 1);
        const depth = 0.275 * (STEP_COUNT - i);

        return (
          <mesh
            key={height}
            castShadow
            receiveShadow
            position={[0, height / 2, mat.half + depth / 2]}
          >
            <boxGeometry args={[0.8, height, depth]} />
            <meshStandardMaterial color="#4a3324" roughness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}
