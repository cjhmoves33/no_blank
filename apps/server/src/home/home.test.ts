import {
  advanceBall,
  type Blow,
  restingBall,
  strikeBall,
} from "@no-blank/ball-motion";
import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  type ConnectionId,
  emptyHome,
  type Home,
  type HomeEvent,
  step,
} from "./home.js";

const first = "first";
const second = "second";
const third = "third";
const fourth = "fourth";
const fifth = "fifth";
const sixth = "sixth";

const JAB: Blow = {
  kind: "jab",
  hitFromCenter: new Vector3(0, 0, 0.3),
  fist: new Vector3(0, 0, -1),
};

const GLOVE = { x: 0.2, y: 1.6, z: 0.5 };
const ELSEWHERE = { x: -0.4, y: 1.2, z: 0.3 };

function inbox(
  deliveries: ReturnType<typeof step>["deliveries"],
  id: ConnectionId,
) {
  return deliveries.filter(({ to }) => to === id).map(({ message }) => message);
}

function arrive(home: Home, id: ConnectionId) {
  const stepped = step(home, { kind: "arrived", id });
  const welcome = inbox(stepped.deliveries, id).find(
    (message) => message.kind === "welcome",
  );

  return {
    ...stepped,
    welcome,
    color: welcome?.you.as === "visitor" ? welcome.you.color : undefined,
  };
}

/** 빈 홈에 ids 가 차례로 들어온 홈과, 방문자가 된 사람의 글러브 색입니다. */
function homeWith(...ids: ConnectionId[]) {
  let home = emptyHome();
  const colors = new Map<ConnectionId, string>();

  for (const id of ids) {
    const arrived = arrive(home, id);

    home = arrived.home;

    if (arrived.color !== undefined) {
      colors.set(id, arrived.color);
    }
  }

  return { home, colors };
}

describe("들어오기", () => {
  it("네 명까지는 서로 다른 색의 글러브를 받은 방문자가 되고, 다섯째는 아무에게도 보이지 않는 관중이 된다", () => {
    const { home, colors } = homeWith(first, second, third, fourth);

    expect(new Set(colors.values()).size).toBe(4);
    expect(step(home, { kind: "arrived", id: fifth }).deliveries).toEqual([
      {
        to: fifth,
        message: {
          kind: "welcome",
          you: { as: "spectator" },
          visitors: [first, second, third, fourth].map((id) => ({
            color: colors.get(id),
            glove: null,
          })),
          ball: restingBall(),
        },
      },
    ]);
  });

  it("새 방문자는 먼저 온 방문자의 글러브를 받고, 먼저 온 방문자는 새 색을 알게 된다", () => {
    const { home, colors } = homeWith(first);
    const moved = step(home, { kind: "gloveMoved", id: first, at: GLOVE });
    const { deliveries, welcome, color } = arrive(moved.home, second);

    expect(welcome).toEqual({
      kind: "welcome",
      you: { as: "visitor", color },
      visitors: [{ color: colors.get(first), glove: GLOVE }],
      ball: restingBall(),
    });
    expect(inbox(deliveries, first)).toEqual([
      { kind: "visitorArrived", color },
    ]);
  });

  it("나간 방문자의 색은 다음에 들어온 방문자가 받는다", () => {
    const { home, colors } = homeWith(first, second, third, fourth);
    const left = step(home, { kind: "left", id: second });

    expect(arrive(left.home, fifth).color).toBe(colors.get(second));
  });
});

describe("나가기", () => {
  it("방문자가 나가면 남은 모두가 알게 되고, 맨 앞 관중이 그 색의 방문자가 된다", () => {
    const { home, colors } = homeWith(
      first,
      second,
      third,
      fourth,
      fifth,
      sixth,
    );
    const color = colors.get(second);
    const { deliveries } = step(home, { kind: "left", id: second });

    expect(inbox(deliveries, second)).toEqual([]);
    expect(inbox(deliveries, fifth)).toEqual([
      { kind: "visitorLeft", color },
      { kind: "promoted", color },
    ]);

    for (const id of [first, third, fourth, sixth]) {
      expect(inbox(deliveries, id)).toEqual([
        { kind: "visitorLeft", color },
        { kind: "visitorArrived", color },
      ]);
    }
  });

  it("관중이 나가면 아무에게도 알리지 않고 줄에서만 빠진다", () => {
    const { home, colors } = homeWith(
      first,
      second,
      third,
      fourth,
      fifth,
      sixth,
    );
    const left = step(home, { kind: "left", id: fifth });
    const { deliveries } = step(left.home, { kind: "left", id: first });

    expect(left.deliveries).toEqual([]);
    expect(inbox(deliveries, fifth)).toEqual([]);
    expect(inbox(deliveries, sixth)).toContainEqual({
      kind: "promoted",
      color: colors.get(first),
    });
  });

  it("홈에 없는 연결이 나가면 아무 일도 없다", () => {
    const { home } = homeWith(first);
    const left = step(home, { kind: "left", id: second });

    expect(left.deliveries).toEqual([]);
    expect(left.home).toEqual(home);
  });

  it("모두 나가면 레킹볼은 처음 상태로 돌아간다", () => {
    const { home } = homeWith(first, second);
    const events: HomeEvent[] = [
      { kind: "struck", id: first, blow: JAB },
      { kind: "ticked", seconds: 0.3 },
      { kind: "left", id: first },
      { kind: "left", id: second },
    ];
    const empty = events.reduce(
      (current, event) => step(current, event).home,
      home,
    );

    expect(arrive(empty, third).welcome?.ball).toEqual(restingBall());
  });
});

