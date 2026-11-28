import { advanceBall, restingBall, strikeBall } from "@no-blank/ball-motion";
import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { parseClientMessage, parseServerMessage } from "./home.js";

const GLOVE = { x: 0.2, y: 1.6, z: 0.5 };
const HIT = { x: 0, y: 0, z: 0.3 };
const FIST = { x: 0, y: 0, z: -1 };
const BALL = {
  swing: {
    fromPivot: { x: 0.1, y: -2.3, z: 0.05 },
    velocity: { x: 0.4, y: 0.01, z: -0.2 },
  },
  twist: { angle: 0.3, rate: -1.2 },
  lean: {
    aboutX: { angle: 0.02, rate: 0.1 },
    aboutZ: { angle: -0.01, rate: 0.5 },
  },
  hitStopLeft: 0.04,
  unsimulatedSeconds: 0.002,
};

describe("parseClientMessage", () => {
  it.each([
    [
      "gloveMoved",
      { kind: "gloveMoved", at: { ...GLOVE, w: 1 }, extra: 1 },
      { kind: "gloveMoved", at: GLOVE },
    ],
    ["wentAway", { kind: "wentAway", at: GLOVE }, { kind: "wentAway" }],
    ["cameBack", { kind: "cameBack", extra: 1 }, { kind: "cameBack" }],
    [
      "잽을 담은 struck",
      {
        kind: "struck",
        blow: { kind: "jab", hitFromCenter: HIT, fist: FIST, speed: 3 },
      },
      { kind: "struck", blow: { kind: "jab", hitFromCenter: HIT, fist: FIST } },
    ],
    [
      "휘두르기를 담은 struck",
      {
        kind: "struck",
        blow: { kind: "swipe", hitFromCenter: HIT, fist: FIST, speed: 2.5 },
        extra: 1,
      },
      {
        kind: "struck",
        blow: { kind: "swipe", hitFromCenter: HIT, fist: FIST, speed: 2.5 },
      },
    ],
  ])(
    "%s 메시지는 알 수 없는 필드를 버리고 읽는다",
    (_label, input, expected) => {
      expect(parseClientMessage(input)).toEqual(expected);
    },
  );

  it.each([
    ["null", null],
    ["문자열", "gloveMoved"],
    ["kind 가 없음", { at: GLOVE }],
    ["알 수 없는 kind", { kind: "teleported", at: GLOVE }],
    ["위치가 없는 글러브 움직임", { kind: "gloveMoved" }],
    ["위치가 null", { kind: "gloveMoved", at: null }],
    ["z 가 없는 위치", { kind: "gloveMoved", at: { x: 0, y: 0 } }],
    ["좌표가 문자열", { kind: "gloveMoved", at: { ...GLOVE, x: "0.2" } }],
    ["좌표가 NaN", { kind: "gloveMoved", at: { ...GLOVE, y: Number.NaN } }],
    [
      "JSON 에서 Infinity 가 된 좌표",
      JSON.parse(
        '{ "kind": "gloveMoved", "at": { "x": 1e400, "y": 0, "z": 0 } }',
      ),
    ],
    ["타격이 없는 struck", { kind: "struck" }],
    [
      "알 수 없는 타격",
      {
        kind: "struck",
        blow: { kind: "hook", hitFromCenter: HIT, fist: FIST },
      },
    ],
    [
      "주먹 방향이 없는 잽",
      { kind: "struck", blow: { kind: "jab", hitFromCenter: HIT } },
    ],
    [
      "맞은 자리가 유한하지 않은 잽",
      {
        kind: "struck",
        blow: {
          kind: "jab",
          hitFromCenter: { ...HIT, z: Number.POSITIVE_INFINITY },
          fist: FIST,
        },
      },
    ],
    [
      "빠르기가 없는 휘두르기",
      {
        kind: "struck",
        blow: { kind: "swipe", hitFromCenter: HIT, fist: FIST },
      },
    ],
    [
      "빠르기가 문자열인 휘두르기",
      {
        kind: "struck",
        blow: { kind: "swipe", hitFromCenter: HIT, fist: FIST, speed: "2" },
      },
    ],
  ])("%s 는 거부한다", (_label, input) => {
    expect(() => parseClientMessage(input)).toThrow("Invalid home message");
  });
});

