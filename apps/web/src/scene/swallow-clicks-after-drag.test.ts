import { describe, expect, it } from "vitest";

import { swallowClicksAfterDrag } from "./swallow-clicks-after-drag";

type Path = readonly (readonly [x: number, y: number])[];

function attachToCanvas() {
  const canvas = new EventTarget();
  const detach = swallowClicksAfterDrag(canvas);
  const sceneClicks: string[] = [];

  canvas.addEventListener("click", () => {
    sceneClicks.push("click");
  });

  return { canvas, detach, sceneClicks };
}

function pointerAt(
  type: "pointerdown" | "pointermove",
  [x, y]: readonly [number, number],
): Event {
  return Object.assign(new Event(type), { clientX: x, clientY: y });
}

function pressAtOriginThenClick(canvas: EventTarget, path: Path): void {
  canvas.dispatchEvent(pointerAt("pointerdown", [0, 0]));

  for (const point of path) {
    canvas.dispatchEvent(pointerAt("pointermove", point));
  }

  canvas.dispatchEvent(new Event("click"));
}

describe("swallowClicksAfterDrag", () => {
  it("제자리에서 누르고 떼면 클릭이 장면에 닿는다", () => {
    const { canvas, sceneClicks } = attachToCanvas();

    pressAtOriginThenClick(canvas, []);

    expect(sceneClicks).toEqual(["click"]);
  });

  it("누른 채 손이 조금 떨려도 클릭으로 본다", () => {
    const { canvas, sceneClicks } = attachToCanvas();

    pressAtOriginThenClick(canvas, [
      [3, 0],
      [0, 3],
    ]);

    expect(sceneClicks).toEqual(["click"]);
  });

  it("누른 채 끌면 그 클릭을 막는다", () => {
    const { canvas, sceneClicks } = attachToCanvas();

    pressAtOriginThenClick(canvas, [[40, 0]]);

    expect(sceneClicks).toEqual([]);
  });

  it("끌었다가 누른 자리로 돌아와 떼도 클릭을 막는다", () => {
    const { canvas, sceneClicks } = attachToCanvas();

    pressAtOriginThenClick(canvas, [
      [40, 0],
      [0, 0],
    ]);

    expect(sceneClicks).toEqual([]);
  });

  it("앞에서 끌었더라도 다음 누름은 클릭이 된다", () => {
    const { canvas, sceneClicks } = attachToCanvas();

    pressAtOriginThenClick(canvas, [[40, 0]]);
    pressAtOriginThenClick(canvas, []);

    expect(sceneClicks).toEqual(["click"]);
  });

  it("떼어 낸 뒤에는 끈 다음의 클릭도 막지 않는다", () => {
    const { canvas, detach, sceneClicks } = attachToCanvas();

    detach();
    pressAtOriginThenClick(canvas, [[40, 0]]);

    expect(sceneClicks).toEqual(["click"]);
  });
});
