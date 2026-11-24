# 타격음 녹음 자료

타격음과 덜컹의 철컥 소리에 쓰는 녹음의 출처, 자른 곳, 고른 과정을 적습니다. 소리의 크기, 밝기, 찌그러뜨리는 정도 같은 수치는 코드(`apps/web/src/audio/sounds.ts`)에만 두고 여기에는 다시 적지 않습니다.

## 쓰는 녹음

모두 Freesound 의 CC0 녹음입니다. 페이지의 라이선스 문구는 "Creative Commons 0 — You can copy, modify, distribute and perform the sound, even for commercial purposes, all without the need of asking permission to the author." 입니다(2026-11-24 확인). 출처를 밝힐 의무는 없지만, 원본을 다시 받거나 소리를 바꿀 때를 위해 적습니다.

| 파일 (`apps/web/public/sounds/`) | 녹음                                                                                                              | 원본에서 자른 곳    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------- |
| `strike-1.flac`                  | [ZusIsKing, OBJPBag-Int_FourHitPunchingBag_Zus_OwSFX_Hard](https://freesound.org/people/ZusIsKing/sounds/766864/) | 0.466초부터 377 ms  |
| `strike-2.flac`                  | [Vrymaa, Hits & Fight - Punching](https://freesound.org/people/Vrymaa/sounds/753427/)                             | 3.935초부터 800 ms  |
| `strike-3.flac`                  | [terratrailblazer, Punchbag Punches](https://freesound.org/people/terratrailblazer/sounds/826992/)                | 29.338초부터 800 ms |
| `strike-4.flac`                  | Vrymaa, Hits & Fight - Punching                                                                                   | 8.992초부터 800 ms  |
| `strike-5.flac`                  | Vrymaa, Hits & Fight - Punching                                                                                   | 5.805초부터 409 ms  |
| `chain.flac`                     | [C_Sander, chains_whipAndTighten](https://freesound.org/people/C_Sander/sounds/733608/)                           | 13.767초부터 444 ms |

타격음 파일은 조용한 것(1)부터 큰 것(5) 순서입니다. 코드는 이 순서를 타격 세기의 순서로 씁니다.

## 만든 방법

1. Freesound 무료 계정으로 원본을 받습니다. 753427, 766864, 733608 은 WAV 이고, 826992 는 원본도 MP3(192 kbps)입니다.
2. ffmpeg 로 원본을 48 kHz 로 풀고(`ffmpeg -i <원본> -f f32le -ar 48000 pipe:1`), 위 구간을 자릅니다. 채널 수는 원본을 따릅니다.
3. 앞 2 ms 와 뒤 40 ms 를 직선으로 줄이고, 최대값을 0.999 에 맞춥니다.
4. 16비트 FLAC 으로 저장합니다(`ffmpeg -f f32le -ar 48000 -ac <채널 수> -i pipe:0 -map_metadata -1 -fflags +bitexact -flags:a +bitexact -c:a flac -sample_fmt s16 -compression_level 12 <파일>`).

손실 압축(MP3, AAC)을 쓰지 않는 이유: 코드가 타격음 녹음을 강하게 찌그러뜨려 조용한 꼬리를 끌어올리므로, 손실 압축이 남긴 잡음도 함께 커집니다. 다만 `strike-3.flac` 은 원본 자체가 MP3 라서 그 잡음이 남아 있을 수 있습니다. 사용자는 이 녹음을 128 kbps 미리듣기로, 찌그러뜨린 상태에서 듣고 골랐습니다. 여섯 파일을 합쳐 211 KB 입니다.

## 고른 과정

2026-11-24 에 사용자와 함께 골랐습니다.

- **후보 찾기**: Freesound, Pixabay, Sonniss GDC 묶음, Voxengo, OpenAIR, EchoThief 를 조사하고, 라이선스를 페이지에서 직접 읽을 수 있었던 것만 남겼습니다. 상업 이용 금지(NC)와 변경 금지(ND)는 뺐습니다. Pixabay, Sonniss, Voxengo 는 출처 표시가 필요 없지만 파일을 그 자체로 배포하는 것을 금지해서, 공개 저장소에 파일을 넣기 어렵습니다. OpenAIR 는 인증서가 만료되어 라이선스를 읽지 못했고, EchoThief 는 라이선스가 내려받은 압축 파일 안에만 있습니다. 그래서 CC0 만 씁니다.
- **듣고 고르기**: 저장소 밖의 일회용 비교 페이지에서 CC0 녹음 42개(타격 23, 사슬 12, 공간 울림 7)의 미리듣기를 자동으로 잘라 들었습니다. 타격 세기, 찌그러뜨리기, 낮은 합성음, 사슬 겹치기, 울림의 종류와 크기를 바꿔 가며 들었습니다.
- **찌그러뜨리기**: 처음 고른 결과는 비교 페이지의 버그(크기 맞추기가 일부 조각을 0 dBFS 넘게 키움) 때문에 찌그러진 소리를 듣고 고른 것이었습니다. 버그를 고치고 찌그러뜨리지 않은 녹음과 일부러 찌그러뜨린 녹음을 함께 들은 뒤, 사용자가 강하게 찌그러뜨리는 쪽을 골랐습니다.
- **울림**: 공간에서 녹음한 울림(차고, 홀, 지하실 등)보다 이 앱의 합성 울림을 골랐고, 크기만 키웠습니다.
- **되풀이 피하기**: 같은 세기로 연달아 치면 그 세기에 가까운 두 녹음을 번갈아 냅니다. 칠 때마다 음높이와 크기를 무작위로 바꾸는 방식은 들어 본 뒤 쓰지 않기로 했습니다. [타격감 근거 자료](strike-feel.md)의 Pixflow 글이 권한 "타격마다 소리를 바꾼다"는 녹음을 번갈아 내는 것으로 지킵니다.

이 녹음들이 바꾼 것은 Claude 가 코드로 합성했던 이전 초안(가죽을 때리는 순간음, 사슬 짤랑임, 철컥 소리)입니다. 초안의 낮은 "쿵" 소리는 녹음 아래에 깔아 무게를 더하는 데 그대로 씁니다.
