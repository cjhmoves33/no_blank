import { describe, expect, it } from "vitest";

import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("HOST, PORT 가 없으면 기본값을 사용한다", () => {
    expect(parseEnv({})).toEqual({
      HOST: "localhost",
      PORT: 4000,
    });
  });

  it("빈 문자열은 값이 없는 것으로 본다", () => {
    expect(parseEnv({ HOST: "", PORT: "" })).toEqual({
      HOST: "localhost",
      PORT: 4000,
    });
  });

  it("HOST, PORT 를 읽는다", () => {
    expect(parseEnv({ HOST: "0.0.0.0", PORT: "8080" })).toEqual({
      HOST: "0.0.0.0",
      PORT: 8080,
    });
  });

  it.each(["abc", "0", "70000", "3.5"])("PORT=%s 는 거부한다", (PORT) => {
    expect(() => parseEnv({ PORT })).toThrow(
      /^PORT must be an integer between 1 and 65535/,
    );
  });
});
