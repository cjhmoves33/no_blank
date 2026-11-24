import {
  addBlotches,
  addGrain,
  clearOf,
  type RgbaColor,
  seededRandom,
} from "../brushes";
import { GYM } from "../measurements";
import type { Painting } from "../painted-texture";
import { LOOK } from "./look";
import { matPixel, padTextureV } from "./rigging";

const { mat, ropes, posts } = GYM;

const MAT_SIZE = 2048;
const MAT_PIXELS = { width: MAT_SIZE, height: MAT_SIZE };
const PIXELS_PER_METER = MAT_SIZE / (mat.half * 2);

interface Scuff {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly length: number;
  readonly bend: number;
  readonly width: number;
  readonly alpha: number;
  readonly mark: "sole" | "smear";
}

const SCUFFS: readonly Scuff[] = (() => {
  const random = seededRandom(51);
  const centerWeighted = () =>
    ((random() + random() + random()) / 1.5 - 1) * ropes.half;

  return Array.from({ length: Math.round(420 * LOOK.wear) }, () => {
    const [x, y] = matPixel(centerWeighted(), centerWeighted(), MAT_PIXELS);
    const sole = random() < 0.15;

    return {
      x,
      y,
      angle: random() * Math.PI * 2,
      length:
        (sole ? 0.03 + random() * 0.08 : 0.1 + random() * 0.3) *
        PIXELS_PER_METER,
      bend: (random() - 0.5) * 0.5,
      width: sole ? 1.5 + random() * 2 : 8 + random() * 16,
      alpha: sole ? 0.08 + random() * 0.1 : 0.025 + random() * 0.04,
      mark: sole ? "sole" : "smear",
    };
  });
})();

// 번진 자국은 굵기를 줄여 가며 겹쳐 그려 가장자리를 흐립니다. 캔버스의 filter 는 브라우저마다 지원이 달라 쓰지 않습니다.
const SMEAR_LAYERS = [
  { width: 1.6, alpha: 0.35 },
  { width: 1, alpha: 0.35 },
  { width: 0.5, alpha: 0.3 },
] as const;

const SOLE_LAYERS = [{ width: 1, alpha: 1 }] as const;

function strokeScuffs(
  context: CanvasRenderingContext2D,
  color: (alpha: number) => string,
): void {
  context.lineCap = "round";

  for (const scuff of SCUFFS) {
    const layers = scuff.mark === "sole" ? SOLE_LAYERS : SMEAR_LAYERS;

    for (const layer of layers) {
      context.strokeStyle = color(scuff.alpha * layer.alpha);
      context.lineWidth = scuff.width * layer.width;
      strokeScuff(context, scuff);
    }
  }
}

function strokeScuff(context: CanvasRenderingContext2D, scuff: Scuff): void {
  const dx = Math.cos(scuff.angle) * scuff.length;
  const dy = Math.sin(scuff.angle) * scuff.length;

  context.beginPath();
  context.moveTo(scuff.x, scuff.y);
  context.quadraticCurveTo(
    scuff.x + dx / 2 - dy * scuff.bend,
    scuff.y + dy / 2 + dx * scuff.bend,
    scuff.x + dx,
    scuff.y + dy,
  );
  context.stroke();
}

function shade(
  context: CanvasRenderingContext2D,
  [x, y]: readonly [number, number],
  { radius, color }: { readonly radius: number; readonly color: RgbaColor },
): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

  gradient.addColorStop(0, color);
  gradient.addColorStop(1, clearOf(color));
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function paintWeave(context: CanvasRenderingContext2D): void {
  const { width, height } = context.canvas;

  context.strokeStyle = "#000000";
  context.globalAlpha = 0.05;
  context.beginPath();

  for (let x = 0; x < width; x += 6) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }

  context.stroke();
  context.globalAlpha = 0.03;
  context.beginPath();

  for (let y = 0; y < height; y += 6) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }

  context.stroke();
  context.globalAlpha = 1;
}

function paintMarkings(context: CanvasRenderingContext2D): void {
  const { width, height } = context.canvas;
  const apron = (width / 2) * (1 - ropes.half / mat.half);

  context.strokeStyle = LOOK.apronLine;
  context.globalAlpha = 0.85;
  context.lineWidth = apron * 0.12;
  context.strokeRect(
    apron * 0.7,
    apron * 0.7,
    width - apron * 1.4,
    height - apron * 1.4,
  );

  const radius = width * 0.16;

  context.globalAlpha = 0.22;
  context.strokeStyle = LOOK.emblem;
  strokeCircle(context, radius, radius * 0.08);
  strokeCircle(context, radius * 0.86, radius * 0.02);
  context.globalAlpha = 1;
}

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

function paintWear(context: CanvasRenderingContext2D): void {
  const { wear } = LOOK;

  shade(context, matPixel(0, 0, MAT_PIXELS), {
    radius: 1.7 * PIXELS_PER_METER,
    color: `rgba(95, 78, 58, ${0.12 * wear})`,
  });
  addBlotches(context, {
    count: Math.round(80 * wear),
    colors: ["rgba(110, 90, 62, 0.07)", "rgba(80, 68, 52, 0.06)"],
    maxRadius: 110,
    seed: 53,
    tiles: false,
  });
  paintMarkings(context);
  strokeScuffs(context, (alpha) => `rgba(55, 45, 38, ${alpha})`);

  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      shade(context, matPixel(x * 2.6, z * 2.6, MAT_PIXELS), {
        radius: 0.9 * PIXELS_PER_METER,
        color: `rgba(70, 58, 45, ${0.1 * wear})`,
      });
    }
  }
}

