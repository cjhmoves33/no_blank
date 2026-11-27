// subject에 한글이 하나도 없으면 영어 문장으로 쓴 것으로 봅니다.
// 문장 구조까지는 검사하지 못하므로, 기준은 CLAUDE.md에 적습니다.
const HANGUL = /[가-힣]/;

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "subject-korean": ({ subject }) => [
          HANGUL.test(subject ?? ""),
          "subject는 한국어 문장으로 씁니다. 예: feat(gym): 샌드백에 가죽과 체인 추가",
        ],
      },
    },
  ],
  rules: {
    "subject-korean": [2, "always"],
  },
};
