import { afterEach, describe, expect, it, vi } from "vitest";

import { getGreeting } from "./api";

function respondWith(response: Response): string[] {
  const requestedUrls: string[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>((input) => {
      requestedUrls.push(new Request(input).url);

      return Promise.resolve(response);
    }),
  );

  return requestedUrls;
}

describe("getGreeting", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("서버가 돌려준 인사말을 반환한다", async () => {
    const requestedUrls = respondWith(
      Response.json({ message: "Hello World" }),
    );

    await expect(getGreeting()).resolves.toEqual({ message: "Hello World" });
    expect(requestedUrls).toEqual([expect.stringMatching(/\/api\/greeting$/)]);
  });

  it("API_URL 로 지정한 서버에 요청한다", async () => {
    vi.stubEnv("API_URL", "http://api.internal:4000");
    vi.resetModules();
    const { getGreeting: getGreetingFromApiUrl } = await import("./api");
    const requestedUrls = respondWith(
      Response.json({ message: "Hello World" }),
    );

    await getGreetingFromApiUrl();

    expect(requestedUrls).toEqual(["http://api.internal:4000/api/greeting"]);
  });

  it("서버가 오류 상태로 응답하면 실패한다", async () => {
    respondWith(Response.json({ message: "Hello World" }, { status: 503 }));

    await expect(getGreeting()).rejects.toThrow();
  });

  it("응답이 API 계약과 다르면 실패한다", async () => {
    respondWith(Response.json({ greeting: "Hello World" }));

    await expect(getGreeting()).rejects.toThrow();
  });
});
