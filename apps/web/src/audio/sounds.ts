import type { Sound, SoundOutput } from "./play-sound";
import { loadedRecordings } from "./recordings";

const STRIKE_PEAK = 10 ** (-9 / 20);
// 일부러 강하게 찌그러뜨립니다. 사용자가 깨끗한 녹음과 견주어 듣고 고른 값입니다(docs/research/strike-sound.md).
const DRIVE = 28.4;
const THUMP_PEAK = 0.455;

let previousTake: number | undefined;
let driveCurve: Float32Array<ArrayBuffer> | undefined;

export function strikeSound(strength: number): Sound {
  return (output) => {
    const recordings = loadedRecordings();

    if (!recordings) {
      return;
    }

    const takes = recordings.strikesQuietToLoud;
    const take = takeFor(strength, {
      count: takes.length,
      previous: previousTake,
    });
    const recording = takes[take];

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

export function joltSound(strength: number): Sound {
  return (output) => {
    const recordings = loadedRecordings();

    if (!recordings) {
      return;
    }

    play(output, recordings.chain, (0.3 + 0.7 * strength) * STRIKE_PEAK);
  };
}

function takeFor(
  strength: number,
  { count, previous }: { count: number; previous: number | undefined },
): number {
  const position = strength * (count - 1);
  const lower = Math.max(0, Math.min(Math.floor(position), count - 2));
  const nearer = position - lower <= 0.5 ? lower : lower + 1;
  const other = nearer === lower ? lower + 1 : lower;

  return nearer === previous ? other : nearer;
}

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
    THUMP_PEAK * (0.3 + 0.7 * strength),
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

function curveOfDrive(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(2049);

  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;

    curve[i] = (STRIKE_PEAK * Math.tanh(DRIVE * x)) / Math.tanh(DRIVE);
  }

  return curve;
}
