import {
  advanceBall,
  type BallMotion,
  type Blow,
  restingBall,
  strikeBall,
} from "@no-blank/ball-motion";

/** 홈에 연결한 사람 하나입니다. 다시 연결하면 새 ConnectionId 를 받습니다. */
export type ConnectionId = string;

const GLOVE_COLORS = ["red", "blue", "yellow", "green"] as const;

type GloveColor = (typeof GLOVE_COLORS)[number];

/** 체육관 안의 위치입니다. 단위는 미터입니다. */
interface Point {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface Visitor {
  readonly id: ConnectionId;
  readonly color: GloveColor;
  /** 아직 움직이지 않았거나 다른 탭에 가 있으면 null 입니다. */
  readonly glove: Point | null;
  readonly away: boolean;
}

export interface Home {
  readonly visitors: readonly Visitor[];
  /** 먼저 온 관중이 앞에 있습니다. */
  readonly spectators: readonly ConnectionId[];
  readonly ball: BallMotion;
}

export type HomeEvent =
  | { readonly kind: "arrived"; readonly id: ConnectionId }
  | { readonly kind: "left"; readonly id: ConnectionId }
  | {
      readonly kind: "gloveMoved";
      readonly id: ConnectionId;
      readonly at: Point;
    }
  | { readonly kind: "wentAway"; readonly id: ConnectionId }
  | { readonly kind: "cameBack"; readonly id: ConnectionId }
  | { readonly kind: "struck"; readonly id: ConnectionId; readonly blow: Blow }
  | { readonly kind: "ticked"; readonly seconds: number };

type HomeMessage =
  | {
      readonly kind: "welcome";
      readonly you:
        | { readonly as: "visitor"; readonly color: GloveColor }
        | { readonly as: "spectator" };
      readonly visitors: readonly {
        readonly color: GloveColor;
        readonly glove: Point | null;
      }[];
      readonly ball: BallMotion;
    }
  | { readonly kind: "promoted"; readonly color: GloveColor }
  | { readonly kind: "visitorArrived"; readonly color: GloveColor }
  | { readonly kind: "visitorLeft"; readonly color: GloveColor }
  | {
      readonly kind: "gloveMoved";
      readonly color: GloveColor;
      readonly at: Point | null;
    }
  | { readonly kind: "struck"; readonly color: GloveColor; readonly blow: Blow }
  | { readonly kind: "ball"; readonly ball: BallMotion };

interface Delivery {
  readonly to: ConnectionId;
  readonly message: HomeMessage;
}

interface Stepped {
  readonly home: Home;
  readonly deliveries: readonly Delivery[];
}

export function emptyHome(): Home {
  return { visitors: [], spectators: [], ball: restingBall() };
}

export function step(home: Home, event: HomeEvent): Stepped {
  switch (event.kind) {
    case "arrived":
      return arrive(home, event.id);
    case "left":
      return leave(home, event.id);
    case "gloveMoved":
      return changeGlove(home, event.id, { glove: event.at, away: false });
    case "wentAway":
      return changeGlove(home, event.id, { glove: null, away: true });
    case "cameBack":
      return comeBack(home, event.id);
    case "struck":
      return strike(home, event.id, event.blow);
    case "ticked":
      return tick(home, event.seconds);
  }
}

function arrive(home: Home, id: ConnectionId): Stepped {
  const color = GLOVE_COLORS.find((free) =>
    home.visitors.every((visitor) => visitor.color !== free),
  );

  if (color === undefined) {
    return {
      home: { ...home, spectators: [...home.spectators, id] },
      deliveries: send([id], welcome(home, { as: "spectator" })),
    };
  }

  return {
    home: {
      ...home,
      visitors: [...home.visitors, { id, color, glove: null, away: false }],
    },
    deliveries: [
      ...send([id], welcome(home, { as: "visitor", color })),
      ...send(everyone(home), { kind: "visitorArrived", color }),
    ],
  };
}

function welcome(
  home: Home,
  you: Extract<HomeMessage, { kind: "welcome" }>["you"],
): HomeMessage {
  return {
    kind: "welcome",
    you,
    visitors: home.visitors.map(({ color, glove }) => ({ color, glove })),
    ball: home.ball,
  };
}

function leave(home: Home, id: ConnectionId): Stepped {
  const leaving = findVisitor(home, id);

  if (leaving === undefined) {
    return {
      home: {
        ...home,
        spectators: home.spectators.filter((spectator) => spectator !== id),
      },
      deliveries: [],
    };
  }

  const { color } = leaving;
  const remaining: Home = {
    ...home,
    visitors: home.visitors.filter((visitor) => visitor !== leaving),
  };
  const left = send(everyone(remaining), { kind: "visitorLeft", color });
  const [first, ...waiting] = remaining.spectators;

  if (first === undefined) {
    return {
      home: remaining.visitors.length === 0 ? emptyHome() : remaining,
      deliveries: left,
    };
  }

  return {
    home: {
      ...remaining,
      visitors: [
        ...remaining.visitors,
        { id: first, color, glove: null, away: false },
      ],
      spectators: waiting,
    },
    deliveries: [
      ...left,
      ...send([first], { kind: "promoted", color }),
      ...send(everyoneBut(remaining, first), { kind: "visitorArrived", color }),
    ],
  };
}

function changeGlove(
  home: Home,
  id: ConnectionId,
  change: Pick<Visitor, "glove" | "away">,
): Stepped {
  const visitor = findVisitor(home, id);

  if (visitor === undefined || visitor.away) {
    return { home, deliveries: [] };
  }

  return {
    home: seat(home, { ...visitor, ...change }),
    deliveries: send(everyoneBut(home, id), {
      kind: "gloveMoved",
      color: visitor.color,
      at: change.glove,
    }),
  };
}

function comeBack(home: Home, id: ConnectionId): Stepped {
  const visitor = findVisitor(home, id);

  if (visitor === undefined) {
    return { home, deliveries: [] };
  }

  return { home: seat(home, { ...visitor, away: false }), deliveries: [] };
}

function strike(home: Home, id: ConnectionId, blow: Blow): Stepped {
  const visitor = findVisitor(home, id);

  if (visitor === undefined) {
    return { home, deliveries: [] };
  }

  return {
    home: { ...home, ball: strikeBall(home.ball, blow).motion },
    // 친 방문자는 자기 화면에서 이미 반응했습니다(ADR 0003).
    deliveries: send(everyoneBut(home, id), {
      kind: "struck",
      color: visitor.color,
      blow,
    }),
  };
}

function tick(home: Home, seconds: number): Stepped {
  const present = everyone(home);

  // 아무도 없는 홈의 레킹볼은 다음 사람이 올 때까지 처음 상태 그대로 둡니다.
  if (present.length === 0) {
    return { home, deliveries: [] };
  }

  const ball = advanceBall(home.ball, seconds).motion;

  return {
    home: { ...home, ball },
    deliveries: send(present, { kind: "ball", ball }),
  };
}

function findVisitor(home: Home, id: ConnectionId): Visitor | undefined {
  return home.visitors.find((visitor) => visitor.id === id);
}

function seat(home: Home, visitor: Visitor): Home {
  return {
    ...home,
    visitors: home.visitors.map((seated) =>
      seated.id === visitor.id ? visitor : seated,
    ),
  };
}

function everyone(home: Home): ConnectionId[] {
  return [...home.visitors.map((visitor) => visitor.id), ...home.spectators];
}

function everyoneBut(home: Home, id: ConnectionId): ConnectionId[] {
  return everyone(home).filter((present) => present !== id);
}

function send(to: readonly ConnectionId[], message: HomeMessage): Delivery[] {
  return to.map((id) => ({ to: id, message }));
}
