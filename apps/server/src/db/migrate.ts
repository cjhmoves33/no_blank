import { migrate } from "drizzle-orm/node-postgres/migrator";
import { pino } from "pino";

import { parseEnv } from "../env.js";
import { createDb, migrationsFolder } from "./client.js";

const log = pino({ name: "migrate" });

const env = parseEnv(process.env);
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
