import { Color } from "three";

import { STEEL } from "./finishes";
import { LATE_AFTERNOON } from "./late-afternoon";
import { PaintedTexture } from "./painted-texture";
import {
  brickWalls,
  ceiling,
  dado,
  floor,
  glassPanes,
  steelwork,
} from "./room-layout";
import {
  BRICK,
  BRICK_RELIEF,
  FLOOR_OCCLUSION,
  PLANKS,
  WALL_OCCLUSION,
} from "./room-paintings";
import { Slabs } from "./slabs";

const WALLS = brickWalls();
const CEILING = ceiling();
const DADO = dado();
const STEELWORK = steelwork();
const FLOOR = floor();
const PANES = glassPanes();

// 유리는 빛을 받지 않고 스스로 밝아야 창 밖의 하늘처럼 보입니다.
const GLASS = new Color(LATE_AFTERNOON.glass.color).multiplyScalar(
  LATE_AFTERNOON.glass.gain,
);

export function Room() {
  return (
    <>
      <Slabs boxes={WALLS} tile={4} finish={{ roughness: 0.94, bumpScale: 2 }}>
        <PaintedTexture attach="map" painting={BRICK} />
        <PaintedTexture attach="bumpMap" painting={BRICK_RELIEF} />
        <PaintedTexture attach="aoMap" painting={WALL_OCCLUSION} channel={1} />
      </Slabs>
      <Slabs
        boxes={CEILING}
        tile={4}
        finish={{ color: "#6e655a", roughness: 0.95 }}
      />
      <Slabs
        boxes={DADO}
        tile={4}
        finish={{ color: "#56614f", roughness: 0.8 }}
      >
        <PaintedTexture attach="aoMap" painting={WALL_OCCLUSION} channel={1} />
      </Slabs>
      <Slabs boxes={STEELWORK} tile={4} finish={STEEL} />
      <Slabs boxes={FLOOR} tile={8} finish={{ roughness: 0.66 }}>
        <PaintedTexture attach="map" painting={PLANKS} />
        <PaintedTexture attach="aoMap" painting={FLOOR_OCCLUSION} channel={1} />
      </Slabs>
      {PANES.map((pane) => (
        <mesh
          key={pane.center[2]}
          position={pane.center}
          rotation-y={-Math.PI / 2}
        >
          <planeGeometry args={[pane.width, pane.height]} />
          <meshBasicMaterial color={GLASS} fog={false} />
        </mesh>
      ))}
    </>
  );
}
