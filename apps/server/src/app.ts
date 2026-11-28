import websocket from "@fastify/websocket";
import Fastify, { type FastifyServerOptions } from "fastify";

import { healthRoutes } from "./routes/health.js";
import { homeRoutes } from "./routes/home.js";

const MAX_MESSAGE_BYTES = 1024;

export interface AppOptions {
  logger?: FastifyServerOptions["logger"];
}

export async function buildApp({ logger = false }: AppOptions = {}) {
  const app = Fastify({ logger });

  await app.register(websocket, { options: { maxPayload: MAX_MESSAGE_BYTES } });
  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(homeRoutes, { prefix: "/api" });

  return app;
}
