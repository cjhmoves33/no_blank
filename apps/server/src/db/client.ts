import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema.js";

/** src/db 와 dist/db 모두에서 apps/server/drizzle 을 가리킵니다. */
export const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle({ client: pool, schema });

  return { db, pool };
}

export type Db = ReturnType<typeof createDb>["db"];
