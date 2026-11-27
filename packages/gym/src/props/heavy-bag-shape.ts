import { type BufferGeometry, LatheGeometry, Vector2 } from "three";

import { joinSplitNormals } from "../joined-normals";

/** 샌드백 몸통의 크기입니다. edge 는 납작한 윗면과 바닥이 옆면으로 둥글게 넘어가는 반지름입니다. */
export const BAG = { radius: 0.19, height: 1.45, edge: 0.035 } as const;

/** 가죽 조각 사이 솔기의 각도입니다. 각도는 +z 에서 +x 쪽으로 잽니다. */
export const SEAM_ANGLES = [0, 1, 2, 3].map(
  (i) => Math.PI / 4 + (i * Math.PI) / 2,
);

const PANEL_ANGLE = Math.PI / 2;
// 속의 모래가 가라앉아 아래쪽이 조금 더 불룩합니다.
const SETTLE = 0.014;
const LID_DOME = 0.006;

/** 바닥 가운데가 바닥 가장자리보다 처진 깊이입니다. */
export const BOTTOM_SAG = 0.012;
const SEAM = { depth: 0.005, width: 0.009 } as const;

export const PILLOW = 0.004;
const ROWS = 240;
const AROUND = 96;
const DENSE = 60;

/** 바닥에서 h 만큼 위의 옆면 반지름입니다. 솔기와 조각의 부풂은 뺀 값입니다. */
export function sideRadius(h: number): number {
  const along = Math.min(
    1,
    Math.max(0, (h - BAG.edge) / (BAG.height - 2 * BAG.edge)),
  );

  return BAG.radius + SETTLE * Math.sin(Math.PI * along) * (1.4 - along);
}

/** 옆면에서 솔기와 조각의 부풂까지 더한 가장 큰 반지름입니다. */
export const WIDEST =
  Math.max(
    ...Array.from({ length: 101 }, (_, i) =>
      sideRadius((BAG.height * i) / 100),
    ),
  ) + PILLOW;

interface Outline {
  readonly points: readonly Vector2[];
  readonly sideStart: number;
  readonly sideEnd: number;
}

// 바닥 가운데에서 시작해 옆면을 지나 윗면 가운데에서 끝나는 단면입니다. x 는 반지름, y 는 바닥에서의 높이입니다.
function outline(): Outline {
  const { radius, height, edge } = BAG;
  const inner = radius - edge;
  const steps = (count: number) =>
    Array.from({ length: count }, (_, i) => (i + 1) / count);
  const bottom = [0, ...steps(DENSE)].map(
    (t) => new Vector2(inner * t, BOTTOM_SAG * (t ** 2 - 1)),
  );
  const lowerEdge = steps(DENSE).map((t) => {
    const angle = -Math.PI / 2 + (Math.PI / 2) * t;

    return new Vector2(
      inner + edge * Math.cos(angle),
      edge + edge * Math.sin(angle),
    );
  });
  const side = steps(DENSE * 4).map((t) => {
    const h = edge + (height - 2 * edge) * t;

    return new Vector2(sideRadius(h), h);
  });
  const upperEdge = steps(DENSE).map((t) => {
    const angle = (Math.PI / 2) * t;

    return new Vector2(
      inner + edge * Math.cos(angle),
      height - edge + edge * Math.sin(angle),
    );
  });
  const lid = steps(DENSE).map((t) => {
    const r = inner * (1 - t);

    return new Vector2(r, height + LID_DOME * (1 - (r / inner) ** 2));
  });
  const sideStart = bottom.length + lowerEdge.length - 1;

  return {
    points: [...bottom, ...lowerEdge, ...side, ...upperEdge, ...lid],
    sideStart,
    sideEnd: sideStart + side.length,
  };
}

function lengthsAlong(points: readonly Vector2[]): number[] {
  return points.reduce<number[]>((reached, point, i) => {
    const previous = points[i - 1];

    reached.push(
      previous ? (reached.at(-1) ?? 0) + previous.distanceTo(point) : 0,
    );

    return reached;
  }, []);
}

const OUTLINE = outline();
const REACHED = lengthsAlong(OUTLINE.points);
const TOTAL = REACHED.at(-1) ?? 1;

/**
 * 텍스처의 세로 좌표(v)입니다. 바닥 가운데가 0, 윗면 가운데가 1 이고, 단면을 따라 잰 길이에 비례합니다.
 * - sideBottom, sideTop 은 옆면이 시작하고 끝나는 v 입니다.
 */
export const BAG_V = {
  sideBottom: (REACHED[OUTLINE.sideStart] ?? 0) / TOTAL,
  sideTop: (REACHED[OUTLINE.sideEnd - 1] ?? TOTAL) / TOTAL,
} as const;

/** 옆면에서 바닥으로부터 h 만큼 위인 곳의 v 입니다. */
export function vAtHeight(h: number): number {
  const { sideBottom, sideTop } = BAG_V;
  const along = (h - BAG.edge) / (BAG.height - 2 * BAG.edge);

  return sideBottom + (sideTop - sideBottom) * Math.min(1, Math.max(0, along));
}

// LatheGeometry 는 단면의 점 번호로 v 를 정하므로, 단면을 같은 길이 간격으로 다시 찍어 v 가 길이에 비례하게 합니다.
function evenlySpaced(count: number): Vector2[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const distance = (i / count) * TOTAL;
    const segment = Math.max(
      0,
      REACHED.findIndex((value) => value >= distance) - 1,
    );
    const from = OUTLINE.points[segment] ?? new Vector2();
    const to = OUTLINE.points[segment + 1] ?? from;
    const start = REACHED[segment] ?? 0;
    const length = (REACHED[segment + 1] ?? start) - start;

    return from.clone().lerp(to, length > 0 ? (distance - start) / length : 0);
  });
}

/** 바닥 가운데를 원점에 둔 몸통입니다. 솔기는 안으로 패고 조각은 조금 부풉니다. */
export function bagBody(): BufferGeometry {
  const geometry = new LatheGeometry(evenlySpaced(ROWS), AROUND);
  const positions = geometry.getAttribute("position");
  const inner = BAG.radius - BAG.edge;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const r = Math.hypot(x, z);
    const angle = Math.atan2(x, z);
    const onSide = Math.min(1, Math.max(0, (r - inner) / BAG.edge));
    const moved = r + onSide * relief(angle, r);

    positions.setX(i, snapZero(Math.sin(angle) * moved));
    positions.setZ(i, snapZero(Math.cos(angle) * moved));
  }

  geometry.computeVertexNormals();
  joinSplitNormals(geometry);

  return geometry;
}

function relief(angle: number, r: number): number {
  const fromSeam = angleFromSeam(angle);
  const groove = SEAM.depth * Math.exp(-(((fromSeam * r) / SEAM.width) ** 2));
  const pillow =
    PILLOW * Math.sin((fromSeam / (PANEL_ANGLE / 2)) * (Math.PI / 2));

  return pillow - groove;
}

function angleFromSeam(angle: number): number {
  const turned =
    (((angle - (SEAM_ANGLES[0] ?? 0)) % PANEL_ANGLE) + PANEL_ANGLE) %
    PANEL_ANGLE;

  return Math.min(turned, PANEL_ANGLE - turned);
}

// 이음매의 정점은 -0 이 되기도 해서, 같은 자리의 정점을 찾을 때 0 과 다르게 셉니다.
function snapZero(value: number): number {
  return Math.abs(value) < 1e-9 ? 0 : value;
}
