/**
 * 테스트 전용 패키지입니다. 앱 패키지의 devDependencies 로만 사용합니다.
 *
 * PGlite 를 이 패키지에 따로 두는 이유: drizzle-orm 은 PGlite 를 선택적 peer 의존성으로 선언합니다.
 * server 의 의존성에 PGlite 가 직접 들어가면, pnpm 이 운영 설치(pnpm deploy --prod)에도 PGlite 를 포함합니다.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

export async function startTestPostgres() {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({
    db,
    host: "127.0.0.1",
    // 비어 있는 포트를 자동으로 고릅니다. 테스트 파일을 병렬로 실행해도 충돌하지 않습니다.
    port: 0,
    // node-postgres 커넥션 풀이 여러 연결을 열 수 있게 합니다. 쿼리는 PGlite 안에서 순서대로 처리됩니다.
    maxConnections: 10,
  });

  await server.start();

  return {
    connectionString: `postgres://postgres:postgres@${server.getServerConn()}/postgres`,
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}
