import { addBlotches, addGrain, seededRandom } from "../brushes";
import { GYM } from "../measurements";
import type { Painting } from "../painted-texture";

interface BrickShade {
  readonly tone: number;
  readonly hue: number;
  readonly saturation: number;
}

interface BrickLayer {
  readonly mortar: string;
  readonly brick: (shade: BrickShade) => string;
  readonly finish: (context: CanvasRenderingContext2D) => void;
}

const BRICK_COURSES = { columns: 8, rows: 26, mortar: 3 } as const;

const BRICK_SEED = 31;

function paintBricks(context: CanvasRenderingContext2D, layer: BrickLayer) {
  const { width, height } = context.canvas;
  const { columns, rows, mortar } = BRICK_COURSES;
  const brickWidth = width / columns;
  const brickHeight = height / rows;
  const random = seededRandom(BRICK_SEED);

  context.fillStyle = layer.mortar;
  context.fillRect(0, 0, width, height);

  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : brickWidth / 2;

    for (let column = 0; column < columns; column++) {
      const x = column * brickWidth + offset;
      const copies = x + brickWidth > width ? [x, x - width] : [x];

      context.fillStyle = layer.brick({
        tone: random(),
        hue: random(),
        saturation: random(),
      });

      for (const left of copies) {
        context.fillRect(
          left + mortar,
          row * brickHeight + mortar,
          brickWidth - mortar * 2,
          brickHeight - mortar * 2,
        );
      }
    }
  }

  layer.finish(context);
}

const BRICK_COLOR: BrickLayer = {
  mortar: "#9c9384",
  brick: ({ tone, hue, saturation }) =>
    `hsl(${10 + hue * 14} ${30 + saturation * 16}% ${30 + tone * 14}%)`,
  finish: (context) => {
    context.fillStyle = "rgba(222, 214, 198, 0.62)";
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    addBlotches(context, {
      count: 120,
      colors: [
        "rgba(222, 214, 198, 0.16)",
        "rgba(120, 70, 50, 0.07)",
        "rgba(60, 45, 35, 0.05)",
      ],
      maxRadius: 110,
      seed: 33,
      wrap: "both",
    });
    addGrain(context, 16, 36);
  },
};

const BRICK_RELIEF_LAYER: BrickLayer = {
  mortar: "#303030",
  brick: ({ tone }) => {
    const gray = Math.round(190 + tone * 50);

    return `rgb(${gray} ${gray} ${gray})`;
  },
  finish: (context) => {
    addGrain(context, 50, 35);
  },
};

export const BRICK: Painting = {
  width: 1024,
  height: 1024,
  tiles: true,
  paint: (context) => {
    paintBricks(context, BRICK_COLOR);
  },
};

export const BRICK_RELIEF: Painting = {
  width: 1024,
  height: 1024,
  tiles: true,
  paint: (context) => {
    paintBricks(context, BRICK_RELIEF_LAYER);
  },
};

const PLANK_ROWS = 20;

export const PLANKS: Painting = {
  width: 1024,
  height: 1024,
  tiles: true,
  paint: (context) => {
    const { width, height } = context.canvas;
    const rowHeight = height / PLANK_ROWS;
    const random = seededRandom(41);

    for (let row = 0; row < PLANK_ROWS; row++) {
      const top = row * rowHeight;

      for (let left = -random() * 300; left < width;) {
        const length = 260 + random() * 420;

        context.fillStyle = `hsl(${28 + random() * 7} ${34 + random() * 12}% ${34 + random() * 12}%)`;
        context.fillRect(left, top, length, rowHeight);
        strokeWoodGrain(context, { left, top, length, rowHeight }, random);
        context.fillStyle = "rgba(25, 12, 4, 0.6)";
        context.fillRect(left, top, 2, rowHeight);
        left += length;
      }

      context.fillStyle = "rgba(25, 12, 4, 0.55)";
      context.fillRect(0, top, width, 2);
    }

    addBlotches(context, {
      count: 50,
      colors: ["rgba(255, 236, 210, 0.08)", "rgba(20, 10, 0, 0.1)"],
      maxRadius: 220,
      seed: 43,
      wrap: "both",
    });
    addGrain(context, 14, 44);
  },
};

interface Plank {
  readonly left: number;
  readonly top: number;
  readonly length: number;
  readonly rowHeight: number;
}

function strokeWoodGrain(
  context: CanvasRenderingContext2D,
  { left, top, length, rowHeight }: Plank,
  random: () => number,
): void {
  context.strokeStyle = "rgba(40, 20, 8, 0.22)";
  context.lineWidth = 1;

  for (let line = 0; line < 6; line++) {
    const y = top + random() * rowHeight;

    context.beginPath();
    context.moveTo(left, y);
    context.bezierCurveTo(
      left + length * 0.3,
      y + (random() - 0.5) * 6,
      left + length * 0.6,
      y + (random() - 0.5) * 6,
      left + length,
      y,
    );
    context.stroke();
  }
}

export const WALL_OCCLUSION: Painting = {
  width: 256,
  height: 256,
  tiles: false,
  paint: (context) => {
    const { width, height } = context.canvas;
    const fade = (
      [fromX, fromY, toX, toY]: readonly [number, number, number, number],
      darkness: number,
    ) => {
      const gradient = context.createLinearGradient(fromX, fromY, toX, toY);

      gradient.addColorStop(0, `rgba(0, 0, 0, ${darkness})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    };

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    fade([0, 0, 0, height * 0.45], 0.6);
    fade([0, height, 0, height * 0.85], 0.45);
    fade([0, 0, width * 0.12, 0], 0.5);
    fade([width, 0, width * 0.88, 0], 0.5);
  },
};

export const FLOOR_OCCLUSION: Painting = {
  width: 512,
  height: 512,
  tiles: false,
  paint: (context) => {
    const { width, height } = context.canvas;
    const ringX = (GYM.mat.half / GYM.building.halfX) * (width / 2);
    const ringZ = (GYM.mat.half / GYM.building.halfZ) * (height / 2);

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.filter = "blur(14px)";
    context.strokeStyle = "rgba(0, 0, 0, 0.7)";
    context.lineWidth = 18;
    context.strokeRect(
      width / 2 - ringX,
      height / 2 - ringZ,
      ringX * 2,
      ringZ * 2,
    );
    context.strokeStyle = "rgba(0, 0, 0, 0.45)";
    context.lineWidth = 30;
    context.strokeRect(0, 0, width, height);
  },
};
