import path from "node:path";

import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import prettier from "eslint-config-prettier/flat";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const TS_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];
const TS_FILES = [`**/*{${TS_EXTENSIONS.join(",")}}`];

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
 * 타입 안전성과 모듈 구조 규칙입니다. 모든 패키지에서 사용하며, 패키지 디렉터리(import.meta.dirname)를 넘깁니다.
 * 타입 정보와 import 경로는 그 디렉터리의 tsconfig 로 해석합니다.
 */
export function typeChecked(tsconfigRootDir) {
  return defineConfig({
    files: TS_FILES,
    extends: [tseslint.configs.recommendedTypeChecked],
    plugins: { "import-x": importX },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir },
    },
    settings: {
      "import-x/extensions": [...TS_EXTENSIONS, ".js", ".jsx", ".mjs", ".cjs"],
      "import-x/parsers": { "@typescript-eslint/parser": TS_EXTENSIONS },
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          project: path.join(tsconfigRootDir, "tsconfig.json"),
        }),
      ],
    },
    rules: {
      "import-x/no-cycle": "error",
      "import-x/no-relative-packages": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
      // Fastify 플러그인처럼 Promise 를 돌려줘야 하는 함수는 await 가 없어도 async 로 씁니다.
      // 빠뜨린 await 는 no-floating-promises 가 잡습니다.
      "@typescript-eslint/require-await": "off",
    },
  });
}

/**
 * 읽기 좋은 코드를 위한 규칙입니다. 모든 패키지에서 다른 설정보다 뒤에 둡니다.
 * prettier 설정이 형식 규칙을 끈 뒤에 선언해야 curly 처럼 다시 켜는 규칙이 적용됩니다.
 */
export const readability = defineConfig(
  prettier,
  comments.recommended,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
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

      // 복잡도
      "max-params": ["error", 3],
      "max-depth": ["error", 3],
      complexity: ["error", 10],

      // 규칙을 끄는 주석에는 이유를 적습니다.
      "@eslint-community/eslint-comments/require-description": "error",
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
