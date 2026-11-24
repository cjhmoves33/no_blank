import path from "node:path";

import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import prettier from "eslint-config-prettier/flat";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
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
 * 패키지 디렉터리(import.meta.dirname)를 받아, 그 디렉터리의 tsconfig.json 으로 타입 정보와 import 경로를 해석합니다.
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

      "no-else-return": "error",
      "no-lonely-if": "error",
      "no-nested-ternary": "error",

      "object-shorthand": ["error", "always"],
      "prefer-template": "error",

      "simple-import-sort/imports": "error",

      "max-params": ["error", 3],
      "max-depth": ["error", 3],
      complexity: ["error", 10],

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
 * eslint-config-next 없이 React 를 쓰는 패키지(gym)에 eslint-plugin-react 와 react-hooks 를 등록합니다.
 * 켜고 끄는 규칙은 eslint-config-next 와 같아서, web 에서 옮겨 온 코드가 같은 규칙으로 검사됩니다.
 */
export const reactRecommended = defineConfig({
  files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
  plugins: { react: reactPlugin, "react-hooks": reactHooks },
  settings: { react: { version: "detect" } },
  rules: {
    ...reactPlugin.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    // R3F 는 args, attach 처럼 DOM 에 없는 속성을 JSX 에 씁니다.
    "react/no-unknown-property": "off",
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
  },
});

/**
 * React/JSX 규칙입니다. eslint-plugin-react 를 등록하는 설정(eslint-config-next, reactRecommended) 뒤에 둡니다.
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
