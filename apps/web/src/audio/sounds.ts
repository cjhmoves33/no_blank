import type { Sound } from "./play-sound";

// TODO(you): Claude 가 쓴 초안입니다. 귀로 들으며 고치거나, 직접 만든 소리로 바꿔 주세요.
//  - 세 층으로 나눴습니다. 가죽을 때리는 순간음(slap), 무게감을 주는 몸통(thump), 뒤따르는 사슬 소리(rattle)입니다.
//    체육관 울림은 play-sound.ts 가 모든 효과음에 함께 입힙니다.
//  - strength(타격 세기, 0~1)가 클수록 크고, 순간음은 밝고, 몸통은 깊습니다. 세기가 0 이어도 작게 납니다.
//  - 타격마다 음높이와 음량을 조금씩 바꿔 같은 소리가 되풀이되지 않게 합니다.
export function strikeSound(strength: number): Sound {
  return (output) => {
    const hit: Hit = {
      ...output,
      strength,
      level: (0.3 + 0.5 * strength) * decibels(spread(1.5)),
      pitch: 1 + spread(0.04),
    };

    slap(hit);
    thump(hit);
    rattle(hit);
  };
}

// TODO(you): Claude 가 쓴 초안입니다. 귀로 들으며 고치거나, 직접 만든 소리로 바꿔 주세요.
//  - 덜컹(느슨했던 사슬이 팽팽해지는 순간)의 "철컥" 소리입니다. 고리들이 한꺼번에 당겨지는 둔한 쇳소리(clank)에 짤랑거림(clink)이 뒤따릅니다.
//  - strength(덜컹의 세기, 0~1)가 클수록 크고 짤랑거림이 많습니다.
export function chainSound(strength: number): Sound {
  return (output) => {
    const hit: Hit = {
      ...output,
      strength,
      level: (0.25 + 0.45 * strength) * decibels(spread(1.5)),
      pitch: 1 + spread(0.06),
    };
    const clinks = 1 + Math.round(3 * strength);

    clank(hit);

    for (let i = 0; i < clinks; i++) {
      clink(hit, 0.02 + Math.random() * 0.12);
    }
  };
}

interface Hit {
  readonly context: BaseAudioContext;
  readonly destination: AudioNode;
  readonly startAt: number;
  readonly strength: number;
  /** 이 타격의 음량 배율입니다. */
  readonly level: number;
  /** 이 타격의 음높이 배율입니다. */
  readonly pitch: number;
}

const noiseByContext = new WeakMap<BaseAudioContext, AudioBuffer>();

/** 가죽을 때리는 짧고 날카로운 소리입니다. 걸러 낸 잡음을 15 ms 동안 냅니다. */
function slap({ context, destination, startAt, strength, level, pitch }: Hit) {
  const duration = 0.015;
  const source = new AudioBufferSourceNode(context, {
    buffer: noiseOf(context),
  });
  const tone = new BiquadFilterNode(context, {
    type: "bandpass",
    frequency: (1600 + 2600 * strength) * pitch,
    Q: 0.8,
  });
  const envelope = new GainNode(context, { gain: 0 });

  envelope.gain.setValueAtTime(0, startAt);
  envelope.gain.linearRampToValueAtTime(0.5 * level, startAt + 0.001);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  source.connect(tone).connect(envelope).connect(destination);
  source.start(startAt);
  source.stop(startAt + duration);
}

/** 무게감을 주는 낮은 소리입니다. 음높이가 내려가며 0.22초 동안 납니다. */
function thump({ context, destination, startAt, strength, level, pitch }: Hit) {
  const duration = 0.22;
  const body = new OscillatorNode(context, { type: "sine" });
  const envelope = new GainNode(context, { gain: 0 });
  const from = (140 - 45 * strength) * pitch;

  body.frequency.setValueAtTime(from, startAt);
  body.frequency.exponentialRampToValueAtTime(from * 0.45, startAt + duration);
  envelope.gain.setValueAtTime(0, startAt);
  envelope.gain.linearRampToValueAtTime(0.55 * level, startAt + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  body.connect(envelope).connect(destination);
  body.start(startAt);
  body.stop(startAt + duration);
}

/** 고리들이 한꺼번에 당겨지며 부딪치는 둔한 쇳소리입니다. 걸러 낸 잡음에 짧은 금속 울림을 겹칩니다. */
function clank({ context, destination, startAt, level, pitch }: Hit) {
  const duration = 0.07;
  const source = new AudioBufferSourceNode(context, {
    buffer: noiseOf(context),
  });
  const tone = new BiquadFilterNode(context, {
    type: "bandpass",
    frequency: 900 * pitch,
    Q: 2.5,
  });
  const ring = new OscillatorNode(context, {
    type: "triangle",
    frequency: 620 * pitch,
  });
  const envelope = new GainNode(context, { gain: 0 });
  const ringEnvelope = new GainNode(context, { gain: 0 });

  envelope.gain.setValueAtTime(0, startAt);
  envelope.gain.linearRampToValueAtTime(0.5 * level, startAt + 0.002);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  ringEnvelope.gain.setValueAtTime(0, startAt);
  ringEnvelope.gain.linearRampToValueAtTime(0.12 * level, startAt + 0.002);
  ringEnvelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  source.connect(tone).connect(envelope).connect(destination);
  ring.connect(ringEnvelope).connect(destination);
  source.start(startAt);
  source.stop(startAt + duration);
  ring.start(startAt);
  ring.stop(startAt + duration);
}

/** 타격 뒤 0.05~0.25초 사이에 사슬 고리가 부딪치는 짤랑거림입니다. 센 타격일수록 많이 부딪칩니다. */
function rattle(hit: Hit) {
  const clinks = 2 + Math.round(4 * hit.strength);

  for (let i = 0; i < clinks; i++) {
    clink(hit, 0.05 + Math.random() * 0.2);
  }
}

function clink(
  { context, destination, startAt, level, pitch }: Hit,
  after: number,
) {
  const at = startAt + after;
  const duration = 0.035;
  const source = new AudioBufferSourceNode(context, {
    buffer: noiseOf(context),
  });
  const ring = new BiquadFilterNode(context, {
    type: "bandpass",
    frequency: (3200 + Math.random() * 2800) * pitch,
    Q: 14,
  });
  const envelope = new GainNode(context, { gain: 0 });

  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(0.35 * level, at + 0.001);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(ring).connect(envelope).connect(destination);
  source.start(at, Math.random() * 0.05);
  source.stop(at + duration);
}

/** 순간음과 사슬 소리가 함께 쓰는 0.1초짜리 흰 잡음입니다. AudioContext 마다 한 번만 만듭니다. */
function noiseOf(context: BaseAudioContext): AudioBuffer {
  const cached = noiseByContext.get(context);

  if (cached) {
    return cached;
  }

  const noise = new AudioBuffer({
    length: Math.round(0.1 * context.sampleRate),
    sampleRate: context.sampleRate,
  });
  const samples = noise.getChannelData(0);

  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.random() * 2 - 1;
  }

  noiseByContext.set(context, noise);

  return noise;
}

/** -width 에서 width 사이의 고른 난수입니다. */
function spread(width: number): number {
  return (Math.random() * 2 - 1) * width;
}

function decibels(db: number): number {
  return 10 ** (db / 20);
}
