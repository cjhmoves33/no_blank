import { startTestPostgres } from "@no-blank/test-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDb, migrationsFolder } from "../db/client.js";

/**
 * 테스트용 DB 를 만듭니다.
 * 프로세스 안에서 띄운 PostgreSQL(PGlite)에 운영과 같은 드라이버(node-postgres)로 접속하고,
 * 운영과 같은 마이그레이션(seed 포함)을 적용합니다. 그래서 모킹 없이 실제 SQL 로 라우트를 검증합니다.
 */
export async function createTestDb() {
  const postgres = await startTestPostgres();
  const { db, pool } = createDb(postgres.connectionString);

  await migrate(db, { migrationsFolder });

  return {
    db,
    async close() {
      await pool.end();
      await postgres.stop();
    },
  };
}
