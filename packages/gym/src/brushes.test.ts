import { describe, expect, it } from "vitest";

import { addBlotches, type BlotchCanvas } from "./brushes";

const SIZE = 64;

interface Drawn {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly stops: [offset: number, color: string][];
}

function recordingCanvas() {
  const drawn: Drawn[] = [];
  const canvas: BlotchCanvas = {
    canvas: { width: SIZE, height: SIZE },
    fillStyle: "",
    createRadialGradient: (...circles) => {
      const [, , , x, y, radius] = circles;
      const stops: [number, string][] = [];

      drawn.push({ x, y, radius, stops });

      return {
        addColorStop: (offset, color) => {
          stops.push([offset, color]);
        },
      };
    },
    fillRect: () => undefined,
  };

  return { canvas, drawn };
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
} as const;

const SHIFTS = [-SIZE, 0, SIZE].flatMap((dx) =>
  [-SIZE, 0, SIZE].map((dy) => [dx, dy] as const),
);

function overlapsCanvas({ x, y, radius }: Omit<Drawn, "stops">): boolean {
  return (
    x + radius > 0 && x - radius < SIZE && y + radius > 0 && y - radius < SIZE
  );
}

describe("addBlotches", () => {
  it("얼룩마다 같은 색에서 알파만 0 으로 흐려집니다", () => {
    const { canvas, drawn } = recordingCanvas();

    addBlotches(canvas, { ...BIG_BLOTCHES, tiles: false });

    for (const { stops } of drawn) {
      const from = stops[0]?.[1] ?? "";

      expect(stops).toEqual([
        [0, from],
        [1, FADES[from]],
      ]);
    }
  });

  it("반복되지 않는 그림에는 얼룩을 한 번씩만 그립니다", () => {
    const { canvas, drawn } = recordingCanvas();

    addBlotches(canvas, { ...BIG_BLOTCHES, tiles: false });

    expect(drawn).toHaveLength(BIG_BLOTCHES.count);
  });

  it("반복되는 그림에서는 가장자리를 넘는 얼룩을 반대쪽에도 그려 이음매가 없습니다", () => {
    const { canvas, drawn } = recordingCanvas();

    addBlotches(canvas, { ...BIG_BLOTCHES, tiles: true });

    expect(drawn.length).toBeGreaterThan(BIG_BLOTCHES.count);

    for (const blotch of drawn) {
      const copies = SHIFTS.map(([dx, dy]) => ({
        x: blotch.x + dx,
        y: blotch.y + dy,
        radius: blotch.radius,
      })).filter(overlapsCanvas);

      for (const copy of copies) {
        expect(drawn).toContainEqual({ ...copy, stops: blotch.stops });
      }
    }
  });
});
