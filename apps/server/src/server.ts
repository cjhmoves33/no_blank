import { buildApp } from "./app.js";
import { parseEnv } from "./env.js";

const env = parseEnv(process.env);
const app = await buildApp({ logger: true });

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, "shutting down");

  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error({ err, signal }, "graceful shutdown failed");
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown(signal));
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (err) {
  app.log.error({ err }, "failed to start server");
  process.exit(1);
}
