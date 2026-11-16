import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { migrationsFolder } from "../db/client.js";
import * as schema from "../db/schema.js";

/**
 * 테스트용 인메모리 PostgreSQL(PGlite)을 만듭니다.
 * 운영과 같은 마이그레이션(seed 포함)을 적용하므로, 모킹 없이 실제 SQL 로 라우트를 검증할 수 있습니다.
 */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle({ client, schema });

  await migrate(db, { migrationsFolder });

  return { db, close: () => client.close() };
}
