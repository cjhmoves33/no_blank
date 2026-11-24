# no_blank 작업 안내

no_blank는 3D 그래픽과 음악·효과음을 쓸 데스크톱 웹 사이드 프로젝트입니다. 실행 방법과 폴더 구조는 [README](README.md)에 있습니다. 서식, lint, 타입, 사용하지 않는 코드, 테스트, 빌드는 도구가 검사하므로 여기에 다시 적지 않습니다.

## 검사

- `pnpm check`는 CI `Code checks` 작업과 같은 검사를 실행합니다. push 직전에 pre-push hook이 이 명령을 실행합니다.
- 검사가 실패하면 코드를 고칩니다. 규칙을 꺼야 한다고 판단하면, 끄기 전에 이유를 설명하고 사용자에게 묻습니다.
- `apps/web`이나 `packages/gym`을 고친 PR은 `verify-no-blank` 스킬로 전후 화면을 비교합니다. 바뀐 화면이 있으면 그 이미지를 PR 본문에 붙이고, 없으면 비교표를 붙입니다.

## 따라 할 예시

새 코드를 쓰기 전에 같은 종류의 예시 파일을 먼저 읽습니다.

| 만들 것                  | 예시                                                           |
| ------------------------ | -------------------------------------------------------------- |
| API 라우트               | `apps/server/src/routes/greeting.ts`                           |
| API 테스트               | `apps/server/src/app.test.ts`                                  |
| API 응답 타입과 파서     | `packages/shared/src/api.ts`                                   |
| 환경 변수 파서           | `apps/server/src/env.ts`                                       |
| web에서 API 호출         | `apps/web/src/lib/api.ts`                                      |
| web 테스트               | `apps/web/src/lib/api.test.ts`                                 |
| DB 스키마와 마이그레이션 | `apps/server/src/db/schema.ts`, README의 "DB 스키마 변경 방법" |
| 3D 장면                  | `packages/gym/src/gym.tsx`                                     |
| 3D 오브젝트              | `packages/gym/src/wrecking-ball/wrecking-ball.tsx`             |
| 체육관 소품              | `packages/gym/src/props/heavy-bags.tsx`                        |
| 그림 텍스처가 있는 소품  | `packages/gym/src/props/wall-clock.tsx`                        |
| 소품의 자리와 크기 검사  | `packages/gym/src/props/plan.ts`, `plan.test.ts`               |
| 3D 오브젝트 테스트       | `packages/gym/src/wrecking-ball/wrecking-ball.test.tsx`        |
| 효과음                   | `apps/web/src/audio/sounds.ts`                                 |
| 효과음 재생 테스트       | `apps/web/src/audio/play-sound.test.ts`                        |

## 범위를 지킵니다

- 요청받은 일만 합니다. 관련 없는 파일의 이름 바꾸기, 정리, 리팩터링은 하지 않고, 필요해 보이면 따로 제안합니다.
- 앞으로 쓰일 것을 대비한 범용 도우미, 래퍼, 설정 옵션을 미리 만들지 않습니다. 두 번째로 필요해질 때 만듭니다. 긴 함수를 이름 있는 단계로 나누는 것은 괜찮습니다(예: `apps/server/src/env.ts`의 `parsePort`).
- 새 의존성은 표준 기능이나 이미 있는 의존성으로 안 될 때만 추가하고, 그 이유를 PR에 적습니다.

```ts
// 하지 않습니다: 호출 하나를 위해 범용 클라이언트를 새로 만듭니다.
export function createApiClient(options: ApiClientOptions) { ... }

// 합니다: 이미 있는 apiGet을 그대로 씁니다.
export function getItems(): Promise<ItemList> {
  return apiGet({ path: "/api/items", parse: parseItemList });
}
```

## 테스트는 동작을 검증합니다

- 사용하는 쪽이 관찰할 수 있는 결과(반환값, 오류, 보낸 요청)를 검증합니다. 내부 함수 호출이나 호출 모양은 검증하지 않습니다.
- 테스트를 쓴 뒤 대상 코드를 일부러 망가뜨려서 테스트가 실패하는지 확인합니다. 동작은 그대로 두고 내부만 바꿨을 때는 통과해야 합니다.

```ts
// 하지 않습니다: 내부 구현이 바뀌면 깨지는 검증입니다.
expect(apiGetSpy).toHaveBeenCalledTimes(1);

// 합니다: 사용하는 쪽이 받는 결과를 검증합니다.
await expect(getGreeting()).resolves.toEqual({ message: "Hello World" });
```

## 그 밖의 약속

- HTTP 요청과 응답, 환경 변수, 외부 JSON처럼 밖에서 들어오는 데이터는 경계에서 타입이 정해진 값으로 바꿉니다. 숫자, JSON처럼 형식 검사가 필요한 값은 파서를 씁니다. API 데이터의 파서는 `packages/shared`에 둡니다.
- 코드 주석과 문서는 한국어로 씁니다. 주석은 코드만 봐서는 알 수 없는 이유가 있을 때만 씁니다.
- 이름을 짓거나 주석과 문서를 쓰기 전에 [`docs/GLOSSARY.md`](docs/GLOSSARY.md)를 읽고, 거기 정의된 용어를 씁니다.
- Next.js 코드를 쓰기 전에 `apps/web/AGENTS.md`를 읽습니다. 이 저장소의 Next.js는 학습 데이터와 다를 수 있습니다.
- `apps/server/src/routes/health.ts`와 `apps/web/src/audio/sounds.ts`의 `TODO(you)`는 사용자가 직접 작성합니다. 요청받기 전에는 구현하지 않습니다.
