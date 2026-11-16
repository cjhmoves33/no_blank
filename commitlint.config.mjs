/**
 * 커밋 메시지 규칙: Conventional Commits (https://www.conventionalcommits.org)
 * 형식: <type>(<scope>): <subject>
 * 예시: feat(web): 로그인 페이지 추가
 *       fix(server): 헬스 체크에서 DB 연결 실패를 503 으로 응답
 */
export default {
  extends: ["@commitlint/config-conventional"],
};
