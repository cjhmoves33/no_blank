import { base, readability } from "@no-blank/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(globalIgnores(["drizzle/**"]), base, readability);
