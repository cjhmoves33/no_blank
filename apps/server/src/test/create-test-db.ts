import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDb, migrationsFolder } from "../db/client.js";

/**
 * 테스트용 DB 를 만듭니다.
 * 프로세스 안에서 띄운 PostgreSQL(PGlite)에 운영과 같은 드라이버(node-postgres)로 접속하고,
 * 운영과 같은 마이그레이션(seed 포함)을 적용합니다. 그래서 모킹 없이 실제 SQL 로 라우트를 검증합니다.
 */
export async function createTestDb() {
  const pglite = await PGlite.create();
  const socket = new PGLiteSocketServer({
    db: pglite,
    host: "127.0.0.1",
    port: 0,
    // 기본값(1)이면 node-postgres 커넥션 풀이 여는 두 번째 연결부터 거부됩니다.
    maxConnections: 10,
  });

  await socket.start();

  const { db, pool } = createDb(
    `postgres://postgres:postgres@${socket.getServerConn()}/postgres`,
  );

  await migrate(db, { migrationsFolder });

  return {
    db,
    async close() {
      await pool.end();
      await socket.stop();
      await pglite.close();
    },
  };
}
