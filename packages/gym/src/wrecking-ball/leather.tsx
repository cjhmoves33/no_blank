import { type Ref, useImperativeHandle, useMemo, useRef } from "react";
import {
  type BufferAttribute,
  type BufferGeometry,
  DoubleSide,
  type InterleavedBufferAttribute,
  type Mesh,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import {
  addBlotches,
  addGrain,
  clearOf,
  type RgbaColor,
  seededRandom,
} from "../brushes";
import { GYM, RING_VIEW } from "../measurements";
import { PaintedTexture, type Painting } from "../painted-texture";
import { dentedNormal, sinking } from "./impact";

interface Dent {
  readonly onLeather: Vector3;
  readonly depth: number;
}

export interface LeatherHandle {
  readonly dent: (dent: Dent | null) => void;
}

export interface LeatherProps {
  readonly ref: Ref<LeatherHandle>;
}

export interface StrapTop {
  readonly position: Vector3;
  readonly angle: number;
}

const { radius } = GYM.wreckingBall;

const PANELS = 6;
const PANEL_ANGLE = (2 * Math.PI) / PANELS;
const FRONT_PANEL = Math.atan2(
  RING_VIEW.home[2] - RING_VIEW.target[2],
  RING_VIEW.home[0] - RING_VIEW.target[0],
);
const FLAT_TOP = GYM.wreckingBall.lidHeight;
const SEAM = { depth: 0.008, width: 0.012 } as const;
const STRAP = {
  width: 0.2,
  fromTop: 0.66,
  length: 0.5,
  lift: 0.005,
  tabWidth: 0.036,
  tabThickness: 0.007,
  topY: 0.31,
} as const;
const STRAP_ANGLES = [0, 1, 2, 3].map(
  (i) => FRONT_PANEL + Math.PI / 4 + (i * Math.PI) / 2,
);
const SHOULDER = {
  across: radius * Math.sin(STRAP.fromTop) + 0.004,
  y: radius * Math.cos(STRAP.fromTop),
};
const LOOK = {
  leather: "#7d4a2a",
  wear: "rgba(176, 124, 82, 0.45)",
  grime: "rgba(28, 14, 6, 0.55)",
  thread: "rgba(205, 170, 120, 0.9)",
  cap: "#4e2c18",
  strap: "#5a3420",
  roughness: 0.58,
  grainDepth: 2.5,
} as const;

export const STRAP_TOPS: readonly StrapTop[] = STRAP_ANGLES.map((angle) => ({
  position: new Vector3(
    SHOULDER.across * Math.cos(angle),
    STRAP.topY,
    SHOULDER.across * Math.sin(angle),
  ),
  angle,
}));

const TEXTURE = { width: 2048, height: 1024 } as const;
const CAP_ROW = (Math.acos(FLAT_TOP / radius) / Math.PI) * TEXTURE.height;
const BOTTOM_ROW = 0.95 * TEXTURE.height;
const PANEL_WIDTH = TEXTURE.width / PANELS;

const LEATHER: Painting = {
  ...TEXTURE,
  tiles: true,
  paint: (context) => {
    context.fillStyle = LOOK.leather;
    context.fillRect(0, 0, TEXTURE.width, TEXTURE.height);
    addBlotches(context, {
      count: 160,
      colors: [
        "rgba(40, 20, 10, 0.28)",
        "rgba(150, 100, 60, 0.18)",
        "rgba(20, 10, 6, 0.2)",
      ],
      maxRadius: 70,
      seed: 3,
      tiles: true,
    });
    eachPanel((center) => {
      wornMiddle(context, center, { color: LOOK.wear, reach: 0.55 });
      seamGrime(context, center + PANEL_WIDTH / 2);
      stitchesBeside(context, center + PANEL_WIDTH / 2, LOOK.thread);
    });
    context.fillStyle = LOOK.cap;
    context.fillRect(0, 0, TEXTURE.width, CAP_ROW);
    context.fillRect(0, BOTTOM_ROW, TEXTURE.width, TEXTURE.height - BOTTOM_ROW);

    const rim = context.createLinearGradient(0, CAP_ROW, 0, CAP_ROW + 40);

    rim.addColorStop(0, LOOK.grime);
    rim.addColorStop(1, clearOf(LOOK.grime));
    context.fillStyle = rim;
    context.fillRect(0, CAP_ROW, TEXTURE.width, 40);
    addGrain(context, 14, 14);
  },
};

const LEATHER_GRAIN: Painting = {
  ...TEXTURE,
  tiles: true,
  paint: (context) => {
    const random = seededRandom(104);

    context.fillStyle = "#808080";
    context.fillRect(0, 0, TEXTURE.width, TEXTURE.height);

    for (let i = 0; i < 9000; i++) {
      const shade = Math.round(110 + random() * 40);

      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.5)`;
      context.beginPath();
      context.arc(
        random() * TEXTURE.width,
        random() * TEXTURE.height,
        1 + random() * 3,
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    addGrain(context, 50, 16);
    eachPanel((center) => {
      wornMiddle(context, center, {
        color: "rgba(128, 128, 128, 0.7)",
        reach: 0.4,
      });
      stitchesBeside(context, center + PANEL_WIDTH / 2, "#303030");
    });
  },
};

type Attribute = BufferAttribute | InterleavedBufferAttribute;

interface UndentedMesh {
  readonly geometry: BufferGeometry;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
}

export function Leather({ ref }: LeatherProps) {
  const body = useRef<Mesh>(null);
  const straps = useRef<(Mesh | null)[]>([]);
  const rim = useRef<Mesh>(null);
  const rest = useRef<{
    readonly body: UndentedMesh;
    readonly trims: UndentedMesh[];
  }>(null);
  const dented = useRef(false);
  const geometry = useMemo(() => pillowedBody(), []);
  const rimGeometry = useMemo(() => capRim(), []);

  useImperativeHandle(
    ref,
    () => ({
      dent: (dent) => {
        if (!dent && !dented.current) {
          return;
        }

        rest.current ??= restOf(body.current, [...straps.current, rim.current]);

        if (!rest.current) {
          return;
        }

        dentBody(rest.current.body, dent);
        rest.current.trims.forEach((trim) => {
          sinkWithLeather(trim, dent);
        });
        dented.current = dent !== null;
      },
    }),
    [],
  );

  return (
    <>
      <mesh
        ref={body}
        name="leather"
        geometry={geometry}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          roughness={LOOK.roughness}
          bumpScale={LOOK.grainDepth}
        >
          <PaintedTexture attach="map" painting={LEATHER} />
          <PaintedTexture attach="bumpMap" painting={LEATHER_GRAIN} />
        </meshStandardMaterial>
      </mesh>
      <mesh
        ref={rim}
        name="leather-rim"
        geometry={rimGeometry}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={LOOK.cap} roughness={0.7} />
      </mesh>
      {STRAP_ANGLES.map((angle, i) => (
        <mesh
          key={angle}
          ref={(mesh) => {
            straps.current[i] = mesh;
          }}
          name="leather-strap"
          castShadow
          receiveShadow
        >
          <sphereGeometry
            args={[
              radius + STRAP.lift,
              6,
              16,
              Math.PI - angle - STRAP.width / 2,
              STRAP.width,
              STRAP.fromTop,
              STRAP.length,
            ]}
          />
          <meshStandardMaterial
            color={LOOK.strap}
            roughness={0.62}
            side={DoubleSide}
          />
        </mesh>
      ))}
      {STRAP_TOPS.map(({ position, angle }) => (
        <mesh
          key={angle}
          name="leather-tab"
          castShadow
          receiveShadow
          position={[position.x, (SHOULDER.y + STRAP.topY) / 2, position.z]}
          rotation-y={Math.PI / 2 - angle}
        >
          <boxGeometry
            args={[
              STRAP.tabWidth,
              STRAP.topY - SHOULDER.y + 0.01,
              STRAP.tabThickness,
            ]}
          />
          <meshStandardMaterial color={LOOK.strap} roughness={0.62} />
        </mesh>
      ))}
    </>
  );
}

function capRim(): BufferGeometry {
  return new TorusGeometry(
    radius * Math.sqrt(1 - (FLAT_TOP / radius) ** 2),
    0.006,
    6,
    64,
  )
    .rotateX(Math.PI / 2)
    .translate(0, FLAT_TOP, 0);
}

function pillowedBody(): BufferGeometry {
  const geometry = new SphereGeometry(radius, 128, 72);
  const positions = geometry.getAttribute("position");
  const point = new Vector3();

  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).normalize();

    const onLid = point.y * radius > FLAT_TOP;
    const across = Math.hypot(point.x, point.z);
    const fromPanelMiddle = angleFromPanelMiddle(Math.atan2(point.z, point.x));
    const toSeam = (PANEL_ANGLE / 2 - fromPanelMiddle) * radius * across;
    const awayFromPoles = Math.min(1, Math.max(0, (across - 0.25) / 0.25));
    const groove = onLid
      ? 0
      : SEAM.depth * Math.exp(-((toSeam / SEAM.width) ** 2)) * awayFromPoles;

    point.multiplyScalar(radius - groove);

    if (onLid) {
      point.y = FLAT_TOP;
    }

    positions.setXYZ(i, point.x, point.y, point.z);
  }

  geometry.computeVertexNormals();
  joinSplitNormals(geometry);

  return geometry;
}

function angleFromPanelMiddle(longitude: number): number {
  const turned =
    (((longitude - FRONT_PANEL) % PANEL_ANGLE) + PANEL_ANGLE) % PANEL_ANGLE;

  return Math.min(turned, PANEL_ANGLE - turned);
}

// SphereGeometry 는 텍스처 이음매와 두 극에서 같은 자리에 정점을 따로 두므로, 그 법선을 평균해 이음매가 보이지 않게 합니다.
function joinSplitNormals(geometry: BufferGeometry): void {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const sums = new Map<string, Vector3>();
  const keyOf = (i: number) =>
    [positions.getX(i), positions.getY(i), positions.getZ(i)]
      .map((value) => value.toFixed(5))
      .join();

  for (let i = 0; i < positions.count; i++) {
    const sum = sums.get(keyOf(i)) ?? new Vector3();

    sums.set(keyOf(i), sum.add(new Vector3().fromBufferAttribute(normals, i)));
  }

  for (let i = 0; i < positions.count; i++) {
    const joined = sums.get(keyOf(i))?.clone().normalize();

    if (joined) {
      normals.setXYZ(i, joined.x, joined.y, joined.z);
    }
  }
}

function eachPanel(draw: (center: number) => void): void {
  for (let i = 0; i < PANELS; i++) {
    const longitude = FRONT_PANEL + i * PANEL_ANGLE;
    const u = ((((Math.PI - longitude) / (2 * Math.PI)) % 1) + 1) % 1;

    for (const shift of [-TEXTURE.width, 0, TEXTURE.width]) {
      draw(u * TEXTURE.width + shift);
    }
  }
}

function wornMiddle(
  context: CanvasRenderingContext2D,
  center: number,
  { color, reach }: { readonly color: RgbaColor; readonly reach: number },
): void {
  const middle = TEXTURE.height * 0.52;
  const wear = context.createRadialGradient(
    center,
    middle,
    0,
    center,
    middle,
    PANEL_WIDTH * reach,
  );

  wear.addColorStop(0, color);
  wear.addColorStop(1, clearOf(color));
  context.save();
  context.translate(center, middle);
  context.scale(1, 1.6);
  context.translate(-center, -middle);
  context.fillStyle = wear;
  context.fillRect(center - PANEL_WIDTH, 0, PANEL_WIDTH * 2, TEXTURE.height);
  context.restore();
}

function seamGrime(context: CanvasRenderingContext2D, seam: number): void {
  const spread = PANEL_WIDTH * 0.12;
  const grime = context.createLinearGradient(
    seam - spread,
    0,
    seam + spread,
    0,
  );

  grime.addColorStop(0, clearOf(LOOK.grime));
  grime.addColorStop(0.5, LOOK.grime);
  grime.addColorStop(1, clearOf(LOOK.grime));
  context.fillStyle = grime;
  context.fillRect(seam - spread, 0, spread * 2, TEXTURE.height);
}

function stitchesBeside(
  context: CanvasRenderingContext2D,
  seam: number,
  color: string,
): void {
  context.fillStyle = color;

  for (const side of [-7, 7]) {
    for (let y = CAP_ROW + 6; y < BOTTOM_ROW; y += 9) {
      context.fillRect(seam + side - 1, y, 2, 5);
    }
  }
}

function restOf(
  body: Mesh | null,
  trims: readonly (Mesh | null)[],
): {
  readonly body: UndentedMesh;
  readonly trims: UndentedMesh[];
} | null {
  const trimMeshes = trims.filter((trim) => trim !== null);

  if (!body || trimMeshes.length !== trims.length) {
    return null;
  }

  return {
    body: restOfMesh(body),
    trims: trimMeshes.map(restOfMesh),
  };
}

function restOfMesh({ geometry }: Mesh): UndentedMesh {
  return {
    geometry,
    positions: Float32Array.from(geometry.getAttribute("position").array),
    normals: Float32Array.from(geometry.getAttribute("normal").array),
  };
}

const point = new Vector3();
const direction = new Vector3();
const normal = new Vector3();

function dentBody(rest: UndentedMesh, dent: Dent | null): void {
  const positions = rest.geometry.getAttribute("position");
  const normals = rest.geometry.getAttribute("normal");

  for (let i = 0; i < positions.count; i++) {
    point.fromArray(rest.positions, i * 3);
    normal.fromArray(rest.normals, i * 3);

    if (dent) {
      direction.copy(point).normalize();
      normal
        .add(dentedNormal(direction, dent.onLeather, dent.depth))
        .sub(direction)
        .normalize();
      point.addScaledVector(
        direction,
        -sinking(direction, dent.onLeather, dent.depth),
      );
    }

    positions.setXYZ(i, point.x, point.y, point.z);
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }

  changed(positions, normals);
}

function sinkWithLeather(rest: UndentedMesh, dent: Dent | null): void {
  const positions = rest.geometry.getAttribute("position");

  for (let i = 0; i < positions.count; i++) {
    point.fromArray(rest.positions, i * 3);

    if (dent) {
      direction.copy(point).normalize();
      point.addScaledVector(
        direction,
        -sinking(direction, dent.onLeather, dent.depth),
      );
    }

    positions.setXYZ(i, point.x, point.y, point.z);
  }

  changed(positions);
}

function changed(...attributes: Attribute[]): void {
  for (const attribute of attributes) {
    attribute.needsUpdate = true;
  }
}
