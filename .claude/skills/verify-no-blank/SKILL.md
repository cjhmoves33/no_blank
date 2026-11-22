---
name: verify-no-blank
description: "no_blank 의 체육관 장면(web `/`)을 저장소 밖의 격리된 빌드로 띄워 정해진 시점에서 찍고, 두 git ref 의 화면을 픽셀 단위로 비교합니다. 화면이 바뀌면 안 되는 리팩터링의 증거, 3D 장면을 바꾼 PR 의 전후 스크린샷, 타격 소리, 동작 줄이기, WebGL 대체 화면을 확인할 때 씁니다."
---

# verify-no-blank

사용자가 만나는 화면은 체육관 장면 하나(`/`)이고, 입력은 오른쪽 버튼 드래그(카메라 회전), 휠(거리), 왼쪽 버튼의 잽과 휘두르기(타격과 효과음), 커서 모양입니다. 이 스킬은 `scripts/verify.mjs` 하나로 그 화면을 빌드하고, 띄우고, 사용자 입력을 넣고, 찍고, 비교합니다. 의존성 없이 Node 24 내장 기능과 설치된 Chrome(headless, DevTools 프로토콜)만 씁니다. 용어는 [`docs/GLOSSARY.md`](../../../docs/GLOSSARY.md)를 따릅니다.

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
node $V run --before <ref> --after <ref> --views home --no-webgl  # WebGL 없이
```

`run` 은 두 빌드를 준비하고, 같은 입력으로 찍고, 비교표와 증거 폴더 경로를 출력합니다. 2분쯤 걸립니다. 부분만 필요하면 아래 명령을 씁니다.

- `node $V shoot <이름> [--port 3101] [--views a,b] [--motion] [--no-webgl] [--out <폴더>]`: 준비된 빌드 하나를 찍습니다.
- `node $V compare <before 폴더> <after 폴더> [--out <폴더>]`: 같은 이름의 PNG 끼리 비교합니다.
- `node $V diff <a.png> <b.png> [out.png]`: 두 장을 비교합니다. 같은 빌드 안에서 두 시점을 견줄 때 씁니다.

시점은 1280×800, 배율 1 화면에 넣는 실제 사용자 입력입니다(포인터 드래그, 휠, 버튼 누르기). 기본으로 `prefers-reduced-motion: reduce` 를 에뮬레이션해서 먼지와 카메라 관성을 멈추고 레킹볼의 흔들림을 1초 안에 가라앉히므로, 같은 입력은 늘 같은 프레임을 만듭니다(친 직후 1초는 빼고). `--motion` 은 이 에뮬레이션을 끕니다.

| 시점                   | 입력                                                                | 보이는 것                          |
| ---------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| `home`                 | 없음                                                                | 처음 카메라 위치                   |
| `turned-left`          | 왼쪽 아래 배경을 오른쪽 버튼으로 오른쪽으로 128px 드래그            | 카메라가 레킹볼 둘레를 돈 모습     |
| `turned-right`         | 같은 자리에서 오른쪽 버튼으로 왼쪽으로 128px 드래그                 | 반대쪽으로 돈 모습                 |
| `high`                 | 왼쪽 배경을 오른쪽 버튼으로 아래로 400px 드래그                     | 가장 높은 위치(위에서 본 매트)     |
| `low`                  | 왼쪽 배경을 오른쪽 버튼으로 위로 400px 드래그                       | 가장 낮은 위치(천장이 보임)        |
| `near`                 | 휠을 당기는 쪽으로 40번                                             | 가장 가까운 거리                   |
| `far`                  | 휠을 미는 쪽으로 40번                                               | 가장 먼 거리                       |
| `struck`               | 화면 가운데(레킹볼)를 왼쪽 버튼으로 누름(잽)                        | 효과음 진폭                        |
| `ball-drag`            | 레킹볼에서 시작해 왼쪽 드래그, 포인터를 배경으로, 2초               | 카메라가 돌지 않은 화면            |
| `left-background-drag` | 배경에서 레킹볼을 지나지 않게 왼쪽 드래그                           | 카메라가 돌지 않은 화면, 소리 없음 |
| `swipe`                | 레킹볼 왼쪽 배경에서 가운데까지 0.15초에 왼쪽 드래그(휘두르기)      | 들어가는 순간의 효과음 진폭        |
| `swipe-slow`           | 같은 길을 3초에 드래그                                              | 치지 않은 화면, 소리 없음          |
| `swipe-0.3s`           | `swipe` 뒤 0.3초 기다림                                             | 오른쪽으로 밀리며 비틀린 공        |
| `uppercut-0.15s`       | 레킹볼 아래 배경에서 가운데까지 0.15초에 왼쪽 드래그, 0.15초 기다림 | 들렸다 떨어지는 공                 |
| `hover-ball`           | 포인터를 레킹볼 위로 옮김                                           | JSON 의 `cursor` 가 `pointer`      |
| `orbiting`             | 오른쪽 버튼으로 배경을 끈 채 놓지 않음                              | JSON 의 `cursor` 가 `grabbing`     |
| `struck-side-0.2s`     | 공의 오른쪽 가장자리 타격, 0.2초 기다림                             | 왼쪽 뒤로 밀리는 공                |
| `struck-side-0.6s`     | 같은 타격, 0.6초 기다림                                             | 가장 멀리 간 공                    |
| `struck-side-1.5s`     | 같은 타격, 1.5초 기다림                                             | 돌아오는 공                        |
| `struck-under`         | 공의 아래 가장자리 타격                                             | 들렸다 떨어진 공                   |
| `home-later`           | 2초 기다림                                                          | 시간이 지난 뒤의 처음 위치         |

기본 시점은 타격과 드래그 시점, `home-later` 를 뺀 7개입니다. 기능별 절차는 [`features/README.md`](features/README.md)에 있습니다. 어떤 기능을 증명하든 그 지도의 절차를 따릅니다.

## Evidence

- 위치: `%TEMP%/no-blank-verify/evidence/<시각>/` 아래 `before/`, `after/`, `diff/`, `report.md`. `shoot` 만 쓰면 `<시각>-<이름>/` 입니다. Git Bash 에서는 `$TEMP/no-blank-verify/evidence` 입니다.
- 시점마다 PNG 와 JSON 이 남습니다. JSON 에는 빌드 커밋, 동작 줄이기 여부, 찍는 순간 캔버스가 있었는지(`canvas`), 효과음 최대 진폭(`audioPeak`), 찍은 뒤 캔버스의 커서 모양(`cursor`), 콘솔 경고와 오류(`errors`)가 들어 있습니다.
- 바뀐 픽셀은 한 채널이라도 8 넘게 달라진 픽셀입니다. 기준선은 이렇습니다.
  - 같은 빌드를 두 번 찍으면 0 개입니다(최대 차이 1). 친 직후를 찍는 `struck`, `struck-side-*`, `struck-under`, `swipe-0.3s`, `uppercut-0.15s` 는 찍는 시각에 따라 공 둘레가 흔들리므로 기준선에 넣지 않습니다.
  - 이름만 바꾼 리팩터링(PR #18)은 모든 시점에서 0 개였습니다.
  - 단위 변환처럼 계산 순서만 바뀌는 변경은 그림자 가장자리에 흩어진 점이 생길 수 있습니다. `diff/<시점>.png` 를 열어, 빨간 점이 한 물체에 몰려 있으면 실제 변화로 판단합니다.
- 증명 기준: 앱 코드에 시험용 갈고리를 넣지 않고, 사용자 입력으로만 조작합니다. 효과음은 페이지에 넣은 분석기(AudioContext 출력에 덧붙인 `AnalyserNode`)로 관찰만 합니다. 보고할 때는 두 커밋 해시와 비교표, 바뀐 시점의 diff 이미지 경로를 함께 적습니다.
- 알려진 경고: `THREE.Clock: This module has been deprecated` 는 fiber 9.8.2 에서 나는 경고라 모든 시점에 한 번씩 찍힙니다. 그 밖의 경고와 오류는 결과에 적습니다.

### PR 본문에 붙이기

화면이 바뀐 시점이 하나라도 있으면 그 이미지를 PR 본문의 Evidence 에 붙입니다. 바뀐 시점이 없으면 `report.md` 의 비교표를 붙입니다.

PR 에 붙일 비교는 커밋한 뒤 `run --before <PR 의 base 브랜치> --after HEAD` 로 찍습니다. `WORKTREE` 로 찍으면 비교표에 스냅샷 커밋의 해시가 남는데, 이 커밋은 원격에 없어 리뷰어가 찾을 수 없습니다.

1. `node $V publish <before 폴더> <after 폴더> --pr <번호> --dry-run` 으로 올릴 이미지를 만듭니다. 바뀐 시점마다 before, after, 바뀐 픽셀을 반으로 줄여 한 장에 붙이고, `<after 폴더>/../publish-preview/` 에 둡니다. 이미지를 열어 확인합니다.
2. `--dry-run` 을 빼고 다시 실행합니다. GitHub API 로 `pr-assets` 브랜치에 이미지를 커밋하고(로컬 push 와 git hook 을 거치지 않습니다), 커밋 해시로 고정한 주소가 든 마크다운을 출력합니다. `--views a,b` 를 주면 바뀌지 않은 시점도 올립니다.
3. 출력된 마크다운을 PR 본문의 Evidence 에 넣고 `gh pr edit <번호> --body-file <파일>` 로 고칩니다.

`pr-assets` 는 이미지만 쌓는 브랜치이고 main 에 합치지 않습니다. 저장소가 공개되어 있으므로 올린 이미지도 공개됩니다. 움직임을 바꾼 PR 은 `--motion` 으로 찍은 `struck-side-*` 같은 시각별 스틸로 보여 줍니다. 영상(GIF)은 아직 만들 수 없습니다.

## Cleanup

`node $V cleanup` 은 `%TEMP%/no-blank-verify/state.json` 에 기록된 PID(이 스크립트가 띄운 서버와 Chrome)만 종료하고, 빌드 worktree 와 Chrome 프로필, 로그를 지웁니다. 증거 폴더는 남깁니다. `shoot` 과 `run` 은 실패해도 자기가 띄운 서버와 Chrome 을 내리므로, `cleanup` 은 빌드를 지울 때와 `doctor` 가 남은 PID 를 보여 줄 때 실행합니다. pnpm 의 `node_modules` 가 junction 이라 `git worktree remove` 가 실패하면 `rmdir /s /q` 로 지우고 `git worktree prune` 합니다.

## Helpers

`scripts/verify.mjs` 하나가 전부입니다. 하위 명령은 `doctor`, `prepare`, `shoot`, `compare`, `diff`, `run`, `publish`, `cleanup` 이고, 인자 없이 실행하면 사용법을 출력합니다. 시점을 더하려면 파일 위쪽의 `VIEWS` 에 입력 목록을 더하고, 이 문서의 시점 표와 해당 기능 파일을 함께 고칩니다.
