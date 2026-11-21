/** 소리가 시작한 소스 노드는 모두 stop 으로 끝 시각을 정합니다. 정하지 않으면 노드가 멈추지 않고 쌓입니다. */
export type Sound = (output: SoundOutput) => void;

export interface SoundOutput {
  readonly context: BaseAudioContext;
  readonly destination: AudioNode;
  readonly startAt: number;
}

// 사용자 입력 전에 만들면 브라우저 자동 재생 정책에 막혀 멈춘 채로 열리므로, 첫 재생 때 만듭니다.
let sharedContext: AudioContext | undefined;

export function playSound(sound: Sound): void {
  sharedContext ??= new AudioContext();

  const context = sharedContext;
  const play = (): void => {
    sound({
      context,
      destination: context.destination,
      startAt: context.currentTime,
    });
  };

  const drop = (): void => {};

  if (context.state === "running") {
    play();

    return;
  }

  // 멈춘 동안에는 currentTime 이 흐르지 않아, 그 시각에 예약하면 다시 켜질 때 밀린 소리가 한꺼번에 납니다. 그래서 켜진 뒤에 시각을 읽습니다.
  context.resume().then(play, drop);
}
