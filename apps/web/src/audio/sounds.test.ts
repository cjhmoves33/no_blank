import { afterEach, describe, expect, it, vi } from "vitest";

interface Played {
  /** 녹음이면 그 파일 경로, 코드로 만든 소리면 "합성음"입니다. */
  readonly what: string;
  readonly at: number;
}

function installFakeAudio({ files }: { files: "available" | "missing" }) {
  const played: Played[] = [];
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
    constructor(_context: unknown, options?: { buffer?: { path: string } }) {
      super();
      this.buffer = options?.buffer;
    }

    start(at = 0): void {
      const path =
        this.buffer && typeof this.buffer === "object" && "path" in this.buffer
          ? String(this.buffer.path)
          : "잡음";

      played.push({ what: path, at });
    }

    stop(): void {}
  }

  class FakeOscillator extends FakeNode {
    start(at = 0): void {
      played.push({ what: "합성음", at });
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

  /** 받은 바이트(파일 경로)를 그대로 이름으로 가진 녹음을 돌려줍니다. */
  class FakeOfflineAudioContext {
    decodeAudioData(bytes: ArrayBuffer): Promise<{ path: string }> {
      return Promise.resolve({ path: new TextDecoder().decode(bytes) });
    }
  }

  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
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

  return { played, requested };
}

async function importFreshAudio() {
  vi.resetModules();
  const [{ playSound }, { strikeSound, chainSound }, { loadRecordings }] =
    await Promise.all([
      import("./play-sound"),
      import("./sounds"),
      import("./recordings"),
    ]);

  return { playSound, strikeSound, chainSound, loadRecordings };
}

function recordingsIn(played: Played[]): string[] {
  return played
    .map((sound) => sound.what)
    .filter((what) => what.startsWith("/sounds/strike"));
}

describe("타격음과 덜컹 소리", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("소리 파일을 불러오기 전에 친 타격과 덜컹은 아무 소리도 내지 않는다", async () => {
    const { played } = installFakeAudio({ files: "available" });
    const audio = await importFreshAudio();

    audio.playSound(audio.strikeSound(0.4));
    audio.playSound(audio.chainSound(0.4));

    expect(played).toEqual([]);
  });

  it("약하게 치면 가장 조용한 녹음을, 세게 치면 가장 큰 녹음을 낸다", async () => {
    const { played } = installFakeAudio({ files: "available" });
    const audio = await importFreshAudio();

    await audio.loadRecordings();
    audio.playSound(audio.strikeSound(0));
    audio.playSound(audio.strikeSound(1));

    expect(recordingsIn(played)).toEqual([
      "/sounds/strike-1.flac",
      "/sounds/strike-5.flac",
    ]);
  });

  it("같은 세기로 연달아 치면 그 세기에 가까운 두 녹음을 번갈아 내고, 같은 녹음을 연달아 내지 않는다", async () => {
    const { played } = installFakeAudio({ files: "available" });
    const audio = await importFreshAudio();

    await audio.loadRecordings();

    for (let i = 0; i < 4; i++) {
      audio.playSound(audio.strikeSound(0.5));
    }

    expect(recordingsIn(played)).toEqual([
      "/sounds/strike-3.flac",
      "/sounds/strike-4.flac",
      "/sounds/strike-3.flac",
      "/sounds/strike-4.flac",
    ]);
  });

  it("타격음에는 낮은 합성음이 함께 나고, 0.05~0.25초 뒤에 사슬이 한 번 짤랑인다", async () => {
    const { played } = installFakeAudio({ files: "available" });
    const audio = await importFreshAudio();

    await audio.loadRecordings();
    audio.playSound(audio.strikeSound(0.4));

    const strike = played.find((sound) =>
      sound.what.startsWith("/sounds/strike"),
    );
    const chains = played.filter(
      (sound) => sound.what === "/sounds/chain.flac",
    );
    const synthesized = played.filter((sound) => sound.what === "합성음");

    expect(synthesized.map((sound) => sound.at)).toEqual([strike?.at]);
    expect(chains).toHaveLength(1);
    expect((chains[0]?.at ?? 0) - (strike?.at ?? 0)).toBeGreaterThanOrEqual(
      0.05,
    );
    expect((chains[0]?.at ?? 0) - (strike?.at ?? 0)).toBeLessThanOrEqual(0.25);
  });

  it("덜컹은 사슬 녹음만 낸다", async () => {
    const { played } = installFakeAudio({ files: "available" });
    const audio = await importFreshAudio();

    await audio.loadRecordings();
    audio.playSound(audio.chainSound(0.5));

    expect(played.map((sound) => sound.what)).toEqual(["/sounds/chain.flac"]);
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

  it("소리 파일을 받지 못하면 처리되지 않은 오류를 남기지 않고, 타격은 소리 없이 지나간다", async () => {
    const { played } = installFakeAudio({ files: "missing" });
    const audio = await importFreshAudio();
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

    expect(played).toEqual([]);
    expect(unhandled).toEqual([]);
  });
});
