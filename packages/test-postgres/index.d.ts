export interface TestPostgres {
  /** node-postgres 등 일반 PostgreSQL 클라이언트로 접속할 주소입니다. */
  connectionString: string;
  /** 서버와 DB 를 종료합니다. */
  stop(): Promise<void>;
}

/**
 * 테스트용 PostgreSQL(PGlite)을 프로세스 안에서 띄웁니다.
 * 호출할 때마다 비어 있는 새 DB 가 만들어지고, 임의의 로컬 포트로 TCP 접속을 받습니다.
 */
export function startTestPostgres(): Promise<TestPostgres>;
