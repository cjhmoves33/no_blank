import { describe, expect, it } from "vitest";

import { parseGreetingResponse } from "./api.js";

describe("parseGreetingResponse", () => {
  it("message 가 문자열이면 GreetingResponse 를 반환하고, 알 수 없는 필드는 버린다", () => {
    expect(parseGreetingResponse({ message: "Hello World", extra: 1 })).toEqual(
      { message: "Hello World" },
    );
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["문자열", "Hello World"],
    ["숫자", 1],
    ["빈 객체", {}],
    ["message 가 숫자", { message: 1 }],
    ["필드 이름이 다름", { msg: "Hello World" }],
  ])("%s 는 거부한다", (_label, input) => {
    expect(() => parseGreetingResponse(input)).toThrow(
      "Invalid GreetingResponse",
    );
  });
});
