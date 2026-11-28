export interface Env {
  HOST: string;
  PORT: number;
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

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return {
    HOST: source.HOST || "localhost",
    PORT: parsePort(source.PORT),
  };
}
