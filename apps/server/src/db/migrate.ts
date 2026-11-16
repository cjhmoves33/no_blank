import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { pino } from "pino";

import { env } from "../env.js";
import { createDb } from "./client.js";

// Fastify 서버 로그와 같은 JSON 형식으로 남깁니다.
const log = pino({ name: "migrate" });

// src/db/migrate.ts 와 dist/db/migrate.js 모두에서 apps/server/drizzle 을 가리킵니다.
const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

const { db, pool } = createDb(env.DATABASE_URL);

try {
  await migrate(db, { migrationsFolder });
  log.info({ migrationsFolder }, "migrations applied");
} catch (err) {
  log.error({ err, migrationsFolder }, "migration failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
