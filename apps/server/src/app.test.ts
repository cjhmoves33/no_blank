import { once } from "node:events";

import { restingBall } from "@no-blank/ball-motion";
import type { HealthResponse } from "@no-blank/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";

describe("API", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /api/health 는 200 과 status: ok 를 반환한다", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: "ok",
    } satisfies HealthResponse);
  });

  it("정의되지 않은 경로는 404 를 반환한다", async () => {
    const res = await app.inject({ method: "GET", url: "/api/unknown" });

    expect(res.statusCode).toBe(404);
  });

  describe("GET /api/home WebSocket", () => {
    const GLOVE = { x: 0.2, y: 1.6, z: 0.5 };
    const JAB = {
      kind: "jab",
      hitFromCenter: { x: 0, y: 0, z: 0.3 },
      fist: { x: 0, y: 0, z: -1 },
    };

    let origin: string;

    beforeEach(async () => {
      // @fastify/websocket 의 injectWS 는 메모리 안의 스트림으로 연결해서, 닫기 핸드셰이크가 끝나도
      // 서버의 close 이벤트가 ws 의 닫기 제한 시간(30초)이 지나야 옵니다. 그래서 실제 포트로 연결합니다.
      origin = await app.listen({ host: "127.0.0.1", port: 0 });
    });

    async function connect() {
      const url = new URL("/api/home", origin);

      url.protocol = "ws:";

      const socket = new WebSocket(url);
      const inbox: unknown[] = [];
      const closes: number[] = [];

      socket.addEventListener("message", (event) => {
        inbox.push(JSON.parse(String(event.data)));
      });
      socket.addEventListener("close", (event) => {
        closes.push(event.code);
      });
      await once(socket, "open");
      await vi.waitFor(() => {
        expect(inbox).toContainEqual(
          expect.objectContaining({ kind: "welcome" }),
        );
      });

      return { socket, inbox, closes };
    }

    function colorOf({ inbox }: Awaited<ReturnType<typeof connect>>) {
      const [welcome] = inbox;

      if (
        typeof welcome === "object" &&
        welcome !== null &&
        "you" in welcome &&
        typeof welcome.you === "object" &&
        welcome.you !== null &&
        "color" in welcome.you
      ) {
        return welcome.you.color;
      }

      throw new Error(`방문자 welcome 이 아닙니다: ${JSON.stringify(welcome)}`);
    }

    it("들어온 두 사람은 서로 다른 색의 방문자가 되고, 먼저 온 사람은 새 방문자의 색을 듣는다", async () => {
      const first = await connect();
      const second = await connect();

      expect(colorOf(first)).toEqual(expect.any(String));
      expect(colorOf(second)).toEqual(expect.any(String));
      expect(colorOf(second)).not.toBe(colorOf(first));
      await vi.waitFor(() => {
        expect(first.inbox).toContainEqual({
          kind: "visitorArrived",
          color: colorOf(second),
        });
      });
    });

    it("한 방문자의 타격은 다른 방문자에게 그 방문자의 색과 함께 전해진다", async () => {
      const first = await connect();
      const second = await connect();

      first.socket.send(JSON.stringify({ kind: "struck", blow: JAB }));

      await vi.waitFor(() => {
        expect(second.inbox).toContainEqual({
          kind: "struck",
          color: colorOf(first),
          blow: JAB,
        });
      });
    });

    it("한 방문자의 글러브 움직임은 다른 방문자에게 전해진다", async () => {
      const first = await connect();
      const second = await connect();

      first.socket.send(JSON.stringify({ kind: "gloveMoved", at: GLOVE }));

      await vi.waitFor(() => {
        expect(second.inbox).toContainEqual({
          kind: "gloveMoved",
          color: colorOf(first),
          at: GLOVE,
        });
      });
    });

    it.each([
      ["JSON 이 아닌 메시지", "glove"],
      ["모양이 맞지 않는 메시지", JSON.stringify({ kind: "struck" })],
    ])(
      "%s 를 보낸 연결은 1008 로 끊기고, 남은 방문자는 그 방문자가 나갔다고 듣는다",
      async (_label, text) => {
        const first = await connect();
        const second = await connect();

        first.socket.send(text);

        await vi.waitFor(() => {
          expect(first.closes).toEqual([1008]);
          expect(second.inbox).toContainEqual({
            kind: "visitorLeft",
            color: colorOf(first),
          });
        });
      },
    );

    it("1 KiB 를 넘는 메시지를 보낸 연결은 끊기고, 남은 방문자는 그 방문자가 나갔다고 듣는다", async () => {
      const first = await connect();
      const second = await connect();

      first.socket.send(
        JSON.stringify({
          kind: "gloveMoved",
          at: GLOVE,
          note: "x".repeat(1024),
        }),
      );

      await vi.waitFor(() => {
        expect(first.closes).toHaveLength(1);
        expect(second.inbox).toContainEqual({
          kind: "visitorLeft",
          color: colorOf(first),
        });
      });
    });

    it("연결을 닫은 방문자는 나간 것이고, 남은 방문자는 그 색을 듣는다", async () => {
      const first = await connect();
      const second = await connect();

      second.socket.close();

      await vi.waitFor(() => {
        expect(first.inbox).toContainEqual({
          kind: "visitorLeft",
          color: colorOf(second),
        });
      });
    });

    it("친 뒤 몇 틱 안에 모두가 제자리를 떠난 레킹볼을 받는다", async () => {
      const first = await connect();
      const second = await connect();
      const restingPlace = { ...restingBall().swing.fromPivot };

      first.socket.send(JSON.stringify({ kind: "struck", blow: JAB }));

      for (const { inbox } of [first, second]) {
        await vi.waitFor(() => {
          const latest = inbox.at(-1);

          expect(latest).toHaveProperty("kind", "ball");
          expect(latest).not.toHaveProperty(
            "ball.swing.fromPivot",
            restingPlace,
          );
        });
      }
    });
  });
});
