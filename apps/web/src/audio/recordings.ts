/** 녹음의 출처와 라이선스(CC0)는 docs/research/strike-sound.md 에 있습니다. */
export interface Recordings {
  readonly strikesQuietToLoud: readonly AudioBuffer[];
  readonly chain: AudioBuffer;
}

const STRIKE_FILES_QUIET_TO_LOUD = [
  "/sounds/strike-1.flac",
  "/sounds/strike-2.flac",
  "/sounds/strike-3.flac",
  "/sounds/strike-4.flac",
  "/sounds/strike-5.flac",
];
const CHAIN_FILE = "/sounds/chain.flac";
const FILE_SAMPLE_RATE = 48000;

let loading: Promise<void> | undefined;
let loaded: Recordings | undefined;

export function loadRecordings(): Promise<void> {
  loading ??= decodeAll().then(
    (recordings) => {
      loaded = recordings;
    },
    (error: unknown) => {
      console.error("효과음 녹음을 불러오지 못했습니다.", error);
    },
  );

  return loading;
}

export function loadedRecordings(): Recordings | undefined {
  return loaded;
}

async function decodeAll(): Promise<Recordings> {
  // 사용자 입력 전에는 AudioContext 를 만들지 않으므로(play-sound.ts), 소리를 내지 않는 OfflineAudioContext 로 미리 디코딩합니다.
  const decoder = new OfflineAudioContext(1, 1, FILE_SAMPLE_RATE);
  const [strikesQuietToLoud, chain] = await Promise.all([
    Promise.all(
      STRIKE_FILES_QUIET_TO_LOUD.map((file) => decode(decoder, file)),
    ),
    decode(decoder, CHAIN_FILE),
  ]);

  return { strikesQuietToLoud, chain };
}

async function decode(
  decoder: BaseAudioContext,
  file: string,
): Promise<AudioBuffer> {
  const response = await fetch(file);

  if (!response.ok) {
    throw new Error(`${file} 를 받지 못했습니다 (${String(response.status)})`);
  }

  return decoder.decodeAudioData(await response.arrayBuffer());
}