describe("parseServerMessage", () => {
  it.each([
    [
      "방문자에게 보낸 welcome",
      {
        kind: "welcome",
        you: { as: "visitor", color: "blue", extra: 1 },
        visitors: [
          { color: "red", glove: { ...GLOVE, w: 1 }, away: false },
          { color: "yellow", glove: null },
        ],
        ball: {
          ...BALL,
          swing: { ...BALL.swing, extra: 1 },
          lean: { ...BALL.lean, aboutZ: { ...BALL.lean.aboutZ, extra: 1 } },
          extra: 1,
        },
        extra: 1,
      },
      {
        kind: "welcome",
        you: { as: "visitor", color: "blue" },
        visitors: [
          { color: "red", glove: GLOVE },
          { color: "yellow", glove: null },
        ],
        ball: BALL,
      },
    ],
    [
      "관중에게 보낸 welcome",
      {
        kind: "welcome",
        you: { as: "spectator", color: "green" },
        visitors: [],
        ball: BALL,
      },
      { kind: "welcome", you: { as: "spectator" }, visitors: [], ball: BALL },
    ],
    [
      "promoted",
      { kind: "promoted", color: "green", extra: 1 },
      { kind: "promoted", color: "green" },
    ],
    [
      "visitorArrived",
      { kind: "visitorArrived", color: "blue", at: GLOVE },
      { kind: "visitorArrived", color: "blue" },
    ],
    [
      "visitorLeft",
      { kind: "visitorLeft", color: "red", extra: 1 },
      { kind: "visitorLeft", color: "red" },
    ],
    [
      "위치가 있는 gloveMoved",
      { kind: "gloveMoved", color: "yellow", at: { ...GLOVE, w: 1 } },
      { kind: "gloveMoved", color: "yellow", at: GLOVE },
    ],
    [
      "위치가 null 인 gloveMoved",
      { kind: "gloveMoved", color: "green", at: null },
      { kind: "gloveMoved", color: "green", at: null },
    ],
    [
      "struck",
      {
        kind: "struck",
        color: "red",
        blow: { kind: "swipe", hitFromCenter: HIT, fist: FIST, speed: 2.5 },
        extra: 1,
      },
      {
        kind: "struck",
        color: "red",
        blow: { kind: "swipe", hitFromCenter: HIT, fist: FIST, speed: 2.5 },
      },
    ],
    [
      "ball",
      { kind: "ball", ball: { ...BALL, extra: 1 } },
      { kind: "ball", ball: BALL },
    ],
  ])(
    "%s 메시지는 알 수 없는 필드를 버리고 읽는다",
    (_label, input, expected) => {
      expect(parseServerMessage(input)).toEqual(expected);
    },
  );

  it.each([
    ["null", null],
    ["문자열", "ball"],
    ["kind 가 없음", { color: "red" }],
    ["알 수 없는 kind", { kind: "trophyAwarded", color: "red" }],
    ["방문자가 보내는 kind", { kind: "wentAway" }],
    ["알 수 없는 색", { kind: "visitorArrived", color: "purple" }],
    ["색이 없음", { kind: "promoted" }],
    [
      "레킹볼이 없는 welcome",
      { kind: "welcome", you: { as: "spectator" }, visitors: [] },
    ],
    [
      "방문자 목록이 배열이 아닌 welcome",
      { kind: "welcome", you: { as: "spectator" }, visitors: {}, ball: BALL },
    ],
    [
      "글러브가 빠진 방문자",
      {
        kind: "welcome",
        you: { as: "spectator" },
        visitors: [{ color: "red" }],
        ball: BALL,
      },
    ],
    [
      "알 수 없는 자리",
      { kind: "welcome", you: { as: "owner" }, visitors: [], ball: BALL },
    ],
    [
      "색이 없는 방문자 자리",
      { kind: "welcome", you: { as: "visitor" }, visitors: [], ball: BALL },
    ],
    ["위치가 빠진 gloveMoved", { kind: "gloveMoved", color: "red" }],
    [
      "알 수 없는 타격",
      {
        kind: "struck",
        color: "red",
        blow: { kind: "hook", hitFromCenter: HIT, fist: FIST },
      },
    ],
    ["레킹볼이 null", { kind: "ball", ball: null }],
    [
      "속도가 NaN 인 레킹볼",
      {
        kind: "ball",
        ball: {
          ...BALL,
          swing: { ...BALL.swing, velocity: { x: Number.NaN, y: 0, z: 0 } },
        },
      },
    ],
    [
      "JSON 에서 Infinity 가 된 비틀림",
      JSON.parse(
        JSON.stringify({ kind: "ball", ball: BALL }).replace(
          '"rate":-1.2',
          '"rate":1e400',
        ),
      ),
    ],
    [
      "aboutZ 가 빠진 기우뚱",
      {
        kind: "ball",
        ball: { ...BALL, lean: { aboutX: BALL.lean.aboutX } },
      },
    ],
    [
      "히트스톱이 문자열인 레킹볼",
      { kind: "ball", ball: { ...BALL, hitStopLeft: "0.04" } },
    ],
    [
      "남은 시간이 빠진 레킹볼",
      {
        kind: "ball",
        ball: {
          swing: BALL.swing,
          twist: BALL.twist,
          lean: BALL.lean,
          hitStopLeft: BALL.hitStopLeft,
        },
      },
    ],
  ])("%s 는 거부한다", (_label, input) => {
    expect(() => parseServerMessage(input)).toThrow("Invalid home message");
  });

  it("서버가 JSON 으로 보낸 움직이는 레킹볼을 되읽으면 같은 수가 나온다", () => {
    const jabbed = strikeBall(restingBall(), {
      kind: "jab",
      hitFromCenter: new Vector3(0.12, 0.05, 0.25),
      fist: new Vector3(-0.2, 0.1, -1).normalize(),
    }).motion;
    const swung = advanceBall(jabbed, 0.3).motion;
    const swiped = strikeBall(swung, {
      kind: "swipe",
      hitFromCenter: new Vector3(-0.2, -0.1, 0.18),
      fist: new Vector3(1, 0.3, -0.4).normalize(),
      speed: 2.5,
    }).motion;
    const ball = advanceBall(swiped, 0.01).motion;
    const received: unknown = JSON.parse(
      JSON.stringify({ kind: "ball", ball }),
    );

    expect(parseServerMessage(received)).toEqual({ kind: "ball", ball });
  });
});
