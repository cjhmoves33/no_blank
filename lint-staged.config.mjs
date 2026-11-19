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
  "*": "prettier --write --ignore-unknown",
};
