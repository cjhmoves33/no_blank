/** 효과음에 쓰는 녹음입니다. 출처와 자른 지점은 docs/research/strike-sound.md 에 있습니다. */
export interface Recordings {
  /** 타격음 녹음입니다. 조용한 것부터 큰 것 순서입니다. */
  readonly strikes: readonly AudioBuffer[];
  readonly chain: AudioBuffer;
}

const STRIKE_FILES = [
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

/** 페이지를 열 때 한 번 부릅니다. 받지 못하면 효과음 없이 지나갑니다. */
export function loadRecordings(): Promise<void> {
  loading ??= decodeAll().then(
    (recordings) => {
      loaded = recordings;
    },
    () => {},
  );

  return loading;
}

/** 아직 다 불러오지 못했으면 undefined 입니다. */
export function loadedRecordings(): Recordings | undefined {
  return loaded;
}

async function decodeAll(): Promise<Recordings> {
  // 첫 타격부터 소리가 나려면 사용자 입력 전에 디코딩해야 합니다. AudioContext 는 입력 전에 만들면 멈춘 채로 열리므로, 디코딩만 하는 OfflineAudioContext 를 씁니다.
  const decoder = new OfflineAudioContext(1, 1, FILE_SAMPLE_RATE);
  const [strikes, chain] = await Promise.all([
    Promise.all(STRIKE_FILES.map((file) => decode(decoder, file))),
    decode(decoder, CHAIN_FILE),
  ]);

  return { strikes, chain };
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
