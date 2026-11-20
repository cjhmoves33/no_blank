import { base, readability, typeChecked } from "@no-blank/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  globalIgnores(["drizzle/**"]),
  base,
  typeChecked(import.meta.dirname),
  readability,
);
