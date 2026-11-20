import { react, readability, typeChecked } from "@no-blank/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  typeChecked(import.meta.dirname),
  // 공용 규칙은 Next.js 설정 뒤에 둡니다. (readability 안에서 Prettier 와 충돌하는 규칙도 꺼집니다)
  readability,
  react,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
