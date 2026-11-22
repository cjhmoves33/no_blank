import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDb, migrationsFolder } from "../db/client.js";

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
