import { describe, expect, it } from "vitest";

import { parseEnv } from "./env.js";

const DATABASE_URL = "postgres://user:secret@localhost:5432/db";

describe("parseEnv", () => {
  it("HOST, PORT 가 없으면 기본값을 사용한다", () => {
    expect(parseEnv({ DATABASE_URL })).toEqual({
      HOST: "localhost",
      PORT: 4000,
      DATABASE_URL,
    });
  });

  it("빈 문자열은 값이 없는 것으로 본다", () => {
    expect(parseEnv({ DATABASE_URL, HOST: "", PORT: "" })).toMatchObject({
      HOST: "localhost",
      PORT: 4000,
    });
  });

  it("HOST, PORT 를 읽는다", () => {
    expect(
      parseEnv({ DATABASE_URL, HOST: "0.0.0.0", PORT: "8080" }),
    ).toMatchObject({ HOST: "0.0.0.0", PORT: 8080 });
  });

  it.each(["abc", "0", "70000", "3.5"])("PORT=%s 는 거부한다", (PORT) => {
    expect(() => parseEnv({ DATABASE_URL, PORT })).toThrow(
      /^PORT must be an integer between 1 and 65535/,
    );
  });

  it("DATABASE_URL 이 없으면 거부한다", () => {
    expect(() => parseEnv({})).toThrow(
      "Missing required environment variable: DATABASE_URL",
    );
  });

  it("잘못된 DATABASE_URL 은 거부하고, 오류 메시지에 값을 노출하지 않는다", () => {
    expect(() => parseEnv({ DATABASE_URL: "secret123 is not a url" })).toThrow(
      /^DATABASE_URL must be a valid URL$/,
    );
  });
});
