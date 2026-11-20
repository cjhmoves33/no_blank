# no_blank 작업 안내

이 저장소에서 일하는 에이전트를 위한 안내입니다. 실행 방법과 폴더 구조는 [README](README.md)에 있습니다. 서식, lint, 타입, 사용하지 않는 코드, 테스트, 빌드는 도구가 검사하므로 여기에 다시 적지 않습니다.

## 검사

- `pnpm check`는 CI `Code checks` 작업과 같은 검사를 실행합니다. push 직전에 pre-push hook이 이 명령을 실행합니다.
- 검사가 실패하면 규칙을 끄지 말고 코드를 고칩니다. 규칙을 꺼야 한다고 판단하면 `eslint-disable` 주석에 이유를 적고, 그 판단을 사용자에게 알립니다.

## 따라 할 예시

새 코드를 쓰기 전에 같은 종류의 예시 파일을 먼저 읽습니다.

| 만들 것                  | 예시                                                           |
| ------------------------ | -------------------------------------------------------------- |
| API 라우트               | `apps/server/src/routes/greeting.ts`                           |
| API 테스트               | `apps/server/src/app.test.ts`                                  |
| API 응답 타입과 파서     | `packages/shared/src/api.ts`                                   |
| web에서 API 호출         | `apps/web/src/lib/api.ts`                                      |
| web 테스트               | `apps/web/src/lib/api.test.ts`                                 |
| DB 스키마와 마이그레이션 | `apps/server/src/db/schema.ts`, README의 "DB 스키마 변경 방법" |

## 지킬 것

- Next.js 코드를 쓰기 전에 `apps/web/AGENTS.md`를 읽습니다. 이 저장소의 Next.js는 학습 데이터와 다를 수 있습니다.
- HTTP 요청과 응답, 환경 변수, 외부 JSON처럼 밖에서 들어오는 데이터는 경계에서 파서로 검사해 타입으로 바꿉니다.
- 코드 주석과 문서는 한국어로 씁니다. 주석은 코드만 봐서는 알 수 없는 이유가 있을 때만 씁니다.
- `apps/server/src/routes/health.ts`의 `TODO(you)`는 사용자가 직접 작성합니다. 요청받기 전에는 구현하지 않습니다.
