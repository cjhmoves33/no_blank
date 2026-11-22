---
name: verify-no-blank
description: "no_blank 의 체육관 장면(web `/`)을 저장소 밖의 격리된 빌드로 띄워 정해진 시점에서 찍고, 두 git ref 의 화면을 픽셀 단위로 비교합니다. 화면이 바뀌면 안 되는 리팩터링의 증거, 3D 장면을 바꾼 PR 의 전후 스크린샷, 누름 소리, 동작 줄이기, WebGL 대체 화면을 확인할 때 씁니다."
---

# verify-no-blank

사용자가 만나는 화면은 체육관 장면 하나(`/`)이고, 입력은 배경 드래그(카메라 회전), 휠(거리), 도형 누름(효과음)입니다. 이 스킬은 `scripts/verify.mjs` 하나로 그 화면을 빌드하고, 띄우고, 사용자 입력을 넣고, 찍고, 비교합니다. 의존성 없이 Node 24 내장 기능과 설치된 Chrome(headless, DevTools 프로토콜)만 씁니다. 용어는 [`docs/GLOSSARY.md`](../../../docs/GLOSSARY.md)를 따릅니다.

모든 명령은 저장소 루트에서 실행합니다.

```sh
V=.claude/skills/verify-no-blank/scripts/verify.mjs
```

## Launch

1. 원격 ref 를 쓸 때는 먼저 `git fetch` 합니다. 스크립트는 ref 를 받은 그대로 씁니다.
2. 비교할 두 상태를 빌드합니다. `node $V prepare <이름> <git ref | WORKTREE>`
   - `%TEMP%/no-blank-verify/builds/<이름>` 에 git worktree 를 만들고, `pnpm install --frozen-lockfile --prefer-offline`(HUSKY=0)과 `pnpm --filter @no-blank/web build` 를 실행합니다. 한 번에 25초쯤 걸립니다.
   - `WORKTREE` 는 커밋하지 않은 변경과 추적하지 않는 파일까지 담은 작업 트리를 커밋 하나로 찍어 빌드합니다. 실제 index 와 작업 트리는 건드리지 않습니다.
   - 준비됨: 명령이 `prepare <이름>: <ref> @ <커밋>` 를 출력하고 0 으로 끝나며, `doctor` 가 그 빌드를 `built` 로 보여 줍니다.
3. 서버는 `shoot` 과 `run` 이 직접 띄우고 내립니다. 빌드 폴더의 `next start -p <포트>` 를 띄우고, `GET /` 의 HTML 에 `<canvas` 가 들어 있어야 준비된 것으로 봅니다. 포트는 before 3101, after 3102 이고, 3000 은 거부합니다.

빌드를 저장소 밖에서 하는 이유: 저장소 안에서 `next build` 를 돌리면, 사용자가 3000 번에 띄워 둔 `next dev` 의 파일 감시가 멈추고 이전 CSS 를 계속 보냅니다(2026-11-22 확인). 이 스킬은 3000 번 서버와 그 `.next/` 를 절대 건드리지 않습니다.

## Doctor

`node $V doctor` 는 읽기만 합니다. 무언가 이상하면 가장 먼저 실행합니다.

- `ok`/`FAIL`: Node 24 이상, Chrome 경로(`CHROME_PATH` 로 바꿀 수 있음), 포트 3101·3102 가 비었는지
- `info port 3000`: 사용자의 dev 서버입니다. 켜져 있어도 정상이고, 건드리지 않습니다.
- `info started ...`: 이 스크립트가 띄운 뒤 남은 서버와 Chrome 의 PID 입니다. `alive` 가 있으면 `cleanup` 합니다.
- `info build ...`: 준비된 빌드와 그 ref, 커밋입니다.

## Drive

전후 비교가 기본 작업입니다.

```sh
node $V run --before origin/main --after WORKTREE            # 기본 시점 7개
node $V run --before <ref> --after <ref> --views home,near    # 시점 고르기
```

`run` 은 두 빌드를 준비하고, 같은 입력으로 찍고, 비교표와 증거 폴더 경로를 출력합니다. 2분쯤 걸립니다. 부분만 필요하면 아래 명령을 씁니다.

- `node $V shoot <이름> [--port 3101] [--views a,b] [--motion] [--no-webgl] [--out <폴더>]`: 준비된 빌드 하나를 찍습니다.
- `node $V compare <before 폴더> <after 폴더> [--out <폴더>]`: 같은 이름의 PNG 끼리 비교합니다.
- `node $V diff <a.png> <b.png> [out.png]`: 두 장을 비교합니다. 같은 빌드 안에서 두 시점을 견줄 때 씁니다.

시점은 1280×800, 배율 1 화면에 넣는 실제 사용자 입력입니다(포인터 드래그, 휠, 누름). 기본으로 `prefers-reduced-motion: reduce` 를 에뮬레이션해서 도형 회전, 먼지, 카메라 관성을 멈추므로, 같은 입력은 늘 같은 프레임을 만듭니다. `--motion` 은 이 에뮬레이션을 끕니다.

