import Fastify, { type FastifyServerOptions } from "fastify";

import { createDb, type Db } from "./db/client.js";
import { greetingRoutes } from "./routes/greeting.js";
import { healthRoutes } from "./routes/health.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}

export interface AppOptions {
  databaseUrl: string;
  logger?: FastifyServerOptions["logger"];
}

export async function buildApp({ databaseUrl, logger = false }: AppOptions) {
  const app = Fastify({ logger });

  const { db, pool } = createDb(databaseUrl);

  app.decorate("db", db);
  app.addHook("onClose", async () => {
    await pool.end();
  });

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(greetingRoutes, { prefix: "/api" });

  return app;
}