describe("레킹볼", () => {
  it("방문자의 타격은 레킹볼을 움직이고, 친 방문자를 뺀 모두에게 전해진다", () => {
    const { home, colors } = homeWith(first, second, third, fourth, fifth);
    const struck = step(home, { kind: "struck", id: first, blow: JAB });

    expect(inbox(struck.deliveries, first)).toEqual([]);

    for (const id of [second, third, fourth, fifth]) {
      expect(inbox(struck.deliveries, id)).toEqual([
        { kind: "struck", color: colors.get(first), blow: JAB },
      ]);
    }

    expect(arrive(struck.home, sixth).welcome?.ball).toEqual(
      strikeBall(restingBall(), JAB).motion,
    );
  });

  it("시간이 흐를 때마다 홈에 있는 모두가 이어서 움직인 레킹볼을 받는다", () => {
    const { home } = homeWith(first, second, third, fourth, fifth);
    const struck = step(home, { kind: "struck", id: first, blow: JAB });
    const once = step(struck.home, { kind: "ticked", seconds: 0.25 });
    const { deliveries } = step(once.home, { kind: "ticked", seconds: 0.25 });
    const ball = advanceBall(
      advanceBall(strikeBall(restingBall(), JAB).motion, 0.25).motion,
      0.25,
    ).motion;

    for (const id of [first, second, third, fourth, fifth]) {
      expect(inbox(deliveries, id)).toEqual([{ kind: "ball", ball }]);
    }
  });

  it("아무도 없는 홈은 시간이 흘러도 아무에게도 보내지 않고, 레킹볼도 처음 상태 그대로다", () => {
    const ticked = step(emptyHome(), { kind: "ticked", seconds: 0.001 });

    expect(ticked.deliveries).toEqual([]);
    expect(arrive(ticked.home, first).welcome?.ball).toEqual(restingBall());
  });

  it("관중의 타격과 글러브는 아무것도 바꾸지 않고 아무에게도 보내지 않는다", () => {
    const { home } = homeWith(first, second, third, fourth, fifth);
    const events: HomeEvent[] = [
      { kind: "struck", id: fifth, blow: JAB },
      { kind: "gloveMoved", id: fifth, at: GLOVE },
      { kind: "wentAway", id: fifth },
      { kind: "cameBack", id: fifth },
    ];

    for (const event of events) {
      const stepped = step(home, event);

      expect(stepped.deliveries).toEqual([]);
      expect(stepped.home).toEqual(home);
    }
  });
});

describe("글러브", () => {
  it("글러브 움직임은 움직인 방문자를 뺀 모두에게 전해진다", () => {
    const { home, colors } = homeWith(first, second, third, fourth, fifth);
    const { deliveries } = step(home, {
      kind: "gloveMoved",
      id: first,
      at: GLOVE,
    });

    expect(inbox(deliveries, first)).toEqual([]);

    for (const id of [second, third, fourth, fifth]) {
      expect(inbox(deliveries, id)).toEqual([
        { kind: "gloveMoved", color: colors.get(first), at: GLOVE },
      ]);
    }
  });

  it("다른 탭에 가 있는 방문자의 글러브는 다른 방문자에게도, 나중에 들어온 사람에게도 보이지 않는다", () => {
    const { home, colors } = homeWith(first, second);
    const color = colors.get(first);
    const moved = step(home, { kind: "gloveMoved", id: first, at: GLOVE });
    const away = step(moved.home, { kind: "wentAway", id: first });
    const movedWhileAway = step(away.home, {
      kind: "gloveMoved",
      id: first,
      at: ELSEWHERE,
    });

    expect(inbox(away.deliveries, second)).toEqual([
      { kind: "gloveMoved", color, at: null },
    ]);
    expect(movedWhileAway.deliveries).toEqual([]);
    expect(arrive(movedWhileAway.home, third).welcome?.visitors).toContainEqual(
      { color, glove: null },
    );
  });

  it("다른 탭에 가 있어도 자리는 그대로라 칠 수 있고, 돌아와 움직이면 다시 보인다", () => {
    const { home, colors } = homeWith(first, second);
    const color = colors.get(first);
    const away = step(home, { kind: "wentAway", id: first });
    const struck = step(away.home, { kind: "struck", id: first, blow: JAB });
    const back = step(struck.home, { kind: "cameBack", id: first });
    const moved = step(back.home, { kind: "gloveMoved", id: first, at: GLOVE });

    expect(inbox(struck.deliveries, second)).toEqual([
      { kind: "struck", color, blow: JAB },
    ]);
    expect(back.deliveries).toEqual([]);
    expect(inbox(moved.deliveries, second)).toEqual([
      { kind: "gloveMoved", color, at: GLOVE },
    ]);
  });
});
