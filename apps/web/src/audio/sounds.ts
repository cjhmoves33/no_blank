import type { Sound, SoundOutput } from "./play-sound";
import { loadedRecordings } from "./recordings";

/** 찌그러뜨린 타격음 녹음의 최대 크기입니다. 사슬 녹음도 이 크기를 기준으로 줄입니다. */
const STRIKE_PEAK = 10 ** (-9 / 20);
// 타격음 녹음을 일부러 강하게 찌그러뜨립니다. 최대값보다 40 dB 작은 꼬리가 11 dB 작은 정도까지 올라와, 깨끗한 녹음보다 두껍고 묵직하게 들립니다.
// 사용자가 찌그러뜨리지 않은 녹음과 여러 세기를 견주어 듣고 고른 값입니다(docs/research/strike-sound.md).
const DRIVE = 28.4;
/** 녹음 아래에 깔아 무게를 더하는 낮은 합성음의 크기입니다. */
const THUMP_LEVEL = 0.7;

let previousTake: number | undefined;
let driveCurve: Float32Array<ArrayBuffer> | undefined;

/** 타격음입니다. 녹음을 아직 불러오지 못했으면 소리를 내지 않습니다. */
export function strikeSound(strength: number): Sound {
  return (output) => {
    const recordings = loadedRecordings();

    if (!recordings) {
      return;
    }

    const take = takeFor(strength, recordings.strikes.length);
    const recording = recordings.strikes[take];

    if (!recording) {
      return;
    }

    previousTake = take;
    strike(output, recording, strength);
    thump(output, strength);
    play(
      { ...output, startAt: output.startAt + 0.05 + Math.random() * 0.2 },
      recordings.chain,
      (0.15 + 0.35 * strength) * STRIKE_PEAK,
    );
  };
}

/** 덜컹할 때 사슬이 내는 철컥 소리입니다. 녹음을 아직 불러오지 못했으면 소리를 내지 않습니다. */
export function chainSound(strength: number): Sound {
  return (output) => {
    const recordings = loadedRecordings();

    if (!recordings) {
      return;
    }

    play(output, recordings.chain, (0.3 + 0.7 * strength) * STRIKE_PEAK);
  };
}

/** 타격 세기를 사이에 둔 두 녹음 가운데 더 가까운 것을 고르되, 바로 앞에 낸 녹음이면 다른 하나를 고릅니다. */
function takeFor(strength: number, count: number): number {
  const position = strength * (count - 1);
  const lower = Math.max(0, Math.min(Math.floor(position), count - 2));
  const nearer = position - lower <= 0.5 ? lower : lower + 1;
  const other = nearer === lower ? lower + 1 : lower;

  return nearer === previousTake ? other : nearer;
}

/** 약하게 칠수록 작고 어둡게 냅니다. */
function strike(
  { context, destination, startAt }: SoundOutput,
  recording: AudioBuffer,
  strength: number,
) {
  const source = new AudioBufferSourceNode(context, { buffer: recording });
  const tone = new BiquadFilterNode(context, {
    type: "lowpass",
    frequency: 1500 + 16000 * strength ** 1.5,
    Q: 0.7,
  });
  const drive = new WaveShaperNode(context, {
    curve: (driveCurve ??= curveOfDrive()),
    oversample: "4x",
  });
  const level = new GainNode(context, { gain: 0.35 + 0.65 * strength });

  source.connect(tone).connect(drive).connect(level).connect(destination);
  source.start(startAt);
  source.stop(startAt + recording.duration);
}

/** 무게감을 더하는 낮은 소리입니다. 음높이가 내려가며 0.32초 동안 납니다. */
function thump(
  { context, destination, startAt }: SoundOutput,
  strength: number,
) {
  const duration = 0.32;
  const body = new OscillatorNode(context, { type: "sine" });
  const envelope = new GainNode(context, { gain: 0 });
  const from = 110 - 45 * strength;

  body.frequency.setValueAtTime(from, startAt);
  body.frequency.exponentialRampToValueAtTime(from * 0.4, startAt + duration);
  envelope.gain.setValueAtTime(0, startAt);
  envelope.gain.linearRampToValueAtTime(
    0.65 * THUMP_LEVEL * (0.3 + 0.7 * strength),
    startAt + 0.004,
  );
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  body.connect(envelope).connect(destination);
  body.start(startAt);
  body.stop(startAt + duration);
}

function play(
  { context, destination, startAt }: SoundOutput,
  recording: AudioBuffer,
  gain: number,
) {
  const source = new AudioBufferSourceNode(context, { buffer: recording });

  source.connect(new GainNode(context, { gain })).connect(destination);
  source.start(startAt);
  source.stop(startAt + recording.duration);
}

/** 최대값이 1 인 녹음을 받아, 최대값은 STRIKE_PEAK 로 두고 작은 값일수록 크게 끌어올립니다. */
function curveOfDrive(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(2049);

  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;

    curve[i] = (STRIKE_PEAK * Math.tanh(DRIVE * x)) / Math.tanh(DRIVE);
  }

  return curve;
}
