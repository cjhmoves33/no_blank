import {
  base,
  react,
  reactRecommended,
  readability,
  typeChecked,
} from "@no-blank/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig(
  base,
  reactRecommended,
  typeChecked(import.meta.dirname),
  readability,
  react,
);
