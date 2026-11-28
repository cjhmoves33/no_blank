import { randomUUID } from "node:crypto";

import {
  type ClientMessage,
  parseClientMessage,
  type Point,
} from "@no-blank/shared";
import type { FastifyPluginAsync } from "fastify";
import { Vector3 } from "three";
import type { WebSocket } from "ws";

import {
  type ConnectionId,
  emptyHome,
  type HomeEvent,
  step,
} from "../home/home.js";

const TICK_MILLISECONDS = 100;

export const homeRoutes: FastifyPluginAsync = async (app) => {
  let home = emptyHome();
  const sockets = new Map<ConnectionId, WebSocket>();

  function apply(event: HomeEvent): void {
    const stepped = step(home, event);

    home = stepped.home;

    for (const { to, message } of stepped.deliveries) {
      sockets.get(to)?.send(JSON.stringify(message));
    }
  }

  let lastTick = performance.now();
  const ticker = setInterval(() => {
    const now = performance.now();

    apply({ kind: "ticked", seconds: (now - lastTick) / 1000 });
    lastTick = now;
  }, TICK_MILLISECONDS);

  app.addHook("onClose", async () => {
    clearInterval(ticker);
  });

  app.get("/home", { websocket: true }, (socket) => {
    const id = randomUUID();

    sockets.set(id, socket);
    apply({ kind: "arrived", id });

    socket.on("message", (data) => {
      // binaryType 이 기본값(nodebuffer)이므로 ws 는 메시지를 늘 Buffer 하나로 줍니다.
      const message = Buffer.isBuffer(data)
        ? readMessage(data.toString())
        : null;

      if (message === null) {
        socket.close(1008);

        return;
      }

      apply(eventOf(id, message));
    });

    socket.on("close", () => {
      sockets.delete(id);
      apply({ kind: "left", id });
    });
  });
};

function readMessage(text: string): ClientMessage | null {
  try {
    return parseClientMessage(JSON.parse(text));
  } catch {
    return null;
  }
}

function eventOf(id: ConnectionId, message: ClientMessage): HomeEvent {
  if (message.kind !== "struck") {
    return { ...message, id };
  }

  const { blow } = message;

  return {
    kind: "struck",
    id,
    blow: {
      ...blow,
      hitFromCenter: toVector3(blow.hitFromCenter),
      fist: toVector3(blow.fist),
    },
  };
}

function toVector3({ x, y, z }: Point): Vector3 {
  return new Vector3(x, y, z);
}
