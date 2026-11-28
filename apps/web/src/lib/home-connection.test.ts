import type { ServerMessage } from "@no-blank/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectToHome } from "./home-connection";

let sockets: FakeWebSocket[] = [];
let server: "up" | "down" = "up";

class FakeWebSocket extends EventTarget {
  readonly url: string;
  readonly createdAt = Date.now();
  closedByPage = false;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    sockets.push(this);

    if (server === "down") {
      queueMicrotask(() => {
        hangUp(this);
      });
    }
  }

  close(): void {
    this.closedByPage = true;
    queueMicrotask(() => {
      hangUp(this, 1005);
    });
  }
}

function accept(socket: FakeWebSocket): void {
  const event = new Event("open");

  socket.dispatchEvent(event);
  socket.onopen?.(event);
}

function send(socket: FakeWebSocket, data: unknown): void {
  const event = new MessageEvent("message", { data });

  socket.dispatchEvent(event);
  socket.onmessage?.(event);
}

function hangUp(socket: FakeWebSocket, code = 1006): void {
  const event = new CloseEvent("close", { code });

  socket.dispatchEvent(event);
  socket.onclose?.(event);
}

function latestSocket(): FakeWebSocket {
  const socket = sockets.at(-1);

  if (socket === undefined) {
    throw new Error("페이지가 아직 연결하지 않았습니다");
  }

  return socket;
}

function attemptedAt(start: number): number[] {
  return sockets.map((socket) => (socket.createdAt - start) / 1000);
}

async function importWithApiUrl(apiUrl: string | undefined) {
  vi.stubEnv("NEXT_PUBLIC_API_URL", apiUrl);
  vi.resetModules();

  return import("./home-connection");
}

function ignore(): void {}

