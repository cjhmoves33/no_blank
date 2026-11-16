import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import prettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const TS_FILES = ["**/*.{ts,tsx,mts,cts}"];

/**
 * 프레임워크 설정이 없는 패키지(server, shared)의 기본 규칙입니다.
 * web 은 eslint-config-next 가 이 역할을 합니다.
 */
export const base = defineConfig(
  { ignores: ["dist/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: TS_FILES,
    rules: {
      // `_` 로 시작하는 이름은 의도적으로 사용하지 않는 값으로 봅니다. (예: (_request, reply) => ...)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
);

/**
 * 읽기 좋은 코드를 위한 규칙입니다. 모든 패키지에서 다른 설정보다 뒤에 둡니다.
 * prettier 설정이 형식 규칙을 끈 뒤에 선언해야 curly 처럼 다시 켜는 규칙이 적용됩니다.
 */
export const readability = defineConfig(
  prettier,
  {
    plugins: {
      "@stylistic": stylistic,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      // 레이아웃: 블록 뒤, 선언 뒤, return 앞에 빈 줄
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },
        { blankLine: "always", prev: "block-like", next: "*" },
      ],
      curly: ["error", "all"],

      // 흐름 단순화
      "no-else-return": "error",
      "no-lonely-if": "error",
      "no-nested-ternary": "error",

      // 간결한 문법
      "object-shorthand": ["error", "always"],
      "prefer-template": "error",

      // import 정리
      "simple-import-sort/imports": "error",

      // 복잡도: 자동 수정이 안 되므로 경고로 안내합니다.
      "max-params": ["warn", 3],
      "max-depth": ["warn", 3],
      complexity: ["warn", 10],
    },
  },
  {
    files: TS_FILES,
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);

/**
 * React/JSX 규칙입니다. eslint-plugin-react 를 등록하는 설정(eslint-config-next 등) 뒤에 둡니다.
 */
export const react = defineConfig({
  files: ["**/*.{jsx,tsx}"],
  rules: {
    "react/self-closing-comp": ["error", { component: true, html: true }],
    "react/jsx-curly-brace-presence": [
      "error",
      { props: "never", children: "never", propElementValues: "always" },
    ],
  },
});