function paintPostShadows(context: CanvasRenderingContext2D): void {
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      shade(context, matPixel(x * posts.at, z * posts.at, MAT_PIXELS), {
        radius: 0.16 * PIXELS_PER_METER,
        color: "rgba(20, 15, 10, 0.5)",
      });
    }
  }
}

export const MAT: Painting = {
  ...MAT_PIXELS,
  tiles: false,
  paint: (context) => {
    const { width, height } = context.canvas;

    context.fillStyle = LOOK.mat;
    context.fillRect(0, 0, width, height);
    paintWeave(context);
    addGrain(context, 20, 7);
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
      tiles: false,
    });
    paintWear(context);
    paintPostShadows(context);
  },
};

export const MAT_RELIEF: Painting = {
  ...MAT_PIXELS,
  tiles: false,
  paint: (context) => {
    const { width, height } = context.canvas;

    context.fillStyle = "#808080";
    context.fillRect(0, 0, width, height);
    addGrain(context, 40, 57);
    strokeScuffs(context, (alpha) => `rgba(0, 0, 0, ${alpha * 2.5})`);
  },
};

const ROPE_PIXELS = { width: 2048, height: 32 };

interface Crease {
  readonly x: number;
  readonly width: number;
  readonly alpha: number;
}

const CREASES: readonly Crease[] = (() => {
  const random = seededRandom(61);

  return Array.from({ length: 70 }, () => ({
    x: random() * ROPE_PIXELS.width,
    width: 1 + random() * 3,
    alpha: 0.05 + random() * 0.12,
  }));
})();

function paintCreases(
  context: CanvasRenderingContext2D,
  strength: number,
): void {
  for (const crease of CREASES) {
    context.fillStyle = `rgba(0, 0, 0, ${crease.alpha * strength})`;
    context.fillRect(crease.x, 0, crease.width, context.canvas.height);
  }
}

export const ROPE_GRIME: Painting = {
  ...ROPE_PIXELS,
  tiles: false,
  paint: (context) => {
    const { width, height } = context.canvas;
    const grime = context.createLinearGradient(0, 0, width, 0);
    const dark: RgbaColor = `rgba(35, 28, 22, ${0.4 * LOOK.wear})`;

    context.fillStyle = "#f2f2f2";
    context.fillRect(0, 0, width, height);
    grime.addColorStop(0, dark);
    grime.addColorStop(0.1, clearOf(dark));
    grime.addColorStop(0.9, clearOf(dark));
    grime.addColorStop(1, dark);
    context.fillStyle = grime;
    context.fillRect(0, 0, width, height);
    paintCreases(context, 1);
    addGrain(context, 12, 63);
  },
};

export const ROPE_RELIEF: Painting = {
  ...ROPE_PIXELS,
  tiles: false,
  paint: (context) => {
    const { width, height } = context.canvas;

    context.fillStyle = "#808080";
    context.fillRect(0, 0, width, height);
    paintCreases(context, 3);
    addGrain(context, 20, 65);
  },
};

const PAD_PIXELS = { width: 256, height: 1024 };
const SEAM_INSET = 22;

function padRow(height: number): number {
  return (1 - padTextureV(height)) * PAD_PIXELS.height;
}

export const PAD_GRIME: Painting = {
  ...PAD_PIXELS,
  tiles: false,
  paint: (context) => {
    const { width, height } = context.canvas;
    const dark = 0.25 * LOOK.wear;

    context.fillStyle = "#f4f4f4";
    context.fillRect(0, 0, width, height);

    for (const rope of ropes.heights) {
      const row = padRow(rope);
      const band = context.createLinearGradient(0, row - 40, 0, row + 40);

      const pressed: RgbaColor = `rgba(40, 30, 24, ${dark})`;

      band.addColorStop(0, clearOf(pressed));
      band.addColorStop(0.5, pressed);
      band.addColorStop(1, clearOf(pressed));
      context.fillStyle = band;
      context.fillRect(0, row - 40, width, 80);
    }

    addBlotches(context, {
      count: 24,
      colors: [`rgba(40, 30, 24, ${dark / 2})`],
      maxRadius: 60,
      seed: 71,
      tiles: false,
    });
    addGrain(context, 12, 73);
  },
};

export const PAD_SEAMS: Painting = {
  ...PAD_PIXELS,
  tiles: false,
  paint: (context) => {
    const { width, height } = context.canvas;

    context.fillStyle = "#808080";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#3a3a3a";

    for (const [x, inward] of [
      [SEAM_INSET, 1],
      [width - SEAM_INSET, -1],
    ] as const) {
      context.fillRect(x - 1.5, 0, 3, height);

      for (let y = 6; y < height; y += 14) {
        context.fillRect(x + inward * 7 - 1, y, 2, 7);
      }
    }

    for (const y of [SEAM_INSET, height - SEAM_INSET]) {
      context.fillRect(0, y - 1.5, width, 3);
    }

    addGrain(context, 18, 75);
  },
};
