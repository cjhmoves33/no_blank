import {
  addBlotches,
  addGrain,
  clearOf,
  type RgbaColor,
  seededRandom,
} from "../brushes";
import type { Painting } from "../painted-texture";
import { BAG, BAG_V, SEAM_ANGLES, vAtHeight } from "./heavy-bag-shape";

/** 샌드백마다 다른 겉모습입니다. wear 는 0(거의 새것)에서 1(많이 닳음)까지입니다. */
export interface BagLook {
  readonly leather: string;
  readonly stripe: string;
  readonly wear: number;
  readonly seed: number;
}

const TEXTURE = { width: 1024, height: 1536 } as const;
const { width: W, height: H } = TEXTURE;
// 주먹이 가장 많이 닿는 높이(바닥에서 잰 미터)입니다. 서 있는 사람의 가슴에서 머리 높이쯤입니다.
const PUNCH_ZONE = { from: 0.35, to: 1.0 } as const;
const FRONT = Math.PI / 2;
const STRIPES = [
  { from: 0.15, to: 0.175 },
  { from: 0.195, to: 0.205 },
] as const;
const THREAD = "rgba(196, 170, 128, 0.85)";
const GRIME: RgbaColor = "rgba(24, 14, 8, 0.5)";

const rowOfV = (v: number) => (1 - v) * H;
const rowAt = (h: number) => rowOfV(vAtHeight(h));
const columnAt = (angle: number) =>
  ((((angle / (Math.PI * 2)) % 1) + 1) % 1) * W;
const SIDE_TOP_ROW = rowOfV(BAG_V.sideTop);
const SIDE_BOTTOM_ROW = rowOfV(BAG_V.sideBottom);

// 텍스처의 왼쪽과 오른쪽 끝이 몸통에서 맞닿으므로, 끝에 걸친 것은 반대쪽에도 그립니다.
function aroundSeam(x: number, draw: (x: number) => void): void {
  for (const shift of [-W, 0, W]) {
    draw(x + shift);
  }
}

export function bagLeather(look: BagLook): Painting {
  return {
    ...TEXTURE,
    tiles: true,
    paint: (context) => {
      context.fillStyle = look.leather;
      context.fillRect(0, 0, W, H);
      addBlotches(context, {
        count: 120,
        colors: [
          "rgba(30, 16, 8, 0.25)",
          "rgba(160, 110, 70, 0.14)",
          "rgba(15, 8, 4, 0.2)",
        ],
        maxRadius: 60,
        seed: look.seed,
        wrap: "horizontal",
      });
      paintStripes(context, look);
      paintPunchWear(context, look);
      paintScuffs(context, look);
      paintEnds(context);
      for (const angle of SEAM_ANGLES) {
        aroundSeam(columnAt(angle), (x) => {
          seamGrime(context, x);
          stitchesAlong(context, x, THREAD);
        });
      }

      stitchesAround(context, THREAD);
      addGrain(context, 12, look.seed + 1);
    },
  };
}

