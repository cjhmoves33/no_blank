import { afterEach, describe, expect, it, vi } from "vitest";

interface PlayedRecording {
  readonly path: string;
  readonly at: number;
}

function installFakeAudio({ files }: { files: "available" | "missing" }) {
  const recordings: PlayedRecording[] = [];
  const synthesized: number[] = [];
  const requested: string[] = [];

  class FakeParam {
    value = 0;

    setValueAtTime(): this {
      return this;
    }

    linearRampToValueAtTime(): this {
      return this;
    }

    exponentialRampToValueAtTime(): this {
      return this;
    }
  }

  class FakeNode {
    readonly gain = new FakeParam();
    readonly frequency = new FakeParam();
    buffer: unknown = null;

    connect<T>(target: T): T {
      return target;
    }
  }

  class FakeBufferSource extends FakeNode {
    private readonly path: string;

    constructor(_context: unknown, { buffer }: { buffer: { path: string } }) {
      super();
      this.path = buffer.path;
    }

    start(at = 0): void {
      recordings.push({ path: this.path, at });
    }

    stop(): void {}
  }

  class FakeOscillator extends FakeNode {
    start(at = 0): void {
      synthesized.push(at);
    }

    stop(): void {}
  }

  class FakeAudioContext {
    readonly state = "running";
    readonly currentTime = 1.25;
    readonly sampleRate = 8000;
    readonly destination = new FakeNode();

    createGain(): FakeNode {
      return new FakeNode();
    }

    createConvolver(): FakeNode {
      return new FakeNode();
    }

    createBuffer(channels: number, length: number) {
      return {
        numberOfChannels: channels,
        getChannelData: () => new Float32Array(length),
      };
    }
  }

  class DecoderReturningPath {
    decodeAudioData(bytes: ArrayBuffer): Promise<{ path: string }> {
      return Promise.resolve({ path: new TextDecoder().decode(bytes) });
    }
  }

  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("OfflineAudioContext", DecoderReturningPath);
  vi.stubGlobal("AudioBufferSourceNode", FakeBufferSource);
  vi.stubGlobal("OscillatorNode", FakeOscillator);
  vi.stubGlobal("GainNode", FakeNode);
  vi.stubGlobal("BiquadFilterNode", FakeNode);
  vi.stubGlobal("WaveShaperNode", FakeNode);
  vi.stubGlobal("fetch", (path: string) => {
    requested.push(path);

    return Promise.resolve(
      files === "available"
        ? new Response(path)
        : new Response(null, { status: 404 }),
    );
  });

  return { recordings, synthesized, requested };
}

async function importFreshAudio() {
  vi.resetModules();
  const [{ playSound }, { strikeSound, joltSound }, { loadRecordings }] =
    await Promise.all([
      import("./play-sound"),
      import("./sounds"),
      import("./recordings"),
    ]);

  return { playSound, strikeSound, joltSound, loadRecordings };
}

function strikesIn(recordings: PlayedRecording[]): string[] {
  return recordings
    .map((recording) => recording.path)
    .filter((path) => path.startsWith("/sounds/strike"));
}

describe("타격음과 덜컹 소리", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("소리 파일을 불러오기 전에 친 타격과 덜컹은 아무 소리도 내지 않는다", async () => {
    const { recordings, synthesized } = installFakeAudio({
      files: "available",
    });
    const audio = await importFreshAudio();

    audio.playSound(audio.strikeSound(0.4));
    audio.playSound(audio.joltSound(0.4));

    expect(recordings).toEqual([]);
    expect(synthesized).toEqual([]);
  });

  it("약하게 치면 가장 조용한 녹음을, 세게 치면 가장 큰 녹음을 낸다", async () => {
    const { recordings } = installFakeAudio({ files: "available" });
    const audio = await importFreshAudio();

    await audio.loadRecordings();
    audio.playSound(audio.strikeSound(0));
    audio.playSound(audio.strikeSound(1));

    expect(strikesIn(recordings)).toEqual([
      "/sounds/strike-1.flac",
      "/sounds/strike-5.flac",
    ]);
  });

  it("같은 세기로 연달아 치면 그 세기에 가까운 두 녹음을 번갈아 내고, 같은 녹음을 연달아 내지 않는다", async () => {
    const { recordings } = installFakeAudio({ files: "available" });
    const audio = await importFreshAudio();

    await audio.loadRecordings();

    for (let i = 0; i < 4; i++) {
      audio.playSound(audio.strikeSound(0.5));
    }

    expect(strikesIn(recordings)).toEqual([
      "/sounds/strike-3.flac",
      "/sounds/strike-4.flac",
      "/sounds/strike-3.flac",
      "/sounds/strike-4.flac",
    ]);
  });

  it("타격음에는 낮은 합성음이 함께 나고, 0.05~0.25초 뒤에 사슬이 한 번 짤랑인다", async () => {
    const { recordings, synthesized } = installFakeAudio({
      files: "available",
    });
    const audio = await importFreshAudio();

    await audio.loadRecordings();
    audio.playSound(audio.strikeSound(0.4));

    const strikeAt =
      recordings.find((recording) =>
        recording.path.startsWith("/sounds/strike"),
      )?.at ?? Number.NaN;
    const chainDelays = recordings
      .filter((recording) => recording.path === "/sounds/chain.flac")
      .map((recording) => recording.at - strikeAt);

    expect(synthesized).toEqual([strikeAt]);
    expect(chainDelays).toHaveLength(1);
    expect(chainDelays[0]).toBeGreaterThanOrEqual(0.05);
    expect(chainDelays[0]).toBeLessThanOrEqual(0.25);
  });

  it("덜컹은 사슬 녹음만 낸다", async () => {
    const { recordings, synthesized } = installFakeAudio({
      files: "available",
    });
    const audio = await importFreshAudio();

    await audio.loadRecordings();
    audio.playSound(audio.joltSound(0.5));

    expect(recordings.map((recording) => recording.path)).toEqual([
      "/sounds/chain.flac",
    ]);
    expect(synthesized).toEqual([]);
  });

  it("여러 번 불러도 소리 파일은 한 번씩만 받는다", async () => {
    const { requested } = installFakeAudio({ files: "available" });
    const audio = await importFreshAudio();

    await Promise.all([audio.loadRecordings(), audio.loadRecordings()]);

    expect([...requested].sort()).toEqual([
      "/sounds/chain.flac",
      "/sounds/strike-1.flac",
      "/sounds/strike-2.flac",
      "/sounds/strike-3.flac",
      "/sounds/strike-4.flac",
      "/sounds/strike-5.flac",
    ]);
  });

  it("소리 파일을 받지 못하면 콘솔에 오류를 한 번 남기고, 처리되지 않은 오류 없이 타격은 소리 없이 지나간다", async () => {
    const { recordings, synthesized } = installFakeAudio({ files: "missing" });
    const audio = await importFreshAudio();
    const reported = vi.spyOn(console, "error").mockImplementation(() => {});
    const unhandled: unknown[] = [];
    const recordUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };

    process.on("unhandledRejection", recordUnhandled);
    await audio.loadRecordings();
    audio.playSound(audio.strikeSound(0.4));
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    process.off("unhandledRejection", recordUnhandled);

    expect(recordings).toEqual([]);
    expect(synthesized).toEqual([]);
    expect(reported).toHaveBeenCalledOnce();
    expect(unhandled).toEqual([]);
  });
});
