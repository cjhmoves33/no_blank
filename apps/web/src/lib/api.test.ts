import { afterEach, describe, expect, it, vi } from "vitest";

import { getGreeting } from "./api";

function respondWith(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("getGreeting", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("서버가 돌려준 인사말을 반환한다", async () => {
    const fetchMock = respondWith(Response.json({ message: "Hello World" }));

    await expect(getGreeting()).resolves.toEqual({ message: "Hello World" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/greeting$/),
    );
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