| 시점           | 입력                                           | 보이는 것                      |
| -------------- | ---------------------------------------------- | ------------------------------ |
| `home`         | 없음                                           | 처음 카메라 위치               |
| `turned-left`  | 왼쪽 아래 배경을 오른쪽으로 128px 드래그       | 카메라가 도형 둘레를 돈 모습   |
| `turned-right` | 같은 자리에서 왼쪽으로 128px 드래그            | 반대쪽으로 돈 모습             |
| `high`         | 왼쪽 배경을 아래로 400px 드래그                | 가장 높은 위치(위에서 본 매트) |
| `low`          | 왼쪽 배경을 위로 400px 드래그                  | 가장 낮은 위치(천장이 보임)    |
| `near`         | 휠을 당기는 쪽으로 40번                        | 가장 가까운 거리               |
| `far`          | 휠을 미는 쪽으로 40번                          | 가장 먼 거리                   |
| `pressed`      | 화면 가운데(도형) 누름                         | 누름 빛, 효과음 진폭           |
| `shape-drag`   | 도형에서 시작해 드래그, 포인터를 배경으로, 2초 | 카메라가 돌지 않은 화면        |
| `home-later`   | 2초 기다림                                     | 시간이 지난 뒤의 처음 위치     |

기본 시점은 `pressed`, `shape-drag`, `home-later` 를 뺀 7개입니다. 기능별 절차는 [`features/README.md`](features/README.md)에 있습니다. 어떤 기능을 증명하든 그 지도의 절차를 따릅니다.

## Evidence

- 위치: `%TEMP%/no-blank-verify/evidence/<시각>/` 아래 `before/`, `after/`, `diff/`, `report.md`. `shoot` 만 쓰면 `<시각>-<이름>/` 입니다. Git Bash 에서는 `$TEMP/no-blank-verify/evidence` 입니다.
- 시점마다 PNG 와 JSON 이 남습니다. JSON 에는 빌드 커밋, 동작 줄이기 여부, 찍는 순간 캔버스가 있었는지(`canvas`), 효과음 최대 진폭(`audioPeak`), 콘솔 경고와 오류(`errors`)가 들어 있습니다.
- 바뀐 픽셀은 한 채널이라도 8 넘게 달라진 픽셀입니다. 기준선은 이렇습니다.
  - 같은 빌드를 두 번 찍으면 0 개입니다(최대 차이 1). `pressed` 는 누름 빛이 사그라드는 중이라 최대 6 까지 흔들립니다.
  - 이름만 바꾼 리팩터링(PR #18)은 모든 시점에서 0 개였습니다.
  - 단위 변환처럼 계산 순서만 바뀌는 변경은 그림자 가장자리에 흩어진 점이 생길 수 있습니다. `diff/<시점>.png` 를 열어, 빨간 점이 한 물체에 몰려 있으면 실제 변화로 판단합니다.
- 증명 기준: 앱 코드에 시험용 갈고리를 넣지 않고, 사용자 입력으로만 조작합니다. 효과음은 페이지에 넣은 분석기(AudioContext 출력에 덧붙인 `AnalyserNode`)로 관찰만 합니다. 보고할 때는 두 커밋 해시와 비교표, 바뀐 시점의 diff 이미지 경로를 함께 적습니다.
- 알려진 경고: `THREE.Clock: This module has been deprecated` 는 fiber 9.8.2 에서 나는 경고라 모든 시점에 한 번씩 찍힙니다. 그 밖의 경고와 오류는 결과에 적습니다.

## Cleanup

`node $V cleanup` 은 `%TEMP%/no-blank-verify/state.json` 에 기록된 PID(이 스크립트가 띄운 서버와 Chrome)만 종료하고, 빌드 worktree 와 Chrome 프로필, 로그를 지웁니다. 증거 폴더는 남깁니다. `shoot` 과 `run` 은 실패해도 자기가 띄운 서버와 Chrome 을 내리므로, `cleanup` 은 빌드를 지울 때와 `doctor` 가 남은 PID 를 보여 줄 때 실행합니다. pnpm 의 `node_modules` 가 junction 이라 `git worktree remove` 가 실패하면 `rmdir /s /q` 로 지우고 `git worktree prune` 합니다.

## Helpers

`scripts/verify.mjs` 하나가 전부입니다. 하위 명령은 `doctor`, `prepare`, `shoot`, `compare`, `diff`, `run`, `cleanup` 이고, 인자 없이 실행하면 사용법을 출력합니다. 시점을 더하려면 파일 위쪽의 `VIEWS` 에 입력 목록을 더하고, 이 문서의 시점 표와 해당 기능 파일을 함께 고칩니다.
