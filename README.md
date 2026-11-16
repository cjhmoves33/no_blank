# no_blank

Next.js(SSR) 클라이언트, Fastify API 서버, PostgreSQL DB로 구성된 TypeScript 풀스택 모노레포입니다.

```
브라우저 → web (Next.js, :3000) → server (Fastify, :4000) → db (PostgreSQL, :5432)
```

| 경로                 | 설명                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `apps/web`           | Next.js 16 (App Router, SSR). 서버 컴포넌트에서 API를 호출합니다. |
| `apps/server`        | Fastify 5 API 서버. Drizzle ORM으로 DB에 접근합니다.              |
| `packages/shared`    | web과 server가 함께 사용하는 API 응답 타입입니다.                 |
| `docker-compose.yml` | db, migrate, server, web 컨테이너 구성입니다.                     |

## 요구 사항

- [Node.js](https://nodejs.org/) 24 이상 (24.x 최신 버전 권장)
  - Windows에서 프로젝트 경로에 한글이 있으면, 구버전 Node 24(예: 24.12.0)는 `fs.rmSync` 버그([nodejs/node#61067](https://github.com/nodejs/node/issues/61067))로 git hook 설치(`pnpm install`의 `prepare`)가 실패합니다.
- [pnpm](https://pnpm.io/) 10.33 (`npm install -g pnpm@10.33.0`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows에서는 WSL 2 백엔드 사용)

## Docker로 전체 실행

DB, 마이그레이션, API 서버, 웹 서버를 모두 컨테이너로 실행합니다. Node.js와 pnpm이 없어도 실행할 수 있습니다.

```bash
docker compose up --build
```

http://localhost:3000 에 접속하면 DB에서 읽어 온 "Hello World"가 표시됩니다.

컨테이너는 아래 순서로 기동합니다. 앞 단계가 준비되어야 다음 단계가 시작됩니다.

1. `db`: PostgreSQL이 접속 가능한 상태(healthy)가 될 때까지 기다립니다.
2. `migrate`: 마이그레이션을 한 번 적용하고 종료합니다.
3. `server`: `/api/health`가 200을 응답할 때까지 기다립니다.
4. `web`: Next.js 서버가 기동합니다.

종료와 초기화는 다음 명령으로 합니다.

```bash
docker compose down      # 컨테이너 종료 (DB 데이터는 유지)
docker compose down -v   # 컨테이너 종료 및 DB 데이터 삭제
```

DB 계정을 바꾸려면 루트의 `.env.example`을 `.env`로 복사해서 값을 수정합니다. 파일이 없으면 기본값(`no_blank`)을 사용합니다.

## 로컬 개발 환경 실행

코드를 수정하면서 개발할 때는 DB만 컨테이너로 띄우고, web과 server는 로컬에서 watch 모드로 실행합니다.

```bash
# 1. 의존성 설치
pnpm install

# 2. 서버 환경 변수 파일 생성 (기본값이 docker compose 의 db 설정과 일치합니다)
cp apps/server/.env.example apps/server/.env

# 3. DB 컨테이너 실행 및 마이그레이션 적용
pnpm db:up
pnpm db:migrate

# 4. shared, server, web 을 동시에 watch 모드로 실행
pnpm dev
```

`git pull`로 다른 사람이 추가한 의존성을 받은 경우에도 `pnpm install`을 따로 실행할 필요가 없습니다. `pnpm-workspace.yaml`의 `verifyDepsBeforeRun: install` 설정에 따라, pnpm 스크립트를 실행하기 전에 `node_modules`가 lockfile과 다르면 자동으로 설치합니다.

| 서비스 | 주소                                                   |
| ------ | ------------------------------------------------------ |
| web    | http://localhost:3000                                  |
| server | http://localhost:4000/api/greeting                     |
| db     | `postgres://no_blank:no_blank@localhost:5432/no_blank` |

## 주요 스크립트

루트에서 실행합니다.

| 명령                | 설명                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm dev`          | shared를 빌드한 뒤 shared, server, web을 watch 모드로 동시에 실행합니다.                                    |
| `pnpm build`        | 모든 패키지를 의존성 순서(shared → server, web)대로 빌드합니다.                                             |
| `pnpm typecheck`    | shared를 빌드한 뒤 모든 패키지의 타입을 검사합니다. (server와 web은 shared의 빌드 결과에서 타입을 읽습니다) |
| `pnpm lint`         | 모든 패키지에 ESLint를 실행합니다. 규칙은 `packages/eslint-config`에서 공통으로 관리합니다.                 |
| `pnpm lint:fix`     | 자동 수정이 가능한 ESLint 규칙(빈 줄, import 정렬 등)을 적용합니다.                                         |
| `pnpm format`       | 저장소 전체에 Prettier 포맷을 적용합니다.                                                                   |
| `pnpm format:check` | 포맷이 맞지 않는 파일이 있으면 실패합니다. (CI 용도)                                                        |
| `pnpm db:up`        | DB 컨테이너만 실행합니다.                                                                                   |
| `pnpm db:generate`  | `apps/server/src/db/schema.ts` 변경 사항으로 마이그레이션 SQL을 생성합니다.                                 |
| `pnpm db:migrate`   | 아직 적용하지 않은 마이그레이션을 DB에 적용합니다.                                                          |

## 커밋 검사와 CI

코드 규칙과 커밋 메시지는 아래 단계에서 검사합니다. `pnpm install`을 실행하면 husky가 git hook을 자동으로 등록합니다.

| 단계                      | 대상           | 검사 내용                                    | 실패하면                |
| ------------------------- | -------------- | -------------------------------------------- | ----------------------- |
| 커밋 직전 (pre-commit)    | staged 파일만  | ESLint 자동 수정 → Prettier 포맷             | 커밋이 중단됩니다.      |
| 커밋 메시지 (commit-msg)  | 커밋 메시지    | Conventional Commits 형식 (commitlint)       | 커밋이 중단됩니다.      |
| push 직전 (pre-push)      | 작업 트리 전체 | `pnpm typecheck`                             | push가 중단됩니다.      |
| push, PR (GitHub Actions) | 저장소 전체    | `format:check`, `lint`, `typecheck`, `build` | PR에 실패가 표시됩니다. |

- **pre-commit:** 자동 수정 가능한 문제는 고쳐진 상태로 커밋됩니다. 고칠 수 없는 ESLint 오류가 있으면 커밋이 중단되고, 경고(`complexity` 등)는 커밋을 막지 않습니다.
- **commit-msg:** 메시지는 `<type>(<scope>): <subject>` 형식으로 씁니다. 예: `feat(web): 로그인 페이지 추가`. type은 `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` 중 하나이고, subject는 마침표로 끝나지 않아야 합니다.
- **pre-push:** 커밋되지 않은 변경도 포함한 현재 작업 트리를 검사합니다.
- **설정 파일:** `.husky/`의 각 훅 파일, `lint-staged.config.mjs`, `commitlint.config.mjs`, `.github/workflows/ci.yml`에서 관리합니다.
- **CI:** 로컬 훅은 `--no-verify` 옵션으로 건너뛸 수 있으므로, 최종 검증은 CI가 담당합니다.

## DB 스키마 변경 방법

1. `apps/server/src/db/schema.ts`에서 테이블 정의를 수정합니다.
2. `pnpm db:generate`를 실행하면 `apps/server/drizzle/`에 마이그레이션 SQL이 생성됩니다.
3. 생성된 SQL을 확인한 뒤 `pnpm db:migrate`로 적용합니다.
4. 생성된 마이그레이션 파일은 커밋합니다. Docker로 실행할 때 `migrate` 컨테이너가 같은 파일을 적용합니다.

데이터를 넣는 마이그레이션은 `pnpm --filter @no-blank/server exec drizzle-kit generate --custom --name <이름>`으로 빈 SQL 파일을 만든 뒤 직접 작성합니다. (예: `0001_seed_hello_world.sql`)

## 환경 변수

| 변수                                                  | 사용처         | 기본값                  | 설명                                                                                             |
| ----------------------------------------------------- | -------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                        | server         | 없음 (필수)             | PostgreSQL 접속 주소입니다.                                                                      |
| `HOST`                                                | server         | `localhost`             | 서버가 수신할 주소입니다. 컨테이너에서는 `0.0.0.0`을 사용합니다.                                 |
| `PORT`                                                | server         | `4000`                  | 서버 포트입니다.                                                                                 |
| `API_URL`                                             | web            | `http://localhost:4000` | 서버 컴포넌트가 호출할 API 주소입니다. 요청 시점에 읽히므로 컨테이너 실행 시 주입할 수 있습니다. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | docker compose | `no_blank`              | DB 계정과 데이터베이스 이름입니다.                                                               |