export const BAG_GRAIN: Painting = {
  ...TEXTURE,
  tiles: true,
  paint: (context) => {
    const random = seededRandom(211);

    context.fillStyle = "#808080";
    context.fillRect(0, 0, W, H);

    for (let i = 0; i < 6500; i++) {
      const shade = Math.round(110 + random() * 40);

      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.5)`;
      context.beginPath();
      context.arc(random() * W, random() * H, 1 + random() * 3, 0, Math.PI * 2);
      context.fill();
    }

    paintCreases(context, random);
    addGrain(context, 40, 212);
    for (const angle of SEAM_ANGLES) {
      aroundSeam(columnAt(angle), (x) => {
        stitchesAlong(context, x, "#303030");
      });
    }

    stitchesAround(context, "#303030");
  },
};

// 칠한 줄무늬는 주먹과 손에 쓸려 군데군데 벗겨져 가죽이 드러납니다.
function paintStripes(context: CanvasRenderingContext2D, look: BagLook): void {
  const random = seededRandom(look.seed + 3);

  for (const { from, to } of STRIPES) {
    const top = rowAt(BAG.height - from);
    const bottom = rowAt(BAG.height - to);

    context.fillStyle = look.stripe;
    context.fillRect(0, top, W, bottom - top);
    context.fillStyle = look.leather;

    for (let i = 0; i < Math.round(500 * (0.3 + look.wear)); i++) {
      const width = 2 + random() * 14;

      context.globalAlpha = 0.3 + random() * 0.6;
      context.fillRect(
        random() * W,
        top + random() * (bottom - top) - 1,
        width,
        1 + random() * 3,
      );
    }

    context.globalAlpha = 1;
  }
}

// 링 쪽(+x)을 보는 조각이 가장 많이 맞아 색이 바래고, 뒤쪽도 덜하지만 바랩니다.
function paintPunchWear(
  context: CanvasRenderingContext2D,
  { wear }: BagLook,
): void {
  const top = rowAt(PUNCH_ZONE.to);
  const bottom = rowAt(PUNCH_ZONE.from);
  const middle = (top + bottom) / 2;

  for (const { angle, strength } of [
    { angle: FRONT, strength: 1 },
    { angle: FRONT + Math.PI, strength: 0.45 },
  ]) {
    const color: RgbaColor = `rgba(188, 158, 126, ${0.5 * wear * strength})`;

    aroundSeam(columnAt(angle), (x) => {
      const reach = W * 0.22;
      const faded = context.createRadialGradient(
        x,
        middle,
        0,
        x,
        middle,
        reach,
      );

      faded.addColorStop(0, color);
      faded.addColorStop(1, clearOf(color));
      context.save();
      context.translate(x, middle);
      context.scale(1, (bottom - top) / (reach * 2));
      context.translate(-x, -middle);
      context.fillStyle = faded;
      context.fillRect(x - reach, middle - reach, reach * 2, reach * 2);
      context.restore();
    });
  }
}

function paintScuffs(context: CanvasRenderingContext2D, look: BagLook): void {
  const random = seededRandom(look.seed + 7);
  const top = rowAt(PUNCH_ZONE.to);
  const bottom = rowAt(PUNCH_ZONE.from);

  context.lineCap = "round";

  for (let i = 0; i < Math.round(420 * look.wear); i++) {
    const frontWeighted =
      FRONT + (random() + random() + random() - 1.5) * Math.PI * 0.9;
    const x = columnAt(frontWeighted);
    const y = top + (random() + random()) * 0.5 * (bottom - top);
    const length = 8 + random() * 34;
    const tilt = (random() - 0.5) * 0.7;
    const light = random() < 0.7;

    context.strokeStyle = light
      ? `rgba(214, 192, 164, ${0.06 + random() * 0.14})`
      : `rgba(20, 12, 6, ${0.05 + random() * 0.1})`;
    context.lineWidth = 1 + random() * 2.5;
    aroundSeam(x, (cx) => {
      context.beginPath();
      context.moveTo(cx, y);
      context.lineTo(cx + Math.cos(tilt) * length, y + Math.sin(tilt) * length);
      context.stroke();
    });
  }
}

// 윗면에는 먼지가 앉고, 바닥 쪽은 손때와 바닥 먼지로 어둡습니다.
function paintEnds(context: CanvasRenderingContext2D): void {
  const dust: RgbaColor = "rgba(150, 140, 122, 0.4)";
  const onLid = context.createLinearGradient(0, 0, 0, SIDE_TOP_ROW);

  onLid.addColorStop(0, dust);
  onLid.addColorStop(1, clearOf(dust));
  context.fillStyle = onLid;
  context.fillRect(0, 0, W, SIDE_TOP_ROW);

  const lowSide = rowAt(0.25);
  const lower = context.createLinearGradient(0, lowSide, 0, H);

  lower.addColorStop(0, clearOf(GRIME));
  lower.addColorStop(0.6, GRIME);
  lower.addColorStop(1, GRIME);
  context.fillStyle = lower;
  context.fillRect(0, lowSide, W, H - lowSide);
}

function seamGrime(context: CanvasRenderingContext2D, x: number): void {
  const spread = W * 0.02;
  const grime = context.createLinearGradient(x - spread, 0, x + spread, 0);

  grime.addColorStop(0, clearOf(GRIME));
  grime.addColorStop(0.5, GRIME);
  grime.addColorStop(1, clearOf(GRIME));
  context.fillStyle = grime;
  context.fillRect(
    x - spread,
    SIDE_TOP_ROW,
    spread * 2,
    SIDE_BOTTOM_ROW - SIDE_TOP_ROW,
  );
}

function stitchesAlong(
  context: CanvasRenderingContext2D,
  x: number,
  color: string,
): void {
  context.fillStyle = color;

  for (const side of [-5, 5]) {
    for (let y = SIDE_TOP_ROW + 4; y < SIDE_BOTTOM_ROW - 4; y += 7) {
      context.fillRect(x + side - 1, y, 2, 4);
    }
  }
}

// 윗면과 바닥이 옆면과 만나는 둘레의 박음질입니다.
function stitchesAround(
  context: CanvasRenderingContext2D,
  color: string,
): void {
  context.fillStyle = color;

  for (const y of [SIDE_TOP_ROW + 6, SIDE_BOTTOM_ROW - 6]) {
    for (let x = 0; x < W; x += 7) {
      context.fillRect(x, y - 1, 4, 2);
    }
  }
}

// 많이 맞는 높이의 가죽에 가로로 잔주름이 잡힙니다.
function paintCreases(
  context: CanvasRenderingContext2D,
  random: () => number,
): void {
  const top = rowAt(PUNCH_ZONE.to);
  const bottom = rowAt(PUNCH_ZONE.from);

  context.lineCap = "round";

  for (let i = 0; i < 260; i++) {
    const x = random() * W;
    const y = top + random() * (bottom - top);
    const length = 20 + random() * 60;
    const bend = (random() - 0.5) * 8;

    context.strokeStyle = `rgba(70, 70, 70, ${0.25 + random() * 0.3})`;
    context.lineWidth = 1 + random() * 1.5;
    aroundSeam(x, (cx) => {
      context.beginPath();
      context.moveTo(cx, y);
      context.quadraticCurveTo(cx + length / 2, y + bend, cx + length, y);
      context.stroke();
    });
  }
}

const TAPE = { width: 1024, height: 48 } as const;

/** 덕트 테이프에 묻은 손때와 해진 가장자리입니다. */
export const TAPE_GRIME: Painting = {
  ...TAPE,
  tiles: true,
  paint: (context) => {
    const random = seededRandom(301);

    context.fillStyle = "#77797a";
    context.fillRect(0, 0, TAPE.width, TAPE.height);
    addBlotches(context, {
      count: 60,
      colors: ["rgba(40, 34, 28, 0.35)", "rgba(25, 20, 16, 0.25)"],
      maxRadius: 30,
      seed: 302,
      wrap: "horizontal",
    });
    context.fillStyle = "rgba(196, 194, 186, 0.7)";

    for (const edge of [0, TAPE.height - 2]) {
      for (let x = 0; x < TAPE.width; x += 2 + random() * 6) {
        context.fillRect(x, edge, 1 + random() * 3, 2);
      }
    }

    addGrain(context, 18, 303);
  },
};

/** 덕트 테이프의 천 결과 구김입니다. 범프 맵으로 씁니다. */
export const TAPE_WEAVE: Painting = {
  ...TAPE,
  tiles: true,
  paint: (context) => {
    const random = seededRandom(305);

    context.fillStyle = "#808080";
    context.fillRect(0, 0, TAPE.width, TAPE.height);
    context.fillStyle = "rgba(96, 96, 96, 0.6)";

    for (let x = 0; x < TAPE.width; x += 3) {
      context.fillRect(x, 0, 1, TAPE.height);
    }

    for (let y = 0; y < TAPE.height; y += 3) {
      context.fillRect(0, y, TAPE.width, 1);
    }

    context.lineCap = "round";

    for (let i = 0; i < 90; i++) {
      const x = random() * TAPE.width;
      const tilt = (random() - 0.5) * 1.2;

      const shade = random() < 0.5 ? 50 : 200;

      context.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, 0.5)`;
      context.lineWidth = 1 + random() * 2;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + Math.sin(tilt) * TAPE.height, TAPE.height);
      context.stroke();
    }

    addGrain(context, 30, 306);
  },
};

