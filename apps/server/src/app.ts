import websocket from "@fastify/websocket";
import Fastify, { type FastifyServerOptions } from "fastify";

import type { Db } from "./db/client.js";
import { greetingRoutes } from "./routes/greeting.js";
import { healthRoutes } from "./routes/health.js";
import { homeRoutes } from "./routes/home.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}

const MAX_MESSAGE_BYTES = 1024;

export interface AppOptions {
  /** DB 연결은 호출하는 쪽이 만들고 닫습니다. */
  db: Db;
  logger?: FastifyServerOptions["logger"];
}

export async function buildApp({ db, logger = false }: AppOptions) {
  const app = Fastify({ logger });

  app.decorate("db", db);

  await app.register(websocket, { options: { maxPayload: MAX_MESSAGE_BYTES } });
  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(greetingRoutes, { prefix: "/api" });
  await app.register(homeRoutes, { prefix: "/api" });

  return app;
}
