export interface Env {
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
}

const DEFAULT_PORT = 4000;

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === "") {
    return DEFAULT_PORT;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `PORT must be an integer between 1 and 65535, got "${raw}"`,
    );
  }

  return port;
}

function parseDatabaseUrl(raw: string | undefined): string {
  if (!raw) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  // 비밀번호가 포함되어 있으므로 오류 메시지에 값을 넣지 않습니다.
  if (!URL.canParse(raw)) {
    throw new Error("DATABASE_URL must be a valid URL");
  }

  return raw;
}

/**
 * 환경 변수(외부 입력)를 검증해서 Env 로 변환합니다. 이후 코드는 Env 를 그대로 신뢰합니다.
 * 실행 진입점(server.ts, db/migrate.ts)에서 process.env 를 넘겨 호출합니다.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return {
    HOST: source.HOST || "localhost",
    PORT: parsePort(source.PORT),
    DATABASE_URL: parseDatabaseUrl(source.DATABASE_URL),
  };
}
