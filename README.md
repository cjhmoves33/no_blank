# no_blank

Next.js(SSR) 클라이언트와 Fastify API 서버로 구성된 TypeScript 풀스택 모노레포입니다.

```
브라우저 → web (Next.js, :3000)                 페이지
브라우저 → server (Fastify, :4000, /api/home)   홈 WebSocket
```

| 경로                   | 설명                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`             | Next.js 16 (App Router, SSR). 브라우저가 홈 WebSocket(`/api/home`)에 연결합니다. 연결 코드는 `src/lib/home-connection.ts`입니다.                                                            |
| `apps/server`          | Fastify 5 API 서버. 홈 WebSocket(`/api/home`)과 헬스 체크(`/api/health`)를 제공합니다.                                                                                                      |
| `apps/workbench`       | 체육관의 한 부분을 따로 꺼내 가까이 보는 개발용 Next.js 앱(작업대)입니다. 배포하지 않습니다.                                                                                                |
| `packages/gym`         | web이 그리는 체육관의 3D 장면입니다. 빌드하지 않고 TS 소스를 그대로 내보내며, 가져다 쓰는 앱이 컴파일합니다.                                                                                |
| `packages/ball-motion` | 레킹볼의 흔들림, 비틀림, 기우뚱, 히트스톱을 계산합니다. React와 화면을 모르며, gym처럼 TS 소스를 그대로 내보냅니다. 빌드한 서버만 `--conditions=built`로 실행해서 컴파일한 `dist`를 씁니다. |
| `packages/shared`      | web과 server가 함께 사용하는 API 응답과 홈 메시지의 타입, 그리고 그 파서입니다.                                                                                                             |
| `docker-compose.yml`   | server, web 컨테이너 구성입니다.                                                                                                                                                            |

## 요구 사항

- [Node.js](https://nodejs.org/) 24.13.1 이상
- [pnpm](https://pnpm.io/) 11.28 (`npm install -g pnpm@11.28.12`)
  - 다른 버전의 pnpm이 설치되어 있어도, 이 저장소에서는 `package.json`의 `packageManager` 필드에 따라 11.28.12로 실행됩니다.
  - pnpm 11은 배포된 지 하루가 지나지 않은 패키지 버전을 설치하지 않습니다(`minimumReleaseAge`). 막 배포된 버전이 필요하면 하루 뒤에 추가합니다.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows에서는 WSL 2 백엔드 사용)

## Docker로 전체 실행

API 서버와 웹 서버를 컨테이너로 실행합니다. Node.js와 pnpm이 없어도 실행할 수 있습니다.

```bash
docker compose up --build
```

http://localhost:3000 에 접속하면 3D 장면이 표시되고, http://localhost:4000/api/health 는 서버가 살아 있으면 `{"status":"ok"}`를 응답합니다.

종료는 다음 명령으로 합니다.

```bash
docker compose down
```

## 로컬 개발 환경 실행

코드를 수정하면서 개발할 때는 web과 server를 로컬에서 watch 모드로 실행합니다.

```bash
# 1. 의존성 설치
pnpm install

# 2. shared, server, web, 작업대를 동시에 watch 모드로 실행
pnpm dev
```

서버의 `HOST`나 `PORT`를 바꾸려면 `apps/server/.env`에 적습니다. server의 `dev`와 `start` 스크립트는 이 파일이 있으면 읽습니다.

`git pull`로 다른 사람이 추가한 의존성을 받은 경우에도 `pnpm install`을 따로 실행할 필요가 없습니다. pnpm 11은 스크립트를 실행하기 전에 `node_modules`가 lockfile과 다르면 자동으로 설치합니다(`verifyDepsBeforeRun`의 기본값 `install`).

| 서비스       | 주소                             |
| ------------ | -------------------------------- |
| web          | http://localhost:3000            |
| server       | http://localhost:4000/api/health |
| 홈 WebSocket | ws://localhost:4000/api/home     |
| 작업대       | http://localhost:3200            |

## 커밋 검사와 CI

- **commit-msg:** 메시지는 `<type>(<scope>): <subject>` 형식으로 씁니다. 예: `feat(web): 로그인 페이지 추가`. type은 `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` 중 하나이고, subject는 마침표로 끝나지 않아야 합니다. subject는 한국어 문장으로 쓰며, 한글이 하나도 없으면 거부됩니다.
- **PR 제목:** CI의 `PR title` 작업이 커밋 subject와 같은 기준으로 PR 제목에 한글이 있는지 검사합니다.
- **CI:** 로컬 훅은 `--no-verify` 옵션으로 건너뛸 수 있으므로, 최종 검증은 CI가 담당합니다.

## 테스트

- **API 테스트:** `apps/server/src/app.test.ts`는 서버를 띄우지 않고 Fastify의 `app.inject()`로 요청을 보냅니다. 홈 WebSocket(`/api/home`) 테스트만은 임의의 로컬 포트에 서버를 띄우고 Node의 `WebSocket`으로 연결합니다.
- **테스트 전용 패키지:** 테스트에서만 쓰는 패키지는 그 앱의 `devDependencies`에 직접 선언합니다. pnpm 11은 직접 선언한 개발 의존성을 운영 설치(`pnpm deploy --prod`)에서 뺍니다. 다른 워크스페이스 패키지를 거쳐 들여오면 운영 이미지에 섞일 수 있습니다.

## 환경 변수

| 변수                  | 사용처 | 기본값                  | 설명                                                                                                                                                    |
| --------------------- | ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HOST`                | server | `localhost`             | 서버가 수신할 주소입니다. 컨테이너에서는 `0.0.0.0`을 사용합니다.                                                                                        |
| `PORT`                | server | `4000`                  | 서버 포트입니다.                                                                                                                                        |
| `NEXT_PUBLIC_API_URL` | web    | `http://localhost:4000` | 브라우저가 쓸 서버 주소입니다. 빌드할 때 값이 박힙니다. 접속 주소는 이 값에 `/api/home`을 붙이고, `https`이면 `wss`, `http`이면 `ws`로 바꾸어 만듭니다. |
