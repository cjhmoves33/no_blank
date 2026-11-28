import type {
  BallMotion as SimulatedBall,
  Blow as SimulatedBlow,
} from "@no-blank/ball-motion";
import type { Vector3 } from "three";

/** x, y, z 세 축의 값입니다. 위치는 미터, 속도는 초당 미터입니다. */
export interface Point {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

type OnWire<T> = T extends Vector3
  ? Point
  : T extends object
    ? { readonly [K in keyof T]: OnWire<T[K]> }
    : T;

export type Blow = OnWire<SimulatedBlow>;

export type BallMotion = OnWire<SimulatedBall>;

export type GloveColor = "red" | "blue" | "yellow" | "green";

export type ClientMessage =
  | { readonly kind: "gloveMoved"; readonly at: Point }
  | { readonly kind: "wentAway" }
  | { readonly kind: "cameBack" }
  | { readonly kind: "struck"; readonly blow: Blow };

export type ServerMessage =
  | {
      readonly kind: "welcome";
      readonly you:
        | { readonly as: "visitor"; readonly color: GloveColor }
        | { readonly as: "spectator" };
      readonly visitors: readonly {
        readonly color: GloveColor;
        /** 아직 움직이지 않았거나 다른 탭에 가 있으면 null 입니다. */
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
      /** 그 방문자가 다른 탭으로 가면 null 입니다. */
      readonly at: Point | null;
    }
  | {
      readonly kind: "struck";
      readonly color: GloveColor;
      readonly blow: Blow;
    }
  | { readonly kind: "ball"; readonly ball: BallMotion };

/** 네트워크로 받은 값을 ClientMessage 로 검증합니다. 수는 유한해야 하고, 알 수 없는 필드는 버립니다. */
export function parseClientMessage(input: unknown): ClientMessage {
  if (typeof input === "object" && input !== null && "kind" in input) {
    switch (input.kind) {
      case "wentAway":
        return { kind: "wentAway" };
      case "cameBack":
        return { kind: "cameBack" };
      case "gloveMoved":
        if ("at" in input) {
          return { kind: "gloveMoved", at: parsePoint(input.at) };
        }

        break;
      case "struck":
        if ("blow" in input) {
          return { kind: "struck", blow: parseBlow(input.blow) };
        }

        break;
    }
  }

  throw invalid("a ClientMessage");
}

type Welcome = Extract<ServerMessage, { kind: "welcome" }>;

/** 서버가 보낸 값을 ServerMessage 로 검증합니다. 수는 유한해야 하고, 알 수 없는 필드는 버립니다. */
export function parseServerMessage(input: unknown): ServerMessage {
  const kind = kindOf(input);

  switch (kind) {
    case "welcome":
      return parseWelcome(input);
    case "promoted":
    case "visitorArrived":
    case "visitorLeft":
      return { kind, color: parseColorOf(input) };
    case "gloveMoved":
      return parseGloveMoved(input);
    case "struck":
      return parseStruck(input);
    case "ball":
      return parseBallMessage(input);
  }

  throw invalid("a ServerMessage");
}

function kindOf(input: unknown): unknown {
  return typeof input === "object" && input !== null && "kind" in input
    ? input.kind
    : undefined;
}

function parseWelcome(input: unknown): Welcome {
  if (
    typeof input === "object" &&
    input !== null &&
    "you" in input &&
    "visitors" in input &&
    Array.isArray(input.visitors) &&
    "ball" in input
  ) {
    return {
      kind: "welcome",
      you: parseYou(input.you),
      visitors: input.visitors.map(parseVisitor),
      ball: parseBall(input.ball),
    };
  }

  throw invalid("a welcome");
}

function parseYou(input: unknown): Welcome["you"] {
  if (typeof input === "object" && input !== null && "as" in input) {
    if (input.as === "spectator") {
      return { as: "spectator" };
    }

    if (input.as === "visitor") {
      return { as: "visitor", color: parseColorOf(input) };
    }
  }

  throw invalid("a visitor or a spectator");
}

function parseVisitor(input: unknown): Welcome["visitors"][number] {
  if (typeof input === "object" && input !== null && "glove" in input) {
    return { color: parseColorOf(input), glove: parsePointOrNull(input.glove) };
  }

  throw invalid("{ color, glove }");
}

function parseGloveMoved(input: unknown): ServerMessage {
  if (typeof input === "object" && input !== null && "at" in input) {
    return {
      kind: "gloveMoved",
      color: parseColorOf(input),
      at: parsePointOrNull(input.at),
    };
  }

  throw invalid("a gloveMoved");
}

function parseStruck(input: unknown): ServerMessage {
  if (typeof input === "object" && input !== null && "blow" in input) {
    return {
      kind: "struck",
      color: parseColorOf(input),
      blow: parseBlow(input.blow),
    };
  }

  throw invalid("a struck");
}

function parseBallMessage(input: unknown): ServerMessage {
  if (typeof input === "object" && input !== null && "ball" in input) {
    return { kind: "ball", ball: parseBall(input.ball) };
  }

  throw invalid("a ball");
}

function parseColorOf(input: unknown): GloveColor {
  if (typeof input === "object" && input !== null && "color" in input) {
    switch (input.color) {
      case "red":
      case "blue":
      case "yellow":
      case "green":
        return input.color;
    }
  }

  throw invalid("a glove color");
}

function parseBall(input: unknown): BallMotion {
  if (
    typeof input === "object" &&
    input !== null &&
    "swing" in input &&
    "twist" in input &&
    "lean" in input &&
    "hitStopLeft" in input &&
    "unsimulatedSeconds" in input
  ) {
    return {
      swing: parseSwing(input.swing),
      twist: parseSpring(input.twist),
      lean: parseLean(input.lean),
      hitStopLeft: parseFinite(input.hitStopLeft),
      unsimulatedSeconds: parseFinite(input.unsimulatedSeconds),
    };
  }

  throw invalid("a BallMotion");
}

function parseSwing(input: unknown): BallMotion["swing"] {
  if (
    typeof input === "object" &&
    input !== null &&
    "fromPivot" in input &&
    "velocity" in input
  ) {
    return {
      fromPivot: parsePoint(input.fromPivot),
      velocity: parsePoint(input.velocity),
    };
  }

  throw invalid("{ fromPivot, velocity }");
}

function parseLean(input: unknown): BallMotion["lean"] {
  if (
    typeof input === "object" &&
    input !== null &&
    "aboutX" in input &&
    "aboutZ" in input
  ) {
    return {
      aboutX: parseSpring(input.aboutX),
      aboutZ: parseSpring(input.aboutZ),
    };
  }

  throw invalid("{ aboutX, aboutZ }");
}

function parseSpring(input: unknown): BallMotion["twist"] {
  if (
    typeof input === "object" &&
    input !== null &&
    "angle" in input &&
    "rate" in input
  ) {
    return { angle: parseFinite(input.angle), rate: parseFinite(input.rate) };
  }

  throw invalid("{ angle, rate }");
}

function parseBlow(input: unknown): Blow {
  if (
    typeof input === "object" &&
    input !== null &&
    "kind" in input &&
    "hitFromCenter" in input &&
    "fist" in input
  ) {
    const hitFromCenter = parsePoint(input.hitFromCenter);
    const fist = parsePoint(input.fist);

    if (input.kind === "jab") {
      return { kind: "jab", hitFromCenter, fist };
    }

    if (input.kind === "swipe" && "speed" in input) {
      return {
        kind: "swipe",
        hitFromCenter,
        fist,
        speed: parseFinite(input.speed),
      };
    }
  }

  throw invalid("a jab or a swipe");
}

function parsePoint(input: unknown): Point {
  if (
    typeof input === "object" &&
    input !== null &&
    "x" in input &&
    "y" in input &&
    "z" in input
  ) {
    return {
      x: parseFinite(input.x),
      y: parseFinite(input.y),
      z: parseFinite(input.z),
    };
  }

  throw invalid("{ x, y, z }");
}

function parsePointOrNull(input: unknown): Point | null {
  return input === null ? null : parsePoint(input);
}

function parseFinite(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  throw invalid("a finite number");
}

function invalid(expected: string): Error {
  return new Error(`Invalid home message: expected ${expected}`);
}
