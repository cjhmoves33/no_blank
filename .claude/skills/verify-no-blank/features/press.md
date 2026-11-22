# 도형 누름

도형 위에서 주 버튼을 누르는 순간 효과음이 나고 도형이 밝게 빛났다가 사그라듭니다. 도형에서 시작한 드래그는 카메라를 돌리지 않습니다.

## Sub-features

- `press-sound`: 누르는 순간 효과음이 납니다. 버튼을 놓을 때는 나지 않습니다.
- `press-glow`: 누른 직후 도형이 밝아졌다가 1초 안에 원래 밝기로 돌아옵니다.
- `press-no-orbit`: 도형에서 시작해 끌어도 카메라는 그대로입니다.

## How to get to it (user POV)

- 화면 가운데의 도형을 마우스 왼쪽 버튼으로 누릅니다.
- 도형을 누른 채 옆으로 끕니다.

## Driving it with verify.mjs

Preconditions:

- 증명할 빌드가 준비되어 있고 `doctor` 가 통과합니다.

- **누름.** 도형을 누릅니다. `node $V shoot <이름> --views home,pressed --out <폴더>` 를 실행합니다. `pressed.json` 의 `audioPeak` 가 0.2 이상이고(지금 효과음의 설계 진폭은 0.25, 측정값은 0.239), `pressed.png` 의 도형이 `home.png` 보다 밝습니다.
- **누르지 않으면 소리 없음.** 같은 실행의 `home.json` 의 `audioPeak` 가 0 입니다.
- **도형에서 시작한 드래그.** 도형을 누른 채 끌고, 포인터를 배경으로 옮겨 2초 기다립니다. `node $V shoot <이름> --views home,shape-drag --out <폴더>` 다음에 `node $V diff <폴더>/home.png <폴더>/shape-drag.png` 를 실행합니다. 바뀐 픽셀이 0 개이고, `shape-drag.json` 의 `audioPeak` 는 0.2 이상입니다. 소리는 났지만 카메라는 돌지 않았다는 뜻입니다.

## Gotchas

- 포인터가 도형 위에 남으면 hover 빛이 켜져 `home` 과 8% 가까이 달라집니다. `shape-drag` 가 포인터를 배경으로 옮기는 이유입니다.
- `pressed` 는 누름 빛이 사그라드는 중에 찍으므로, 같은 빌드를 두 번 찍어도 최대 차이가 6 까지 흔들립니다. 전후 비교의 기준선에 넣지 않습니다.
- `audioPeak` 는 페이지가 만든 AudioContext 의 출력에 분석기를 덧붙여 잰 값입니다. 스피커로 실제 소리가 나는지는 사용자만 확인할 수 있습니다.
- 소리의 모양(음색, 길이)은 사용자가 귀로 판단합니다. 진폭이 같다고 같은 소리라고 보고하지 않습니다.
