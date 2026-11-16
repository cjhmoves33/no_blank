/**
 * 커밋 직전에 staged 파일에만 실행됩니다. (.husky/pre-commit → lint-staged --concurrent false)
 * --concurrent false 이므로 위에서 아래 순서로 실행됩니다: 패키지별 ESLint 자동 수정 → 전체 Prettier 포맷.
 */

/**
 * ESLint 9 는 명령을 실행한 위치에서 설정 파일을 찾습니다.
 * 그래서 각 패키지 디렉터리에서 실행해 그 패키지의 eslint.config.mjs 를 사용합니다.
 */
const eslintIn = (pkg) => (files) => {
  const paths = files.map((file) => `"${file.replaceAll("\\", "/")}"`);

  return `pnpm --filter ${pkg} exec eslint --fix --no-warn-ignored ${paths.join(" ")}`;
};

export default {
  "apps/web/**/*.{js,mjs,cjs,ts,tsx}": eslintIn("@no-blank/web"),
  "apps/server/**/*.{js,mjs,cjs,ts}": eslintIn("@no-blank/server"),
  "packages/shared/**/*.{js,mjs,cjs,ts}": eslintIn("@no-blank/shared"),
  // 루트에서 실행하므로 루트 .prettierignore 가 적용됩니다. 지원하지 않는 형식(.sql 등)은 건너뜁니다.
  "*": "prettier --write --ignore-unknown",
};
