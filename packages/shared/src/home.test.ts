import { describe, expect, it } from "vitest";

import { parseClientMessage } from "./home.js";

const GLOVE = { x: 0.2, y: 1.6, z: 0.5 };
const HIT = { x: 0, y: 0, z: 0.3 };
const FIST = { x: 0, y: 0, z: -1 };

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
    expect(() => parseClientMessage(input)).toThrow("Invalid ClientMessage");
  });
});
