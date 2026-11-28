/**
 * 홈의 WebSocket(/api/home)으로 주고받는 메시지입니다. 메시지는 JSON 이므로 three 의 Vector3 대신
 * Point 를 쓰고, 그 밖의 모양은 ball-motion 의 BallMotion, Blow 와 같습니다.
 */

/** x, y, z 세 축의 값입니다. 위치는 미터, 속도는 초당 미터입니다. */
export interface Point {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type Blow =
  | {
      readonly kind: "jab";
      readonly hitFromCenter: Point;
      readonly fist: Point;
    }
  | {
      readonly kind: "swipe";
      readonly hitFromCenter: Point;
      readonly fist: Point;
      readonly speed: number;
    };

interface Spring {
  readonly angle: number;
  readonly rate: number;
}

export interface BallMotion {
  readonly swing: { readonly fromPivot: Point; readonly velocity: Point };
  readonly twist: Spring;
  readonly lean: { readonly aboutX: Spring; readonly aboutZ: Spring };
  readonly hitStopLeft: number;
  readonly unsimulatedSeconds: number;
}

export type GloveColor = "red" | "blue" | "yellow" | "green";

/** 방문자가 서버로 보내는 메시지입니다. */
export type ClientMessage =
  | { readonly kind: "gloveMoved"; readonly at: Point }
  | { readonly kind: "wentAway" }
  | { readonly kind: "cameBack" }
  | { readonly kind: "struck"; readonly blow: Blow };

/** 서버가 연결 하나에 보내는 메시지입니다. */
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

function parseFinite(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  throw invalid("a finite number");
}

function invalid(expected: string): Error {
  return new Error(`Invalid ClientMessage: expected ${expected}`);
}
