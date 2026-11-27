# no_blank

Next.js(SSR) 클라이언트, Fastify API 서버, PostgreSQL DB로 구성된 TypeScript 풀스택 모노레포입니다.

```
브라우저 → web (Next.js, :3000) → server (Fastify, :4000) → db (PostgreSQL, :5432)
```

| 경로                 | 설명                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `apps/web`           | Next.js 16 (App Router, SSR). 지금은 실행 중에 API를 호출하지 않습니다. API를 호출하는 예시는 `src/lib/api.ts`입니다. |
| `apps/server`        | Fastify 5 API 서버. Drizzle ORM으로 DB에 접근합니다.                                                                  |
| `apps/workbench`     | 체육관의 한 부분을 따로 꺼내 가까이 보는 개발용 Next.js 앱(작업대)입니다. 배포하지 않습니다.                          |
| `packages/gym`       | web이 그리는 체육관의 3D 장면입니다. 빌드하지 않고 TS 소스를 그대로 내보내며, 가져다 쓰는 앱이 컴파일합니다.          |
| `packages/shared`    | web과 server가 함께 사용하는 API 응답 타입입니다.                                                                     |
| `docker-compose.yml` | db, migrate, server, web 컨테이너 구성입니다.                                                                         |

## 요구 사항

- [Node.js](https://nodejs.org/) 24.13.1 이상
- [pnpm](https://pnpm.io/) 11.28 (`npm install -g pnpm@11.28.12`)
  - 다른 버전의 pnpm이 설치되어 있어도, 이 저장소에서는 `package.json`의 `packageManager` 필드에 따라 11.28.12로 실행됩니다.
  - pnpm 11은 배포된 지 하루가 지나지 않은 패키지 버전을 설치하지 않습니다(`minimumReleaseAge`). 막 배포된 버전이 필요하면 하루 뒤에 추가합니다.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows에서는 WSL 2 백엔드 사용)

## Docker로 전체 실행

DB, 마이그레이션, API 서버, 웹 서버를 모두 컨테이너로 실행합니다. Node.js와 pnpm이 없어도 실행할 수 있습니다.

```bash
docker compose up --build
```

http://localhost:3000 에 접속하면 3D 장면이 표시되고, http://localhost:4000/api/greeting 은 DB에서 읽어 온 "Hello World"를 응답합니다.

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

# 4. shared, server, web, 작업대를 동시에 watch 모드로 실행
pnpm dev
```

`git pull`로 다른 사람이 추가한 의존성을 받은 경우에도 `pnpm install`을 따로 실행할 필요가 없습니다. pnpm 11은 스크립트를 실행하기 전에 `node_modules`가 lockfile과 다르면 자동으로 설치합니다(`verifyDepsBeforeRun`의 기본값 `install`).

| 서비스 | 주소                                                   |
| ------ | ------------------------------------------------------ |
| web    | http://localhost:3000                                  |
| server | http://localhost:4000/api/greeting                     |
| 작업대 | http://localhost:3200                                  |
| db     | `postgres://no_blank:no_blank@localhost:5432/no_blank` |

## 커밋 검사와 CI

- **commit-msg:** 메시지는 `<type>(<scope>): <subject>` 형식으로 씁니다. 예: `feat(web): 로그인 페이지 추가`. type은 `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` 중 하나이고, subject는 마침표로 끝나지 않아야 합니다. subject는 한국어 문장으로 쓰며, 한글이 하나도 없으면 거부됩니다.
- **PR 제목:** CI의 `PR title` 작업이 커밋 subject와 같은 기준으로 PR 제목에 한글이 있는지 검사합니다.
- **CI:** 로컬 훅은 `--no-verify` 옵션으로 건너뛸 수 있으므로, 최종 검증은 CI가 담당합니다.

## 테스트

- **API 테스트:** `apps/server/src/app.test.ts`는 서버를 띄우지 않고 Fastify의 `app.inject()`로 요청을 보냅니다. DB는 프로세스 안에서 띄운 PostgreSQL(PGlite)을 사용합니다. 운영과 같은 드라이버(node-postgres)로 접속하고 운영과 같은 마이그레이션을 적용하므로, Docker 없이도 실제 SQL로 검증합니다. (`apps/server/src/test/create-test-db.ts`)
- **테스트 전용 패키지:** PGlite처럼 테스트에서만 쓰는 패키지는 그 앱의 `devDependencies`에 직접 선언합니다. pnpm 11은 직접 선언한 개발 의존성을 운영 설치(`pnpm deploy --prod`)에서 뺍니다. 다른 워크스페이스 패키지를 거쳐 들여오면 운영 이미지에 섞일 수 있습니다.

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
