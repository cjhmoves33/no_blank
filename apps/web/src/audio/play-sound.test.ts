import { afterEach, describe, expect, it, vi } from "vitest";

import type { Sound, SoundOutput } from "./play-sound";

/** 어디로 이어졌는지만 기억하는 가짜 노드입니다. */
class FakeNode {
  readonly connections: FakeNode[] = [];
  readonly gain = { value: 1 };
  buffer: unknown = null;

  constructor(readonly name: string) {}

  connect(target: FakeNode): FakeNode {
    this.connections.push(target);

    return target;
  }
}

function installFakeAudio({
  initialState,
  resume,
}: {
  initialState: AudioContextState;
  resume: "succeeds" | "fails";
}) {
  const opened: FakeAudioContext[] = [];

  class FakeAudioContext {
    state = initialState;
    currentTime = 1.25;
    readonly sampleRate = 8000;
    readonly destination = new FakeNode("speakers");

    constructor() {
      opened.push(this);
    }

    createGain(): FakeNode {
      return new FakeNode("gain");
    }

    createConvolver(): FakeNode {
      return new FakeNode("echo");
    }

    createBuffer(channels: number, length: number) {
      return {
        numberOfChannels: channels,
        getChannelData: () => new Float32Array(length),
      };
    }

    resume(): Promise<void> {
      if (resume === "fails") {
        return Promise.reject(new Error("사용자 입력 없이는 켤 수 없습니다"));
      }

      this.state = "running";
      this.currentTime = 2.5;

      return Promise.resolve();
    }
  }

  vi.stubGlobal("AudioContext", FakeAudioContext);

  return opened;
}

function recordingSound(): { sound: Sound; heard: SoundOutput[] } {
  const heard: SoundOutput[] = [];

  return {
    sound: (output) => {
      heard.push(output);
    },
    heard,
  };
}

/** from 에서 이어진 길을 따라가며, 스피커에 닿는 길마다 거쳐 간 노드 이름을 모읍니다. */
function routesToSpeakers(from: unknown): string[][] {
  if (!(from instanceof FakeNode)) {
    return [];
  }

  if (from.name === "speakers") {
    return [[]];
  }

  return from.connections.flatMap((next) =>
    routesToSpeakers(next).map((route) => [from.name, ...route]),
  );
}

async function importFreshPlaySound() {
  vi.resetModules();
  const { playSound } = await import("./play-sound");

  return playSound;
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("playSound", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("처음 재생하기 전에는 AudioContext 를 만들지 않는다", async () => {
    const opened = installFakeAudio({
      initialState: "suspended",
      resume: "succeeds",
    });

    await importFreshPlaySound();

    expect(opened).toEqual([]);
  });

  it("소리는 곧바로, 그리고 체육관 울림을 거쳐 스피커로 간다", async () => {
    installFakeAudio({ initialState: "running", resume: "succeeds" });
    const { sound, heard } = recordingSound();
    const playSound = await importFreshPlaySound();

    playSound(sound);

    expect(routesToSpeakers(heard[0]?.destination)).toEqual([
      ["gain"],
      ["gain", "echo", "gain"],
    ]);
  });

  it("처음 재생만 조금 늦게 예약해 앞부분이 잘리지 않게 하고, 그다음부터는 지금 시각에 낸다", async () => {
    installFakeAudio({ initialState: "running", resume: "succeeds" });
    const { sound, heard } = recordingSound();
    const playSound = await importFreshPlaySound();

    playSound(sound);
    playSound(sound);
    playSound(sound);

    expect(heard.map((output) => output.startAt)).toEqual([1.28, 1.25, 1.25]);
  });

  it("여러 번 재생해도 AudioContext 는 하나만 만든다", async () => {
    const opened = installFakeAudio({
      initialState: "running",
      resume: "succeeds",
    });
    const { sound, heard } = recordingSound();
    const playSound = await importFreshPlaySound();

    playSound(sound);
    playSound(sound);
    playSound(sound);

    expect(opened).toHaveLength(1);
    expect(heard).toHaveLength(3);
  });

  it("멈춰 있던 AudioContext 는 다시 켠 뒤 그 시각에 맞춰 소리를 낸다", async () => {
    installFakeAudio({ initialState: "suspended", resume: "succeeds" });
    const { sound, heard } = recordingSound();
    const playSound = await importFreshPlaySound();

    playSound(sound);
    await flushPromises();

    expect(heard.map((output) => output.startAt)).toEqual([2.53]);
  });

  it("AudioContext 를 켤 수 없으면 소리를 버리고 처리되지 않은 오류를 남기지 않는다", async () => {
    installFakeAudio({ initialState: "suspended", resume: "fails" });
    const { sound, heard } = recordingSound();
    const playSound = await importFreshPlaySound();
    const unhandled: unknown[] = [];
    const recordUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };

    process.on("unhandledRejection", recordUnhandled);
    playSound(sound);
    await flushPromises();
    process.off("unhandledRejection", recordUnhandled);

    expect(heard).toEqual([]);
    expect(unhandled).toEqual([]);
  });
});
