# WebGL 대체 화면

브라우저가 WebGL 을 만들지 못하면 체육관 장면이 사라지고 페이지 배경만 남습니다. 페이지는 멈추지 않고, 배경은 체육관과 같은 어두운 색이어야 합니다.

## Sub-features

- `fallback-hidden`: 캔버스가 화면에서 사라집니다.
- `fallback-color`: 남은 배경이 어두운 색(`#141210`)입니다.

## How to get to it (user POV)

- WebGL 을 끈 브라우저나 그래픽 드라이버가 막힌 환경에서 페이지를 엽니다.

## Driving it with verify.mjs

Preconditions:

- 증명할 빌드가 준비되어 있고 `doctor` 가 통과합니다.

- **WebGL 없이 열기.** `node $V shoot <이름> --views home --no-webgl --out <폴더>` 를 실행합니다. Chrome 이 `--disable-3d-apis` 로 뜹니다. `home.json` 의 `canvas` 가 `false` 이고, `errors` 에 `A WebGL context could not be created` 가 있습니다.
- **배경 색.** `home.png` 를 엽니다. 화면 전체가 어두운 갈색(`#141210`)입니다.

## Gotchas

- 캔버스는 처음에 생겼다가 WebGL 생성에 실패한 뒤 사라집니다. 로딩 직후가 아니라 찍는 순간의 `canvas` 값을 봅니다.
- PR #17 이전의 빌드는 이 화면이 거의 흰색(`#fafafa`)입니다. 그 빌드에서는 `fallback-color` 가 실패하는 것이 맞습니다.
- WebGL 생성 오류는 이 절차에서 기대하는 오류이므로, 실패로 보고하지 않습니다.
