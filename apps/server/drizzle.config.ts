import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

// `drizzle-kit studio` 등 DB 접속이 필요한 명령을 위해 .env 를 읽습니다. (generate 는 DB 접속 없이 동작)
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
