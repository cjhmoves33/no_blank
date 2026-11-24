import { describe, expect, it } from "vitest";

import { addBlotches, type BlotchCanvas } from "./brushes";

function recordingCanvas() {
  const gradients: [offset: number, color: string][][] = [];
  const canvas: BlotchCanvas = {
    canvas: { width: 64, height: 64 },
    fillStyle: "",
    createRadialGradient: () => {
      const stops: [number, string][] = [];

      gradients.push(stops);

      return {
        addColorStop: (offset, color) => {
          stops.push([offset, color]);
        },
      };
    },
    fillRect: () => undefined,
  };

  return { canvas, gradients };
}

const FADES: Record<string, string> = {
  "rgba(255, 250, 240, 0.08)": "rgba(255, 250, 240, 0)",
  "rgba(20, 10, 0, 0.1)": "rgba(20, 10, 0, 0)",
};

describe("addBlotches", () => {
  it("얼룩마다 같은 색에서 알파만 0 으로 흐려집니다", () => {
    const { canvas, gradients } = recordingCanvas();

    addBlotches(canvas, {
      count: 20,
      colors: ["rgba(255, 250, 240, 0.08)", "rgba(20, 10, 0, 0.1)"],
      maxRadius: 10,
      seed: 1,
    });

    expect(gradients).toHaveLength(20);

    for (const stops of gradients) {
      const from = stops[0]?.[1] ?? "";

      expect(stops).toEqual([
        [0, from],
        [1, FADES[from]],
      ]);
    }
  });
});
