import { Color } from "three";

import { STEEL } from "../finishes";
import { LATE_AFTERNOON } from "../light/late-afternoon";
import { PaintedTexture } from "../painted-texture";
import {
  brickWalls,
  ceiling,
  floor,
  glassPanes,
  paintedWallBand,
  steelwork,
} from "./layout";
import {
  BRICK,
  BRICK_RELIEF,
  FLOOR_OCCLUSION,
  PLANKS,
  WALL_OCCLUSION,
} from "./paintings";
import { Slabs } from "./slabs";

const WALLS = brickWalls();
const CEILING = ceiling();
const PAINTED_WALL_BAND = paintedWallBand();
const STEELWORK = steelwork();
const FLOOR = floor();
const PANES = glassPanes();

const SELF_LIT_GLASS = new Color(LATE_AFTERNOON.glass.color).multiplyScalar(
  LATE_AFTERNOON.glass.gain,
);

export function Building() {
  return (
    <>
      <Slabs boxes={WALLS} tile={2} finish={{ roughness: 0.94, bumpScale: 2 }}>
        <PaintedTexture attach="map" painting={BRICK} />
        <PaintedTexture attach="bumpMap" painting={BRICK_RELIEF} />
        <PaintedTexture attach="aoMap" painting={WALL_OCCLUSION} channel={1} />
      </Slabs>
      <Slabs
        boxes={CEILING}
        tile={2}
        finish={{ color: "#6e655a", roughness: 0.95 }}
      />
      <Slabs
        boxes={PAINTED_WALL_BAND}
        tile={2}
        finish={{ color: "#56614f", roughness: 0.8 }}
      >
        <PaintedTexture attach="aoMap" painting={WALL_OCCLUSION} channel={1} />
      </Slabs>
      <Slabs boxes={STEELWORK} tile={2} finish={STEEL} />
      <Slabs boxes={FLOOR} tile={4} finish={{ roughness: 0.66 }}>
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
          <meshBasicMaterial color={SELF_LIT_GLASS} fog={false} />
        </mesh>
      ))}
    </>
  );
}
