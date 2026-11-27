import type { Blow } from "@no-blank/ball-motion";
import { Plane, Ray, Sphere, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { GYM } from "../measurements";
import {
  type BallShape,
  dragTo,
  type PointerSample,
  type Press,
  pressDown,
  type PressStep,
  touches,
} from "./press";

const { radius, lidHeight } = GYM.wreckingBall;
const EYE = new Vector3(0, 0, 5);
const BALL = ballAt(new Vector3());
const EVENT_GAP = 0.008;

function ballAt(center: Vector3): BallShape {
  return {
    sphere: new Sphere(center, radius),
    lid: new Plane().setFromNormalAndCoplanarPoint(
      new Vector3(0, 1, 0),
      center.clone().add(new Vector3(0, lidHeight, 0)),
    ),
  };
}

function cursorAt(x: number, y: number, seconds: number): PointerSample {
  return {
    ray: new Ray(EYE.clone(), new Vector3(x, y, 0).sub(EYE).normalize()),
    seconds,
  };
}

interface Stroke {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly seconds: number;
}

function drag(
  press: Press,
  { from, to, seconds }: Stroke,
  ball = BALL,
): { readonly press: Press; readonly firstBlow: Blow | null } {
  const steps = Math.max(1, Math.round(seconds / EVENT_GAP));
  const start = press.kind === "swiping" ? press.latest.seconds : 1;
  let step: PressStep = { press, blow: null };
  let firstBlow: Blow | null = null;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;

    step = dragTo(
      step.press,
      cursorAt(
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        start + seconds * t,
      ),
      ball,
    );
    firstBlow ??= step.blow;
  }

  return { press: step.press, firstBlow };
}

function pressedAt(x: number, y: number): Press {
  return pressDown(cursorAt(x, y, 1), BALL).press;
}

