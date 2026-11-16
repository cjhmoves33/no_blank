import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import pg from "pg";

import * as schema from "./schema.js";

/**
 * 라우트가 사용하는 DB 타입입니다. 드라이버(운영: node-postgres, 테스트: PGlite)와 관계없이 같은 API 를 씁니다.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** src/db 와 dist/db 모두에서 apps/server/drizzle 을 가리킵니다. */
export const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle({ client: pool, schema });

  return { db, pool };
}
