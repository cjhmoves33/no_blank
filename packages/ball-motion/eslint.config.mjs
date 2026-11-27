import { base, readability, typeChecked } from "@no-blank/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig(
  base,
  typeChecked(import.meta.dirname),
  readability,
);
