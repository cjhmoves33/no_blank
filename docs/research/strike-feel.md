# 타격감 근거 자료

타격 반응과 효과음을 정할 때 참고한 자료입니다. 자료마다 무엇을 말하는지, 어떤 결정의 근거가 되었는지, 얼마나 믿을 만한지를 적습니다. 이 앱에서 쓰는 수치는 코드에만 두고 여기에는 다시 적지 않습니다.

자료 목록은 다른 작업 세션에서 조사했고, 2026-11-22 에 각 링크를 직접 열어 내용을 확인했습니다.

## 확인한 자료

**Lin 외, "Game Impact Feel" 분석 (IEEE GEM 2022)**
https://arxiv.org/abs/2208.06155

- 종류: 학회 논문.
- 내용: Steam 인기 액션 게임의 플레이어 리뷰를 자연어 처리로 분석해서, 타격감에 영향을 주는 요소로 히트스톱, 소리의 일관성(sound coherence), 카메라 제어(camera control)를 꼽습니다. "셋 가운데 하나라도 공들이지 않으면 타격감을 망칠 수 있다"고 조심스럽게 표현합니다.
- 근거가 된 결정: 히트스톱, 효과음, 화면 떨림을 모두 넣되 조용한 체육관에 맞게 약하게 넣습니다.

**사쿠라이 마사히로의 히트스톱 칼럼 (팬 번역)**
https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/

- 종류: 패미통 칼럼의 팬 번역입니다. 번역이 원문과 다를 수 있다고 페이지가 밝힙니다.
- 내용: 맞히는 순간 양쪽이 잠깐 멈춰서 충격의 힘을 강조한다고 설명합니다.
- 근거가 된 결정: 히트스톱.

**ITU-R BT.1359-1, "Relative timing of sound and vision for broadcasting" (1998)**
https://www.itu.int/rec/R-REC-BT.1359/en

- 종류: 국제 방송 표준 권고.
- 내용: 시청자가 소리와 화면의 어긋남을 알아채는 문턱은 소리가 앞설 때 약 45 ms, 소리가 늦을 때 약 125 ms 입니다. 소리가 앞서는 쪽을 훨씬 민감하게 알아챕니다.
- 근거가 된 결정: 효과음은 타격 순간에 바로 내고 화면보다 앞서지 않게 합니다. 페이지를 연 뒤 첫 타격에서만 소리를 조금 늦게 예약해도 알아채기 어렵습니다.

**Pixflow, "Punch Impact Sound Effects for Fight Scenes"**
https://pixflow.net/blog/punch-impact-sound-effects-for-fight-scenes/

- 종류: 효과음을 파는 회사의 블로그입니다.
- 내용: 펀치 소리를 첫 충격, 몸통의 울림, 꼬리(감쇠)로 나눕니다. 같은 펀치 소리를 같은 음량으로 되풀이하는 것을 가장 흔한 실수로 꼽고, 타격마다 소리와 음량을 바꾸라고 권합니다. 음높이를 바꾸라는 말은 없습니다.
- 근거가 된 결정: 효과음을 층으로 나누고, 타격마다 조금씩 바꿉니다.

**Violet Recording, "How to Design Weapon Sounds"**
https://violetrecording.com/how-to-design-weapon-sounds/

- 종류: 녹음 스튜디오 중개 서비스의 블로그입니다.
- 내용: 몸통만 있고 순간음이 없으면 먹먹하고, 순간음만 있고 몸통이 없으면 가볍고 장난감 같다고 설명합니다.
- 근거가 된 결정: 효과음에 가죽을 때리는 순간음과 묵직한 몸통을 함께 넣습니다.

**Lécuyer 외, "Feeling Bumps and Holes without a Haptic Interface" (CHI 2004)**
https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p239.pdf

- 종류: 학회 논문.
- 내용: 일반 마우스 커서의 움직임을 빠르게 하거나 느리게 하는 것만으로, 참가자들이 화면 속 요철을 알아보고 그 모양을 그려 냈습니다.
- 근거가 된 결정: 나중에 다룰 글러브 커서에서, 맞은 자리에 커서가 잠깐 붙는 느낌을 주는 방법입니다.

## 일부만 확인한 자료

**Squirrel Eiserloh, "Juicing Your Cameras With Math" (GDC 2016)**
https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing

- 강연 목록 페이지에서 카메라 흔들림을 다루는 강연이라는 것만 확인했습니다. 강연 본문은 회원 전용이어서, 트라우마 값을 더하고 줄이며 그 제곱으로 흔드는 방식은 확인하지 못했습니다.
- 근거가 된 결정: 화면 떨림.

**Samad 외, "Pseudo-Haptic Weight" (CHI 2019)**

- 서지 정보(DOI 10.1145/3290605.3300550)에서 제목과 부제, 곧 "control-display ratio 를 바꿔 가상 물체의 무게감을 바꾼다"는 것만 확인했습니다. 본문은 열리지 않았고, 실험 환경은 VR 입니다.
- 근거가 된 결정: 나중에 다룰 글러브 커서.

## 확인하지 못해 근거로 쓰지 않은 자료

- 캡콤 스트리트 파이터 V 칼럼(약·중·강 공격의 히트스톱 프레임 수, https://game.capcom.com/cfn/sfv/column/131545?lang=en): 페이지가 열리지 않았습니다. 히트스톱 길이는 이 수치에 기대지 않고 눈으로 보며 맞춥니다.
- "히트스톱이 20 프레임을 넘으면 버그처럼 느껴진다"는 글(https://gamejuice.pages.dev/articles/hit-stop-frame-trick): 페이지가 준비 중이어서 내용이 없습니다.
- Eg, Behne, "Perceived synchrony for realistic and dynamic audiovisual events" (Frontiers in Psychology, 2015): 초록에는 소리가 앞설 때와 늦을 때의 차이가 없고, 본문은 열리지 않았습니다. 같은 주장은 ITU-R BT.1359-1 로 확인했습니다.