describe("press", () => {
  it("레킹볼 위에서 누르면 그 순간 잽을 치고, 맞은 자리는 누른 곳의 앞면이다", () => {
    const { press, blow } = pressDown(cursorAt(0.1, 0, 1), BALL);

    expect(blow?.kind).toBe("jab");
    expect(blow?.hitFromCenter.length()).toBeCloseTo(radius, 9);
    expect(blow?.hitFromCenter.x).toBeGreaterThan(0.05);
    expect(blow?.hitFromCenter.z).toBeGreaterThan(0.2);
    expect(press.kind).toBe("spent");
  });

  it("잽을 친 뒤 끌어도 더 치지 않는다", () => {
    const { press } = pressDown(cursorAt(0, 0, 1), BALL);
    const after = drag(press, { from: [0, 0], to: [1, 0], seconds: 0.05 });

    expect(after.firstBlow).toBeNull();
  });

  it("레킹볼 밖에서 누르면 아무것도 치지 않고 기다린다", () => {
    const { press, blow } = pressDown(cursorAt(-1, 0, 1), BALL);

    expect(blow).toBeNull();
    expect(press.kind).toBe("swiping");
  });

  it("밖에서 눌러 빠르게 끌어 들어가면, 들어가는 순간 끈 방향과 빠르기로 휘두른다", () => {
    const { firstBlow } = drag(pressedAt(-1, 0), {
      from: [-1, 0],
      to: [0, 0],
      seconds: 0.2,
    });

    expect(firstBlow?.kind).toBe("swipe");
    expect(firstBlow?.fist.x).toBeCloseTo(1, 6);
    expect(firstBlow?.kind === "swipe" ? firstBlow.speed : 0).toBeCloseTo(5, 0);
  });

  it("휘두르기의 맞은 자리는 들어간 순간 커서가 가리키는 앞면이다", () => {
    const { firstBlow } = drag(pressedAt(-1, 0), {
      from: [-1, 0],
      to: [0, 0],
      seconds: 0.2,
    });

    expect(firstBlow?.hitFromCenter.length()).toBeCloseTo(radius, 9);
    expect(firstBlow?.hitFromCenter.x).toBeLessThan(0);
    expect(firstBlow?.hitFromCenter.z).toBeGreaterThan(radius * 0.25);
  });

  it("아래에서 위로 끌어 들어가면 위쪽으로 휘두른다", () => {
    const { firstBlow } = drag(pressedAt(0, -1), {
      from: [0, -1],
      to: [0, 0],
      seconds: 0.2,
    });

    expect(firstBlow?.fist.y).toBeCloseTo(1, 6);
  });

  it("한 이벤트 사이에 레킹볼을 건너뛰어도 지나간 길에서 잡아 친다", () => {
    const step = dragTo(pressedAt(-1, 0), cursorAt(1, 0, 1.016), BALL);

    expect(step.blow?.kind).toBe("swipe");
    expect(step.blow?.hitFromCenter.x).toBeCloseTo(-radius, 2);
  });

  it("누른 채 가만히 있다가 한 번에 빠르게 끌어 들어가도 친다", () => {
    const { press } = pressDown(cursorAt(-0.4, 0, 0), BALL);
    const step = dragTo(press, cursorAt(0, 0, 1), BALL);

    expect(step.blow?.kind).toBe("swipe");
  });

  it("같은 시각에 이벤트가 두 번 와도 휘두르기 빠르기를 잰다", () => {
    const outside = drag(pressedAt(-1, 0), {
      from: [-1, 0],
      to: [-0.32, 0],
      seconds: 0.136,
    });
    const latest =
      outside.press.kind === "swiping" ? outside.press.latest : null;
    const step = dragTo(
      outside.press,
      cursorAt(-0.28, 0, latest?.seconds ?? 0),
      BALL,
    );
    const speed = step.blow?.kind === "swipe" ? step.blow.speed : 0;

    expect(outside.firstBlow).toBeNull();
    expect(speed).toBeGreaterThan(4);
    expect(speed).toBeLessThan(7);
  });

  it("레킹볼을 비껴 지나가면 치지 않는다", () => {
    const { firstBlow } = drag(pressedAt(-1, 1), {
      from: [-1, 1],
      to: [1, 1],
      seconds: 0.1,
    });

    expect(firstBlow).toBeNull();
  });

  it("너무 느리게 들어가면 치지 않고, 나갔다가 빠르게 다시 들어오면 친다", () => {
    const slow = drag(pressedAt(-1, 0), {
      from: [-1, 0],
      to: [0, 0],
      seconds: 4,
    });
    const out = drag(slow.press, { from: [0, 0], to: [-1, 0], seconds: 4 });
    const fast = drag(out.press, { from: [-1, 0], to: [0, 0], seconds: 0.1 });

    expect(slow.firstBlow).toBeNull();
    expect(out.firstBlow).toBeNull();
    expect(fast.firstBlow?.kind).toBe("swipe");
  });

  it("한 번 누르는 동안 한 번만 친다", () => {
    const first = drag(pressedAt(-1, 0), {
      from: [-1, 0],
      to: [1, 0],
      seconds: 0.1,
    });
    const back = drag(first.press, { from: [1, 0], to: [-1, 0], seconds: 0.1 });

    expect(first.firstBlow?.kind).toBe("swipe");
    expect(back.firstBlow).toBeNull();
  });

  it("레킹볼이 가만한 커서 밑으로 흔들려 와도 치지 않는다", () => {
    const press = pressedAt(-0.5, 0);
    const swungUnder = ballAt(new Vector3(-0.5, 0, 0));
    const under = dragTo(press, cursorAt(-0.5, 0, 1.008), swungUnder);
    const still = drag(
      under.press,
      {
        from: [-0.5, 0],
        to: [-0.45, 0],
        seconds: 0.05,
      },
      swungUnder,
    );

    expect(under.blow).toBeNull();
    expect(still.firstBlow).toBeNull();
  });

  it("레킹볼이 커서 밑으로 흔들려 온 뒤에는 그 안에서 빠르게 끌어도 치지 않는다", () => {
    const swungUnder = ballAt(new Vector3(-0.5, 0, 0));
    const inside = drag(
      pressedAt(-0.5, 0),
      { from: [-0.5, 0], to: [-0.35, 0], seconds: 0.03 },
      swungUnder,
    );

    expect(inside.firstBlow).toBeNull();
  });

  it("납작한 덮개 위의 빈 곳을 누르면 치지 않고, 커서도 레킹볼 위에 있지 않다", () => {
    const aboveLid = cursorAt(0, 0.27, 1);

    expect(pressDown(aboveLid, BALL).blow).toBeNull();
    expect(touches(aboveLid.ray, BALL)).toBe(false);
  });

  it("위에서 덮개를 누르면 덮개를 친다", () => {
    const fromAbove: PointerSample = {
      ray: new Ray(new Vector3(0.05, 5, 0), new Vector3(0, -1, 0)),
      seconds: 1,
    };
    const { blow } = pressDown(fromAbove, BALL);

    expect(blow?.kind).toBe("jab");
    expect(blow?.hitFromCenter.y).toBeCloseTo(lidHeight, 9);
  });

  it("위에서 내려치며 덮개 위 빈 곳을 지나 들어가면, 덮개 높이 아래를 친다", () => {
    const { firstBlow } = drag(pressedAt(0, 0.6), {
      from: [0, 0.6],
      to: [0, 0],
      seconds: 0.1,
    });

    expect(firstBlow?.kind).toBe("swipe");
    expect(firstBlow?.hitFromCenter.y).toBeLessThanOrEqual(lidHeight + 1e-9);
  });

  it("커서가 레킹볼 위에 있는지 알려 준다", () => {
    expect(touches(cursorAt(0.2, 0, 0).ray, BALL)).toBe(true);
    expect(touches(cursorAt(0.5, 0, 0).ray, BALL)).toBe(false);
  });
});
