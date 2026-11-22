/** 소리가 시작한 소스 노드는 모두 stop 으로 끝 시각을 정합니다. 정하지 않으면 노드가 멈추지 않고 쌓입니다. */
export type Sound = (output: SoundOutput) => void;

export interface SoundOutput {
  readonly context: BaseAudioContext;
  /** 체육관 울림을 거쳐 스피커로 가는 입구입니다. 모든 효과음이 같은 체육관에서 울립니다. */
  readonly destination: AudioNode;
  readonly startAt: number;
}

interface Speakers {
  readonly context: AudioContext;
  readonly gym: AudioNode;
}

/** 체육관 울림의 길이(초)입니다. 이만큼 지나면 소리가 60 dB 줄어듭니다. */
const ECHO_SECONDS = 1.1;
/** 울림의 크기입니다. 소리 자체(1)보다 작게 두어 조용한 체육관처럼 들리게 합니다. */
const ECHO_LEVEL = 0.18;
// 새로 만든 AudioContext 는 첫 재생 직후 시계가 20 ms 쯤 앞으로 건너뛰어, 지금 시각에 예약한 소리의 앞부분이 잘립니다(2026-11-21 측정).
const FIRST_PLAY_DELAY = 0.03;

// 사용자 입력 전에 만들면 브라우저 자동 재생 정책에 막혀 멈춘 채로 열리므로, 첫 재생 때 만듭니다.
let speakers: Speakers | undefined;
let played = false;

export function playSound(sound: Sound): void {
  speakers ??= openSpeakers();

  const { context, gym } = speakers;
  const play = (): void => {
    const delay = played ? 0 : FIRST_PLAY_DELAY;

    played = true;
    sound({ context, destination: gym, startAt: context.currentTime + delay });
  };

  const drop = (): void => {};

  if (context.state === "running") {
    play();

    return;
  }

  // 멈춘 동안에는 currentTime 이 흐르지 않아, 그 시각에 예약하면 다시 켜질 때 밀린 소리가 한꺼번에 납니다. 그래서 켜진 뒤에 시각을 읽습니다.
  context.resume().then(play, drop);
}

function openSpeakers(): Speakers {
  const context = new AudioContext();
  const gym = context.createGain();
  const echo = context.createConvolver();
  const echoLevel = context.createGain();

  echo.buffer = gymEcho(context);
  echoLevel.gain.value = ECHO_LEVEL;
  gym.connect(context.destination);
  gym.connect(echo).connect(echoLevel).connect(context.destination);

  return { context, gym };
}

/** 오래된 체육관의 울림입니다. 잡음이 지수적으로 줄어들고, 높은 소리가 먼저 사라지도록 부드럽게 뭉갭니다. */
function gymEcho(context: BaseAudioContext): AudioBuffer {
  const length = Math.round(ECHO_SECONDS * context.sampleRate);
  const echo = context.createBuffer(2, length, context.sampleRate);
  const fade = Math.log(1000) / length;

  for (let channel = 0; channel < echo.numberOfChannels; channel++) {
    const samples = echo.getChannelData(channel);
    let smooth = 0;

    for (let i = 0; i < length; i++) {
      const muffle = 0.2 + (0.6 * i) / length;

      smooth += (Math.random() * 2 - 1 - smooth) * (1 - muffle);
      samples[i] = smooth * Math.exp(-fade * i);
    }
  }

  return echo;
}