/** 칠한 강철 2m 를 한 장에 담아 반복해 깝니다. 페인트가 벗겨진 자리에 녹이 슬었습니다. */
export const STEEL_TILE_METERS = 2;

export const PAINTED_STEEL: Painting = {
  width: 1024,
  height: 1024,
  tiles: true,
  paint: (context) => {
    const random = seededRandom(401);
    const size = 1024;

    context.fillStyle = "#3d4348";
    context.fillRect(0, 0, size, size);
    addBlotches(context, {
      count: 50,
      colors: ["rgba(12, 14, 16, 0.35)", "rgba(80, 86, 90, 0.18)"],
      maxRadius: 120,
      seed: 402,
      wrap: "both",
    });
    addBlotches(context, {
      count: 45,
      colors: ["rgba(112, 56, 26, 0.4)", "rgba(140, 78, 40, 0.3)"],
      maxRadius: 26,
      seed: 403,
      wrap: "both",
    });
    paintRustStreaks(context, random, size);

    for (let i = 0; i < 900; i++) {
      const x = random() * size;
      const y = random() * size;
      const chip = 1 + random() * 3;

      context.fillStyle =
        random() < 0.6
          ? `rgba(150, 150, 145, ${0.3 + random() * 0.4})`
          : `rgba(120, 62, 30, ${0.4 + random() * 0.4})`;
      context.fillRect(x, y, chip, chip * (0.5 + random()));
    }

    addGrain(context, 14, 404);
  },
};

// 녹물은 아래로 흘러내립니다. 강철 텍스처의 세로(v)는 옆면에서 늘 위쪽입니다.
function paintRustStreaks(
  context: CanvasRenderingContext2D,
  random: () => number,
  size: number,
): void {
  for (let i = 0; i < 40; i++) {
    const x = random() * size;
    const y = random() * size;
    const length = 30 + random() * 120;
    const width = 2 + random() * 5;
    const rust: RgbaColor = `rgba(118, 60, 28, ${0.2 + random() * 0.25})`;
    const streak = context.createLinearGradient(0, y, 0, y + length);

    streak.addColorStop(0, rust);
    streak.addColorStop(1, clearOf(rust));
    context.fillStyle = streak;

    for (const shift of [-size, 0, size]) {
      context.fillRect(x, y + shift, width, length);
    }
  }
}
