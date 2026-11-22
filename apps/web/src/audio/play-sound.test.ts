import { afterEach, describe, expect, it, vi } from "vitest";

import type { Sound, SoundOutput } from "./play-sound";

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
    readonly destination = { name: "speakers" };

    constructor() {
      opened.push(this);
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

  it("지금 시각에 스피커로 소리를 보낸다", async () => {
    const opened = installFakeAudio({
      initialState: "running",
      resume: "succeeds",
    });
    const { sound, heard } = recordingSound();
    const playSound = await importFreshPlaySound();

    playSound(sound);

    const [context] = opened;

    expect(opened).toHaveLength(1);
    expect(heard).toEqual([
      { context, destination: context?.destination, startAt: 1.25 },
    ]);
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

  it("멈춰 있던 AudioContext 는 다시 켠 뒤 그 시각에 소리를 낸다", async () => {
    installFakeAudio({ initialState: "suspended", resume: "succeeds" });
    const { sound, heard } = recordingSound();
    const playSound = await importFreshPlaySound();

    playSound(sound);
    await flushPromises();

    expect(heard.map((output) => output.startAt)).toEqual([2.5]);
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
