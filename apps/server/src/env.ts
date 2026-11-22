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

  if (!URL.canParse(raw)) {
    throw new Error("DATABASE_URL must be a valid URL");
  }

  return raw;
}

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return {
    HOST: source.HOST || "localhost",
    PORT: parsePort(source.PORT),
    DATABASE_URL: parseDatabaseUrl(source.DATABASE_URL),
  };
}
