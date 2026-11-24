import { describe, expect, it } from "vitest";

import { addBlotches, type BlotchCanvas, type Blotches } from "./brushes";

const SIZE = 64;

interface Disk {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

interface Drawn extends Disk {
  readonly stops: [offset: number, color: string][];
  readonly gradient: CanvasGradient;
}

interface Fill {
  readonly rect: readonly [x: number, y: number, w: number, h: number];
  readonly style: BlotchCanvas["fillStyle"];
}

function recordingCanvas() {
  const drawn: Drawn[] = [];
  const fills: Fill[] = [];
  const canvas: BlotchCanvas = {
    canvas: { width: SIZE, height: SIZE },
    fillStyle: "",
    createRadialGradient: (...circles) => {
      const [, , , x, y, radius] = circles;
      const stops: [number, string][] = [];
      const gradient = {
        addColorStop: (offset: number, color: string) => {
          stops.push([offset, color]);
        },
      };

      drawn.push({ x, y, radius, stops, gradient });

      return gradient;
    },
    fillRect: (...rect) => {
      fills.push({ rect, style: canvas.fillStyle });
    },
  };

  return { canvas, drawn, fills };
}

const FADES: Record<string, string> = {
  "rgba(255, 250, 240, 0.08)": "rgba(255, 250, 240, 0)",
  "rgba(20, 10, 0, 0.1)": "rgba(20, 10, 0, 0)",
};

const BIG_BLOTCHES = {
  count: 20,
  colors: ["rgba(255, 250, 240, 0.08)", "rgba(20, 10, 0, 0.1)"],
  maxRadius: 40,
  seed: 1,
} as const satisfies Omit<Blotches, "wrap">;

const STEPS = [-3, -2, -1, 0, 1, 2, 3].map((step) => step * SIZE);

function overlapsCanvas({ x, y, radius }: Disk): boolean {
  return (
    x + radius > 0 && x - radius < SIZE && y + radius > 0 && y - radius < SIZE
  );
}

function shiftedCopies(blotch: Drawn, shifts: { x: number; y: number }[]) {
  return shifts
    .map(({ x, y }) => ({
      x: blotch.x + x,
      y: blotch.y + y,
      radius: blotch.radius,
    }))
    .filter(overlapsCanvas);
}

function expectCopies(drawn: Drawn[], shifts: { x: number; y: number }[]) {
  for (const blotch of drawn) {
    for (const copy of shiftedCopies(blotch, shifts)) {
      expect(drawn).toContainEqual(
        expect.objectContaining({ ...copy, stops: blotch.stops }),
      );
    }
  }
}

describe("addBlotches", () => {
  it("얼룩마다 같은 색에서 알파만 0 으로 흐려집니다", () => {
    const { canvas, drawn } = recordingCanvas();

    addBlotches(canvas, { ...BIG_BLOTCHES, wrap: "none" });

    for (const { stops } of drawn) {
      const from = stops[0]?.[1] ?? "";

      expect(stops).toEqual([
        [0, from],
        [1, FADES[from]],
      ]);
    }
  });

  it("얼룩마다 제 그라데이션으로 둘레의 정사각형을 칠합니다", () => {
    const { canvas, drawn, fills } = recordingCanvas();

    addBlotches(canvas, { ...BIG_BLOTCHES, wrap: "both" });

    for (const { x, y, radius, gradient } of drawn) {
      expect(fills).toContainEqual({
        rect: [x - radius, y - radius, radius * 2, radius * 2],
        style: gradient,
      });
    }
  });

  it("감싸지 않는 그림에는 얼룩을 한 번씩만 그립니다", () => {
    const { canvas, drawn } = recordingCanvas();

    addBlotches(canvas, { ...BIG_BLOTCHES, wrap: "none" });

    expect(drawn).toHaveLength(BIG_BLOTCHES.count);
  });

  it("양쪽으로 감싸는 그림에서는 가장자리를 넘는 얼룩을 반대쪽에도 그립니다", () => {
    const { canvas, drawn } = recordingCanvas();

    addBlotches(canvas, { ...BIG_BLOTCHES, wrap: "both" });

    expect(drawn.length).toBeGreaterThan(BIG_BLOTCHES.count);
    expectCopies(
      drawn,
      STEPS.flatMap((x) => STEPS.map((y) => ({ x, y }))),
    );
  });

  it("가로로만 감싸는 그림에서는 위아래로 옮겨 그리지 않습니다", () => {
    const { canvas, drawn } = recordingCanvas();

    addBlotches(canvas, { ...BIG_BLOTCHES, wrap: "horizontal" });

    expectCopies(
      drawn,
      STEPS.map((x) => ({ x, y: 0 })),
    );

    for (const { y } of drawn) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(SIZE);
    }
  });

  it("그림보다 큰 얼룩도 이어지도록 필요한 만큼 옮겨 그립니다", () => {
    const { canvas, drawn } = recordingCanvas();

    addBlotches(canvas, { ...BIG_BLOTCHES, maxRadius: SIZE * 2, wrap: "both" });

    expectCopies(
      drawn,
      STEPS.flatMap((x) => STEPS.map((y) => ({ x, y }))),
    );
  });
});