describe("connectToHome", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    sockets = [];
    server = "up";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("NEXT_PUBLIC_API_URL 이 없으면 ws://localhost:4000/api/home 에 연결한다", async () => {
    const connection = await importWithApiUrl(undefined);

    connection.connectToHome(ignore);

    expect(sockets.map((socket) => socket.url)).toEqual([
      "ws://localhost:4000/api/home",
    ]);
  });

  it("NEXT_PUBLIC_API_URL 이 https 주소면 그 서버의 /api/home 에 wss 로 연결한다", async () => {
    const connection = await importWithApiUrl("https://no-blank.example.com");

    connection.connectToHome(ignore);

    expect(sockets.map((socket) => socket.url)).toEqual([
      "wss://no-blank.example.com/api/home",
    ]);
  });

  it.each(["ftp://files.example.com", "localhost:4000", "서버 주소"])(
    "NEXT_PUBLIC_API_URL 이 %s 이면 거부한다",
    async (apiUrl) => {
      await expect(importWithApiUrl(apiUrl)).rejects.toThrow(
        "NEXT_PUBLIC_API_URL",
      );
    },
  );

  it("서버가 보낸 홈 메시지를 읽어 건넨다", () => {
    const received: ServerMessage[] = [];

    connectToHome((message) => received.push(message));
    accept(latestSocket());
    send(
      latestSocket(),
      JSON.stringify({ kind: "visitorArrived", color: "blue", extra: 1 }),
    );

    expect(received).toEqual([{ kind: "visitorArrived", color: "blue" }]);
  });

  it("읽지 못한 메시지는 건네지 않고 연결을 이어 간다", async () => {
    const received: ServerMessage[] = [];

    connectToHome((message) => received.push(message));
    const socket = latestSocket();

    accept(socket);
    send(socket, "{ not json");
    send(socket, new ArrayBuffer(8));
    send(socket, JSON.stringify({ kind: "trophyAwarded", color: "red" }));
    send(socket, JSON.stringify({ kind: "visitorLeft", color: "red" }));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(received).toEqual([{ kind: "visitorLeft", color: "red" }]);
    expect(socket.closedByPage).toBe(false);
    expect(sockets).toHaveLength(1);
  });

  it("서버에 닿지 않으면 1, 2, 4, 8, 10, 10초를 기다리며 다시 시도한다", async () => {
    server = "down";
    const start = Date.now();

    connectToHome(ignore);
    await vi.advanceTimersByTimeAsync(36_000);

    expect(attemptedAt(start)).toEqual([0, 1, 3, 7, 15, 25, 35]);
  });

  it("열렸던 연결이 끊기면 다시 1초 뒤에 시도한다", async () => {
    server = "down";
    const start = Date.now();

    connectToHome(ignore);
    await vi.advanceTimersByTimeAsync(14_000);
    server = "up";
    await vi.advanceTimersByTimeAsync(1_000);
    accept(latestSocket());
    hangUp(latestSocket());
    await vi.advanceTimersByTimeAsync(1_000);

    expect(attemptedAt(start)).toEqual([0, 1, 3, 7, 15, 16]);
  });

  it("활동 없이 5분이 지나면 시도를 멈추고, 활동이 생기면 바로 다시 시도한다", async () => {
    server = "down";
    const start = Date.now();
    const connection = connectToHome(ignore);

    await vi.advanceTimersByTimeAsync(10 * 60_000);

    expect(attemptedAt(start).at(-1)).toBe(295);

    connection.noticeActivity();

    expect(attemptedAt(start).at(-1)).toBe(600);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(attemptedAt(start).at(-1)).toBe(601);
  });

  it("4분쯤 활동이 있었다면 5분이 지난 뒤에도 계속 시도한다", async () => {
    server = "down";
    const start = Date.now();
    const connection = connectToHome(ignore);

    await vi.advanceTimersByTimeAsync(4 * 60_000);
    connection.noticeActivity();
    await vi.advanceTimersByTimeAsync(2 * 60_000);

    expect(attemptedAt(start).filter((seconds) => seconds > 300)).toEqual([
      305, 315, 325, 335, 345, 355,
    ]);
  });

  it("다시 시도를 기다리는 동안의 활동은 기다림을 건너뛰지 않는다", async () => {
    server = "down";
    const start = Date.now();
    const connection = connectToHome(ignore);

    await vi.advanceTimersByTimeAsync(500);
    connection.noticeActivity();
    await vi.advanceTimersByTimeAsync(500);

    expect(attemptedAt(start)).toEqual([0, 1]);
  });

  it("백그라운드 탭에서 타이머가 늦게 불려도 실제로 흐른 시간으로 5분을 잰다", async () => {
    server = "down";
    const connection = connectToHome(ignore);

    await vi.advanceTimersByTimeAsync(500);
    vi.setSystemTime(Date.now() + 6 * 60_000);
    await vi.advanceTimersByTimeAsync(500);

    expect(sockets).toHaveLength(1);

    connection.noticeActivity();

    expect(sockets).toHaveLength(2);
  });

  it("서버가 1008 로 끊으면 활동이 있어도 다시 연결하지 않는다", async () => {
    const connection = connectToHome(ignore);

    accept(latestSocket());
    hangUp(latestSocket(), 1008);
    await vi.advanceTimersByTimeAsync(60_000);
    connection.noticeActivity();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sockets).toHaveLength(1);
  });

  it("close() 하면 소켓을 닫고 다시 연결하지 않는다", async () => {
    const connection = connectToHome(ignore);
    const socket = latestSocket();

    accept(socket);
    connection.close();
    await vi.advanceTimersByTimeAsync(60_000);
    connection.noticeActivity();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(socket.closedByPage).toBe(true);
    expect(sockets).toHaveLength(1);
  });

  it("다시 시도를 기다리는 중에 close() 하면 더 시도하지 않는다", async () => {
    server = "down";
    const connection = connectToHome(ignore);

    await vi.advanceTimersByTimeAsync(500);
    connection.close();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sockets).toHaveLength(1);
  });
});
