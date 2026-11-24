#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const HOME = path.join(tmpdir(), "no-blank-verify");
const BUILDS = path.join(HOME, "builds");
const EVIDENCE = path.join(HOME, "evidence");
const LOGS = path.join(HOME, "logs");
const STATE = path.join(HOME, "state.json");
const CHROME =
  process.env.CHROME_PATH ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const USER_DEV_PORT = 3000;
const ASSET_BRANCH = "pr-assets";
const GH =
  process.env.GH_PATH ??
  (existsSync("C:/Program Files/GitHub CLI/gh.exe")
    ? "C:/Program Files/GitHub CLI/gh.exe"
    : "gh");
const VIEWPORT = { width: 1280, height: 800 };
const FRAME_MS = 1000 / 60;
const SETTLE_FRAMES = 30;
const TAIL_FRAMES = 10;
const SCENE_TIMEOUT_MS = 10_000;
const SCENE_HOLDS = 30;
const CHANGED_DELTA = 8;
// 효과음은 실제 오디오 시계로 재생되어 같은 입력에서도 최대 진폭이 가끔 3% 안쪽으로 흔들립니다(2026-11-23, 26개 시점 5회).
const AUDIO_PEAK_RATIO = 0.05;

const ON_BALL = [0.5, 0.5];
const ON_BALL_SIDE = [0.565, 0.5];
const ON_BALL_UNDER = [0.5, 0.63];
const ON_BACKGROUND = [0.12, 0.85];
const LEFT_OF_BALL = [0.35, 0.5];
const BELOW_BALL = [0.5, 0.8];
const SWIPE_SECONDS = 0.15;
const BUTTONS = { left: 1, right: 2 };

const VIEWS = {
  home: [],
  "turned-left": [
    { drag: { from: ON_BACKGROUND, to: [0.22, 0.85], button: "right" } },
  ],
  "turned-right": [
    { drag: { from: [0.22, 0.85], to: ON_BACKGROUND, button: "right" } },
  ],
  high: [{ drag: { from: [0.12, 0.3], to: [0.12, 0.8], button: "right" } }],
  low: [{ drag: { from: [0.12, 0.8], to: [0.12, 0.3], button: "right" } }],
  near: [{ wheel: { at: ON_BACKGROUND, deltaY: -120, times: 40 } }],
  far: [{ wheel: { at: ON_BACKGROUND, deltaY: 120, times: 40 } }],
  struck: [{ press: ON_BALL }],
  "ball-drag": [
    { drag: { from: ON_BALL, to: [0.6, 0.5] } },
    { move: [0.02, 0.02] },
    { wait: 2000 },
  ],
  "left-background-drag": [
    { drag: { from: ON_BACKGROUND, to: [0.22, 0.85] } },
    { move: [0.02, 0.02] },
  ],
  swipe: [
    { drag: { from: LEFT_OF_BALL, to: ON_BALL, seconds: SWIPE_SECONDS } },
    { move: [0.02, 0.02] },
  ],
  "swipe-slow": [
    { drag: { from: LEFT_OF_BALL, to: ON_BALL, seconds: 3 } },
    { move: [0.02, 0.02] },
  ],
  "swipe-0.3s": [
    { drag: { from: LEFT_OF_BALL, to: ON_BALL, seconds: SWIPE_SECONDS } },
    { move: [0.02, 0.02] },
    { wait: 300 },
  ],
  "uppercut-0.15s": [
    { drag: { from: BELOW_BALL, to: ON_BALL, seconds: SWIPE_SECONDS } },
    { move: [0.02, 0.02] },
    { wait: 150 },
  ],
  "near-struck-side": [
    { wheel: { at: ON_BACKGROUND, deltaY: -120, times: 40 } },
    { press: ON_BALL_SIDE },
  ],
  "hover-ball": [{ move: ON_BALL }],
  orbiting: [
    {
      drag: {
        from: ON_BACKGROUND,
        to: [0.22, 0.85],
        button: "right",
        hold: true,
      },
    },
  ],
  "struck-side-0.2s": [{ press: ON_BALL_SIDE }, { wait: 200 }],
  "struck-side-0.6s": [{ press: ON_BALL_SIDE }, { wait: 600 }],
  "struck-side-1.5s": [{ press: ON_BALL_SIDE }, { wait: 1500 }],
  "struck-under": [{ press: ON_BALL_UNDER }],
  "home-later": [{ wait: 2000 }],
  "jab-side-clip": [
    { down: ON_BALL_SIDE },
    { record: 2 },
    { up: ON_BALL_SIDE },
    { record: 88 },
  ],
  "uppercut-clip": [
    { drag: { from: BELOW_BALL, to: ON_BALL, seconds: SWIPE_SECONDS } },
    { move: [0.02, 0.02] },
    { record: 120 },
  ],
  "hook-clip": [
    { drag: { from: LEFT_OF_BALL, to: ON_BALL, seconds: SWIPE_SECONDS } },
    { move: [0.02, 0.02] },
    { record: 90 },
  ],
};
const DEFAULT_VIEWS = [
  "home",
  "turned-left",
  "turned-right",
  "high",
  "low",
  "near",
  "far",
  "hover-ball",
  "jab-side-clip",
  "uppercut-clip",
  "hook-clip",
];

// 페이지의 시계와 난수를 스크립트가 쥡니다. 시간은 __verifyAdvance 로만 흐르고, 프레임은 1/60초 격자에서만 돕니다.
// 그래서 같은 입력은 화면 떨림, 먼지, 타격 뒤 사슬이 짤랑이는 시각까지 늘 같은 결과를 냅니다.
const PAGE_SETUP = `(() => {
  const frameMs = ${FRAME_MS};
  let now = 0;
  let nextFrame = frameMs;
  let seed = 1;
  let nextId = 1;
  const callbacks = new Map();

  Performance.prototype.now = function () { return now; };
  Object.defineProperty(Event.prototype, "timeStamp", { get() { return now; }, configurable: true });
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.requestAnimationFrame = (callback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => { callbacks.delete(id); };

  const runFrame = () => {
    const due = [...callbacks.values()];
    callbacks.clear();
    for (const callback of due) callback(now);
  };
  const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

  window.__verifyHold = async () => {
    runFrame();
    await nextTask();
  };
  window.__verifyAdvance = async (ms) => {
    const target = now + ms;
    while (nextFrame <= target + 1e-6) {
      now = nextFrame;
      nextFrame += frameMs;
      runFrame();
      await nextTask();
    }
    now = target;
  };

  window.__verifyAudioPeak = 0;
  const connect = AudioNode.prototype.connect;
  const taps = new WeakMap();
  AudioNode.prototype.connect = function (target, ...rest) {
    if (target instanceof AudioDestinationNode) {
      let analyser = taps.get(this.context);
      if (!analyser) {
        analyser = new AnalyserNode(this.context, { fftSize: 2048 });
        taps.set(this.context, analyser);
        const samples = new Float32Array(analyser.fftSize);
        setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          for (const value of samples) {
            window.__verifyAudioPeak = Math.max(window.__verifyAudioPeak, Math.abs(value));
          }
        }, 10);
      }
      connect.call(this, analyser);
    }
    return connect.call(this, target, ...rest);
  };
})();`;

const commands = {
  doctor,
  prepare,
  shoot,
  compare,
  diff,
  run,
  publish,
  cleanup,
};

main().catch((error) => {
  console.error(`verify: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});

async function main() {
  const [name, ...args] = process.argv.slice(2);
  const command = commands[name];

  if (!command) {
    console.log(
      `usage: verify.mjs <${Object.keys(commands).join("|")}> [args]`,
    );
    process.exitCode = 1;

    return;
  }

  await command(parseArgs(args));
}

function parseArgs(args) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const next = args[i + 1];

    if (next === undefined || next.startsWith("--")) {
      flags[arg.slice(2)] = true;
    } else {
      flags[arg.slice(2)] = next;
      i++;
    }
  }

  return { positional, flags };
}

async function doctor() {
  const major = Number(process.versions.node.split(".")[0]);
  const checks = [
    ["node >= 24 (WebSocket, zlib.crc32)", major >= 24],
    [`chrome at ${CHROME}`, existsSync(CHROME)],
    ["port 3101 free", await isPortFree(3101)],
    ["port 3102 free", await isPortFree(3102)],
  ];

  for (const [label, ok] of checks) {
    console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  }

  console.log(
    `info port ${USER_DEV_PORT}: ${(await isPortFree(USER_DEV_PORT)) ? "free" : "in use (the user's dev server; never touched)"}`,
  );

  const state = readState();

  for (const server of state.servers) {
    console.log(
      `info started server pid ${server.pid} on port ${server.port} (${isAlive(server.pid) ? "alive" : "gone"})`,
    );
  }

  for (const chrome of state.chromes) {
    console.log(
      `info started chrome pid ${chrome.pid} (${isAlive(chrome.pid) ? "alive" : "gone"})`,
    );
  }

  for (const build of listBuilds()) {
    console.log(
      `info build ${build.name}: ${build.ref} @ ${build.commit.slice(0, 7)}, ${build.built ? "built" : "NOT built"} (${build.dir})`,
    );
  }

  console.log(`info evidence: ${EVIDENCE}`);

  if (checks.some(([, ok]) => !ok)) {
    process.exitCode = 1;
  }
}

async function prepare({ positional }) {
  const [name, ref] = positional;

  if (!name || !ref) {
    throw new Error("usage: prepare <name> <git-ref | WORKTREE>");
  }

  prepareBuild(name, ref);
}

function prepareBuild(name, ref) {
  const commit =
    ref === "WORKTREE"
      ? snapshotWorkingTree()
      : git(["rev-parse", "--verify", `${ref}^{commit}`]);
  const dir = path.join(BUILDS, name);

  removeBuild(name);
  mkdirSync(BUILDS, { recursive: true });
  git(["worktree", "add", "--detach", dir, commit]);
  console.log(`prepare ${name}: ${ref} @ ${commit.slice(0, 7)} -> ${dir}`);
  exec("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], dir, {
    HUSKY: "0",
  });
  exec("pnpm", ["--filter", "@no-blank/web", "build"], dir);
  writeFileSync(
    path.join(dir, ".verify-build.json"),
    JSON.stringify({ name, ref, commit, builtAt: new Date().toISOString() }),
  );

  return dir;
}

function snapshotWorkingTree() {
  const index = path.join(HOME, "snapshot.index");
  const env = { GIT_INDEX_FILE: index };

  mkdirSync(HOME, { recursive: true });
  rmSync(index, { force: true });
  git(["read-tree", "HEAD"], env);
  git(["add", "-A"], env);

  const tree = git(["write-tree"], env);
  const commit = git([
    "commit-tree",
    tree,
    "-p",
    "HEAD",
    "-m",
    "verify: working tree snapshot",
  ]);

  rmSync(index, { force: true });

  return commit;
}

function listBuilds() {
  if (!existsSync(BUILDS)) {
    return [];
  }

  return readdirSync(BUILDS).map((name) => {
    const dir = path.join(BUILDS, name);
    const metaFile = path.join(dir, ".verify-build.json");
    const meta = existsSync(metaFile)
      ? JSON.parse(readFileSync(metaFile, "utf8"))
      : { ref: "?", commit: "?" };

    return { name, dir, ...meta, built: existsSync(metaFile) };
  });
}

function removeBuild(name) {
  const dir = path.join(BUILDS, name);

  if (!existsSync(dir)) {
    return;
  }

  spawnSync("git", ["worktree", "remove", "--force", dir], { cwd: REPO });

  if (existsSync(dir)) {
    // pnpm 의 node_modules 는 junction 이라 git 이 지우지 못합니다. rmdir /s 는 junction 너머로 들어가지 않습니다.
    if (process.platform === "win32") {
      spawnSync("cmd", ["/c", "rmdir", "/s", "/q", dir]);
    } else {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  git(["worktree", "prune"]);
}

async function shoot({ positional, flags }) {
  const [name] = positional;

  if (!name) {
    throw new Error(
      "usage: shoot <name> [--port 3101] [--views a,b] [--reduced-motion] [--no-webgl] [--out dir]",
    );
  }

  const out = flags.out ?? path.join(EVIDENCE, `${stamp()}-${name}`);

  await shootBuild(name, {
    port: Number(flags.port ?? 3101),
    views: parseViews(flags.views),
    motion: flags["reduced-motion"] !== true,
    webgl: flags["no-webgl"] !== true,
    out,
  });
  console.log(`shoot ${name}: ${out}`);
}

function parseViews(value) {
  const names = typeof value === "string" ? value.split(",") : DEFAULT_VIEWS;

  for (const name of names) {
    if (!(name in VIEWS)) {
      throw new Error(
        `unknown view "${name}". known: ${Object.keys(VIEWS).join(", ")}`,
      );
    }
  }

  return names;
}

async function shootBuild(name, { port, views, motion, webgl, out }) {
  const build = listBuilds().find((candidate) => candidate.name === name);

  if (!build?.built) {
    throw new Error(
      `build "${name}" is not prepared. run: prepare ${name} <ref>`,
    );
  }

  mkdirSync(out, { recursive: true });

  const server = await startServer(build.dir, port);

  try {
    const chrome = await startChrome(port, { webgl });

    try {
      for (const view of views) {
        const meta = await shootView(chrome.cdp, {
          url: `http://localhost:${port}/`,
          view,
          motion,
          webgl,
          out,
        });

        writeFileSync(
          path.join(out, `${view}.json`),
          JSON.stringify(
            { build: name, commit: build.commit, motion, webgl, ...meta },
            null,
            2,
          ),
        );
        console.log(
          `  ${view}: scene=${meta.scene} canvas=${meta.canvas} frames=${meta.frames} audioPeak=${meta.audioPeak.toFixed(3)} errors=${meta.errors.length}`,
        );
      }
    } finally {
      await stopChrome(chrome);
    }
  } finally {
    stopServer(server);
  }
}

async function startServer(buildDir, port) {
  if (port === USER_DEV_PORT) {
    throw new Error(`port ${USER_DEV_PORT} belongs to the user's dev server`);
  }

  if (!(await isPortFree(port))) {
    throw new Error(`port ${port} is in use; run doctor, then cleanup`);
  }

  const webDir = path.join(buildDir, "apps/web");
  const nextBin = path.join(webDir, "node_modules/next/dist/bin/next");

  mkdirSync(LOGS, { recursive: true });

  const log = openSync(path.join(LOGS, `server-${port}.log`), "w");
  const child = spawn(
    process.execPath,
    [nextBin, "start", "-p", String(port)],
    {
      cwd: webDir,
      stdio: ["ignore", log, log],
    },
  );

  closeSync(log);
  remember("servers", { pid: child.pid, port });

  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${port}/`);

      if (response.ok && (await response.text()).includes("<canvas")) {
        return { pid: child.pid, port };
      }
    } catch {}

    await sleep(300);
  }

  stopServer({ pid: child.pid, port });
  throw new Error(`server on ${port} never served the scene; see ${LOGS}`);
}

function stopServer(server) {
  killTree(server.pid);
  forget("servers", server.pid);
}

async function startChrome(port, { webgl }) {
  const profile = path.join(HOME, `chrome-profile-${port}`);

  rmSync(profile, { recursive: true, force: true });

  const args = [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    ...(webgl ? [] : ["--disable-3d-apis"]),
    "about:blank",
  ];
  const child = spawn(CHROME, args, { stdio: "ignore" });

  remember("chromes", { pid: child.pid, profile });

  const portFile = path.join(profile, "DevToolsActivePort");
  const deadline = Date.now() + 20_000;

  while (!existsSync(portFile) && Date.now() < deadline) {
    await sleep(100);
  }

  const debugPort = readFileSync(portFile, "utf8").split("\n")[0];
  const targets = await (
    await fetch(`http://127.0.0.1:${debugPort}/json/list`)
  ).json();
  const page = targets.find((target) => target.type === "page");
  const cdp = await connect(page.webSocketDebuggerUrl);

  return { pid: child.pid, profile, cdp };
}

async function stopChrome(chrome) {
  try {
    await Promise.race([chrome.cdp.send("Browser.close"), sleep(3000)]);
  } catch {}

  chrome.cdp.close();
  await sleep(500);
  killTree(chrome.pid);
  rmSync(chrome.profile, { recursive: true, force: true });
  forget("chromes", chrome.pid);
}

async function shootView(cdp, { url, view, motion, webgl, out }) {
  const errors = [];
  const offConsole = cdp.on("Runtime.consoleAPICalled", ({ type, args }) => {
    if (type === "error" || type === "warning") {
      errors.push(
        `${type}: ${args.map((arg) => arg.value ?? arg.description).join(" ")}`,
      );
    }
  });
  const offException = cdp.on(
    "Runtime.exceptionThrown",
    ({ exceptionDetails }) => {
      errors.push(
        `exception: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`,
      );
    },
  );

  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    ...VIEWPORT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [
      {
        name: "prefers-reduced-motion",
        value: motion ? "no-preference" : "reduce",
      },
    ],
  });

  const { identifier } = await cdp.send(
    "Page.addScriptToEvaluateOnNewDocument",
    {
      source: PAGE_SETUP,
    },
  );
  const loaded = cdp.once("Page.loadEventFired");

  await cdp.send("Page.navigate", { url });
  await loaded;

  const scene = await waitForScene(cdp, { webgl });
  const framesDir = path.join(out, view);
  let frames = 0;

  await advance(cdp, SETTLE_FRAMES);
  rmSync(framesDir, { recursive: true, force: true });

  for (const action of VIEWS[view]) {
    if (action.record) {
      mkdirSync(framesDir, { recursive: true });

      for (let i = 0; i < action.record; i++, frames++) {
        await advance(cdp, 1);
        await screenshot(
          cdp,
          path.join(framesDir, `f${String(frames).padStart(3, "0")}.png`),
        );
      }
    } else {
      await perform(cdp, action);
    }
  }

  await advance(cdp, TAIL_FRAMES);

  const canvas = await evaluate(
    cdp,
    "document.querySelector('canvas') !== null",
  );

  await screenshot(cdp, path.join(out, `${view}.png`));
  // 효과음은 실제 시간으로 재생되므로, 진폭은 실제 시간이 조금 흐른 뒤에 읽습니다.
  await sleep(400);

  const audioPeak = await evaluate(cdp, "window.__verifyAudioPeak ?? 0");
  const cursor = await evaluate(
    cdp,
    "getComputedStyle(document.querySelector('canvas') ?? document.body).cursor",
  );

  await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  offConsole();
  offException();

  return {
    view,
    actions: VIEWS[view],
    scene,
    canvas,
    frames,
    audioPeak,
    cursor,
    errors,
  };
}

// React 는 장면을 실제 시간에 마운트합니다. 그동안 시계를 0 에 묶어 두어야 장면의 시계가 늘 같은 시각에서 시작합니다.
async function waitForScene(cdp, { webgl }) {
  const deadline = Date.now() + SCENE_TIMEOUT_MS;
  const sized = `document.querySelector('canvas')?.width === ${VIEWPORT.width}`;
  let holds = 0;

  while (Date.now() < deadline) {
    await evaluate(cdp, "window.__verifyHold()");
    await sleep(16);
    holds++;

    if (webgl ? await evaluate(cdp, sized) : holds >= SCENE_HOLDS * 2) {
      for (let i = 0; i < SCENE_HOLDS; i++) {
        await evaluate(cdp, "window.__verifyHold()");
        await sleep(16);
      }

      return webgl;
    }
  }

  return false;
}

function advance(cdp, frames) {
  return evaluate(cdp, `window.__verifyAdvance(${frames * FRAME_MS})`);
}

async function screenshot(cdp, file) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });

  writeFileSync(file, Buffer.from(data, "base64"));
}

function fractionToPixels([x, y]) {
  return {
    x: Math.round(x * VIEWPORT.width),
    y: Math.round(y * VIEWPORT.height),
  };
}

async function perform(cdp, action) {
  if (action.wait) {
    await advance(cdp, action.wait / FRAME_MS);

    return;
  }

  if (action.move) {
    await mouse(cdp, "mouseMoved", fractionToPixels(action.move), "none");

    return;
  }

  if (action.press) {
    const point = fractionToPixels(action.press);

    await mouse(cdp, "mousePressed", point, "left");
    await advance(cdp, 2);
    await mouse(cdp, "mouseReleased", point, "left", 0);

    return;
  }

  if (action.down) {
    const point = fractionToPixels(action.down);

    await mouse(cdp, "mouseMoved", point, "none");
    await mouse(cdp, "mousePressed", point, "left");

    return;
  }

  if (action.up) {
    await mouse(cdp, "mouseReleased", fractionToPixels(action.up), "left", 0);

    return;
  }

  if (action.drag) {
    const {
      from,
      to,
      button = "left",
      seconds = 0,
      hold = false,
    } = action.drag;
    const steps = 20;
    const between = (i) =>
      fractionToPixels([
        from[0] + ((to[0] - from[0]) * i) / steps,
        from[1] + ((to[1] - from[1]) * i) / steps,
      ]);

    await mouse(cdp, "mousePressed", between(0), button);

    for (let i = 1; i <= steps; i++) {
      if (seconds > 0) {
        await advance(cdp, (seconds * 1000) / steps / FRAME_MS);
      }

      await mouse(cdp, "mouseMoved", between(i), button);
    }

    if (!hold) {
      await mouse(cdp, "mouseReleased", between(steps), button, 0);
    }

    return;
  }

  if (action.wheel) {
    const center = fractionToPixels(action.wheel.at);

    for (let i = 0; i < action.wheel.times; i++) {
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseWheel",
        ...center,
        deltaX: 0,
        deltaY: action.wheel.deltaY,
      });
    }
  }
}

function mouse(cdp, type, point, button, buttons = BUTTONS[button] ?? 0) {
  return cdp.send("Input.dispatchMouseEvent", {
    type,
    ...point,
    button,
    buttons,
    clickCount: type === "mouseMoved" ? 0 : 1,
    pointerType: "mouse",
  });
}

async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (exceptionDetails) {
    throw new Error(`page script failed: ${exceptionDetails.text}`);
  }

  return result.value;
}

async function compare({ positional, flags }) {
  const [before, after] = positional;

  if (!before || !after) {
    throw new Error("usage: compare <before-dir> <after-dir> [--out dir]");
  }

  const { report } = compareDirs(
    before,
    after,
    flags.out ?? path.join(path.dirname(after), "diff"),
  );

  console.log(report);
}

async function diff({ positional }) {
  const [a, b, out] = positional;

  if (!a || !b) {
    throw new Error("usage: diff <a.png> <b.png> [out.png]");
  }

  const stats = diffImages(a, b, out);

  console.log(formatStats(stats));
}

function compareDirs(beforeDir, afterDir, outDir) {
  mkdirSync(outDir, { recursive: true });

  const views = readdirSync(afterDir)
    .filter((file) => file.endsWith(".png"))
    .map((file) => file.slice(0, -4));
  const rows = views.map((view) =>
    compareView(beforeDir, afterDir, outDir, view),
  );
  const changed = rows.filter((row) => row.changed).map((row) => row.view);
  const lines = [
    `# Before / after`,
    "",
    `- before: ${beforeDir}`,
    `- after: ${afterDir}`,
    `- diff images: ${outDir} (changed pixels in red over a dimmed after image; a clip keeps its first changed frame)`,
    "",
    "| view | changed pixels | max channel delta | frames changed | audio peak | cursor | errors |",
    "| ---- | -------------- | ----------------- | -------------- | ---------- | ------ | ------ |",
    ...rows.map(formatRow),
    "",
    changed.length ? `changed: ${changed.join(", ")}` : "changed: none",
  ];
  const report = lines.join("\n");

  writeFileSync(path.join(path.dirname(outDir), "report.md"), `${report}\n`);

  return { report, rows };
}

function compareView(beforeDir, afterDir, outDir, view) {
  const before = path.join(beforeDir, `${view}.png`);

  if (!existsSync(before)) {
    return { view, missing: true, changed: true };
  }

  const still = diffImages(
    before,
    path.join(afterDir, `${view}.png`),
    path.join(outDir, `${view}.png`),
  );
  const clip = compareClips(
    path.join(beforeDir, view),
    path.join(afterDir, view),
    path.join(outDir, view),
  );
  const signals = compareSignals(
    readMeta(beforeDir, view),
    readMeta(afterDir, view),
  );

  return {
    view,
    still,
    clip,
    signals,
    changed:
      still.changed > 0 ||
      (clip !== null && clip.changed > 0) ||
      signals.changed,
  };
}

function compareClips(beforeDir, afterDir, outPrefix) {
  const framesOf = (dir) =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((file) => file.endsWith(".png"))
          .sort()
      : [];
  const before = framesOf(beforeDir);
  const after = framesOf(afterDir);

  if (before.length === 0 && after.length === 0) {
    return null;
  }

  let changed = Math.abs(before.length - after.length);
  let first = null;

  for (const frame of after.filter((name) => before.includes(name))) {
    const out = `${outPrefix}-${frame}`;
    const stats = diffImages(
      path.join(beforeDir, frame),
      path.join(afterDir, frame),
      first === null ? out : undefined,
    );

    if (stats.changed > 0) {
      changed++;
      first ??= frame;
    } else if (first === null) {
      rmSync(out, { force: true });
    }
  }

  return { changed, count: Math.max(before.length, after.length), first };
}

function readMeta(dir, view) {
  const file = path.join(dir, `${view}.json`);

  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

function compareSignals(before, after) {
  const pair = (key) => [before[key] ?? null, after[key] ?? null];
  const audioPeak = pair("audioPeak");
  const cursor = pair("cursor");
  const canvas = pair("canvas");
  const errors = [before.errors ?? [], after.errors ?? []].map((list) =>
    [...new Set(list)].sort(),
  );
  const [peakBefore, peakAfter] = audioPeak.map((value) => value ?? 0);
  const audioChanged =
    Math.abs(peakBefore - peakAfter) >
    AUDIO_PEAK_RATIO * Math.max(peakBefore, peakAfter);

  return {
    audioPeak,
    audioChanged,
    cursor,
    canvas,
    errors: errors.map((list) => list.length),
    changed:
      audioChanged ||
      cursor[0] !== cursor[1] ||
      canvas[0] !== canvas[1] ||
      JSON.stringify(errors[0]) !== JSON.stringify(errors[1]),
  };
}

function formatRow({ view, missing, still, clip, signals }) {
  if (missing) {
    return `| ${view} | missing in before | | | | | |`;
  }

  const cell = ([before, after], format = String) =>
    before === after ? format(before) : `${format(before)} → ${format(after)}`;
  const peak = (value) => (value ?? 0).toFixed(3);
  const frames = clip
    ? `${clip.changed}/${clip.count}${clip.first ? ` (from ${clip.first.slice(0, -4)})` : ""}`
    : "";

  return `| ${view} | ${still.changed} (${still.percent.toFixed(3)}%) | ${still.maxDelta} | ${frames} | ${signals.audioChanged ? cell(signals.audioPeak, peak) : peak(signals.audioPeak[0])} | ${cell(signals.cursor)} | ${cell(signals.errors)} |`;
}

function diffImages(fileA, fileB, outFile) {
  const a = decodePng(readFileSync(fileA));
  const b = decodePng(readFileSync(fileB));

  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `size differs: ${fileA} ${a.width}x${a.height}, ${fileB} ${b.width}x${b.height}`,
    );
  }

  const { stats, image } = diffDecoded(a, b);

  if (outFile) {
    writeFileSync(outFile, encodePng(image));
  }

  return stats;
}

function diffDecoded(a, b) {
  const out = new Uint8Array(a.pixels.length);
  let changed = 0;
  let maxDelta = 0;
  let totalDelta = 0;

  for (let i = 0; i < a.pixels.length; i += 4) {
    const delta = Math.max(
      Math.abs(a.pixels[i] - b.pixels[i]),
      Math.abs(a.pixels[i + 1] - b.pixels[i + 1]),
      Math.abs(a.pixels[i + 2] - b.pixels[i + 2]),
    );
    const gray = (b.pixels[i] + b.pixels[i + 1] + b.pixels[i + 2]) / 3;

    maxDelta = Math.max(maxDelta, delta);
    totalDelta += delta;

    if (delta > CHANGED_DELTA) {
      changed++;
      out.set([255, gray * 0.2, gray * 0.2, 255], i);
    } else {
      out.set([gray * 0.35, gray * 0.35, gray * 0.35, 255], i);
    }
  }

  const pixelCount = a.pixels.length / 4;

  return {
    stats: {
      changed,
      percent: (changed / pixelCount) * 100,
      maxDelta,
      meanDelta: totalDelta / pixelCount,
    },
    image: { width: a.width, height: a.height, pixels: out },
  };
}

function formatStats(stats) {
  return `changed ${stats.changed} px (${stats.percent.toFixed(3)}%), max delta ${stats.maxDelta}, mean delta ${stats.meanDelta.toFixed(3)}`;
}

async function publish({ positional, flags }) {
  const [beforeDir, afterDir] = positional;

  if (!beforeDir || !afterDir || !flags.pr) {
    throw new Error(
      "usage: publish <before-dir> <after-dir> --pr <number> [--views a,b] [--slow N] [--dry-run]",
    );
  }

  const picked = typeof flags.views === "string";
  const views = picked
    ? flags.views.split(",")
    : readdirSync(afterDir)
        .filter((file) => file.endsWith(".png"))
        .map((file) => file.slice(0, -4));
  const { rows } = compareDirs(
    beforeDir,
    afterDir,
    path.join(path.dirname(afterDir), "diff"),
  );
  const shown = rows.filter(
    (row) => !row.missing && (picked ? views.includes(row.view) : row.changed),
  );
  const slow = Number(flags.slow ?? 1);
  const assets = [];

  if (shown.length === 0) {
    console.log(
      "no view changed; nothing to publish. Put the zero-change table from report.md in the PR body instead.",
    );

    return;
  }

  for (const { view, still, clip } of shown) {
    if (picked || still.changed > 0) {
      const before = decodePng(
        readFileSync(path.join(beforeDir, `${view}.png`)),
      );
      const after = decodePng(readFileSync(path.join(afterDir, `${view}.png`)));

      assets.push({
        view,
        file: `${view}.png`,
        alt: `${view}: before, after, diff`,
        content: encodePng(
          sideBySide([before, after, diffDecoded(before, after).image]),
        ),
      });
    }

    if (clip && (picked || clip.changed > 0)) {
      assets.push({
        view,
        file: `${view}-frames.png`,
        alt: `${view}: before, after (animated)`,
        content: clipApng(
          path.join(beforeDir, view),
          path.join(afterDir, view),
          slow,
        ),
      });
    }
  }

  if (flags["dry-run"]) {
    const preview = path.join(path.dirname(afterDir), "publish-preview");

    mkdirSync(preview, { recursive: true });

    for (const asset of assets) {
      writeFileSync(path.join(preview, asset.file), asset.content);
      console.log(
        `  ${asset.file}: ${(asset.content.length / 1024).toFixed(0)} KiB`,
      );
    }

    console.log(
      `dry run: ${assets.length} image(s) in ${preview}; nothing uploaded`,
    );

    return;
  }

  const folder = `pr-${flags.pr}/${stamp()}`;
  const commit =
    assets.length > 0
      ? uploadAssets(
          assets.map((asset) => ({
            path: `${folder}/${asset.file}`,
            content: asset.content,
          })),
          `pr #${flags.pr}: before/after screenshots`,
        )
      : null;
  const repo = gh([
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "-q",
    ".nameWithOwner",
  ]);
  const commitOf = (dir) => {
    const meta = readMeta(dir, shown[0].view);

    return meta.commit ? meta.commit.slice(0, 7) : "?";
  };
  const lines = [
    `before \`${commitOf(beforeDir)}\` → after \`${commitOf(afterDir)}\`. 정지 이미지는 왼쪽부터 before, after, 바뀐 픽셀(빨간색)이고, 움직이는 이미지(\`-frames\`)는 왼쪽이 before, 오른쪽이 after 이며 ${slow === 1 ? "실제 속도로" : `${slow}배 느리게`} 재생됩니다.`,
    "",
    "| 시점 | 바뀐 픽셀 | 바뀐 프레임 | 효과음 최대 진폭 | 커서 |",
    "| ---- | --------- | ----------- | ---------------- | ---- |",
    ...shown.map(
      ({ view, still, clip, signals }) =>
        `| ${view} | ${still.changed} (${still.percent.toFixed(3)}%) | ${clip ? `${clip.changed}/${clip.count}` : ""} | ${signals.audioPeak.map((value) => (value ?? 0).toFixed(3)).join(" → ")} | ${signals.cursor.join(" → ")} |`,
    ),
    "",
    ...assets.flatMap(({ view, file, alt }) => [
      `**${file === `${view}.png` ? view : `${view} (움직임)`}**`,
      "",
      `![${alt}](https://raw.githubusercontent.com/${repo}/${commit}/${folder}/${file})`,
      "",
    ]),
  ];

  console.log(lines.join("\n"));
}

function clipApng(beforeDir, afterDir, slow) {
  const frames = readdirSync(afterDir)
    .filter((file) => file.endsWith(".png"))
    .filter((file) => existsSync(path.join(beforeDir, file)))
    .sort()
    .map((file) =>
      sideBySide(
        [beforeDir, afterDir].map((dir) =>
          decodePng(readFileSync(path.join(dir, file))),
        ),
      ),
    );

  return encodeApng(frames, slow);
}

function sideBySide(images) {
  const halves = images.map(halve);
  const gap = 8;
  const width =
    halves.reduce((sum, image) => sum + image.width, 0) +
    gap * (halves.length - 1);
  const height = Math.max(...halves.map((image) => image.height));
  const pixels = new Uint8Array(width * height * 4).fill(40);
  let left = 0;

  for (const image of halves) {
    for (let y = 0; y < image.height; y++) {
      pixels.set(
        image.pixels.subarray(y * image.width * 4, (y + 1) * image.width * 4),
        (y * width + left) * 4,
      );
    }

    left += image.width + gap;
  }

  for (let i = 3; i < pixels.length; i += 4) {
    pixels[i] = 255;
  }

  return { width, height, pixels };
}

function halve({ width, height, pixels }) {
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  const out = new Uint8Array(halfWidth * halfHeight * 4);

  for (let y = 0; y < halfHeight; y++) {
    for (let x = 0; x < halfWidth; x++) {
      for (let channel = 0; channel < 4; channel++) {
        const at = (dy, dx) =>
          pixels[((2 * y + dy) * width + 2 * x + dx) * 4 + channel];

        out[(y * halfWidth + x) * 4 + channel] =
          (at(0, 0) + at(0, 1) + at(1, 0) + at(1, 1)) / 4;
      }
    }
  }

  return { width: halfWidth, height: halfHeight, pixels: out };
}

function uploadAssets(files, message) {
  const ref = ghApi(
    "GET",
    `repos/{owner}/{repo}/git/ref/heads/${ASSET_BRANCH}`,
  );
  const parent = ref?.object.sha;
  const baseTree = parent
    ? ghApi("GET", `repos/{owner}/{repo}/git/commits/${parent}`, null, true)
        .tree.sha
    : undefined;
  const tree = files.map((file) => ({
    path: file.path,
    mode: "100644",
    type: "blob",
    sha: ghApi(
      "POST",
      "repos/{owner}/{repo}/git/blobs",
      { content: file.content.toString("base64"), encoding: "base64" },
      true,
    ).sha,
  }));
  const treeSha = ghApi(
    "POST",
    "repos/{owner}/{repo}/git/trees",
    { ...(baseTree ? { base_tree: baseTree } : {}), tree },
    true,
  ).sha;
  const commit = ghApi(
    "POST",
    "repos/{owner}/{repo}/git/commits",
    { message, tree: treeSha, parents: parent ? [parent] : [] },
    true,
  ).sha;

  if (parent) {
    ghApi(
      "PATCH",
      `repos/{owner}/{repo}/git/refs/heads/${ASSET_BRANCH}`,
      { sha: commit },
      true,
    );
  } else {
    ghApi(
      "POST",
      "repos/{owner}/{repo}/git/refs",
      { ref: `refs/heads/${ASSET_BRANCH}`, sha: commit },
      true,
    );
  }

  return commit;
}

function ghApi(method, endpoint, body = null, required = false) {
  const input = path.join(HOME, "gh-input.json");
  const args = ["api", "--method", method, endpoint];

  if (body) {
    mkdirSync(HOME, { recursive: true });
    writeFileSync(input, JSON.stringify(body));
    args.push("--input", input);
  }

  const result = spawnSync(GH, args, {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  rmSync(input, { force: true });

  if (result.status !== 0) {
    if (required) {
      throw new Error(
        `gh api ${method} ${endpoint} failed: ${result.stderr.trim()}`,
      );
    }

    return null;
  }

  return JSON.parse(result.stdout);
}

function gh(args) {
  const result = spawnSync(GH, args, { cwd: REPO, encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(`gh ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }

  return result.stdout.trim();
}

function decodePng(buffer) {
  let offset = 8;
  let header;
  const data = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        bitDepth: body[8],
        colorType: body[9],
        interlace: body[12],
      };
    } else if (type === "IDAT") {
      data.push(body);
    } else if (type === "IEND") {
      break;
    }

    offset += 12 + length;
  }

  if (
    !header ||
    header.bitDepth !== 8 ||
    header.interlace !== 0 ||
    ![2, 6].includes(header.colorType)
  ) {
    throw new Error(
      "unsupported PNG (expected 8-bit RGB or RGBA, not interlaced)",
    );
  }

  const { width, height } = header;
  const channels = header.colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(data));
  const pixels = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = new Uint8Array(stride);

    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;

      row[x] = (line[x] + predict(filter, left, up, upLeft)) & 255;
    }

    for (let x = 0; x < width; x++) {
      const target = (y * width + x) * 4;

      pixels[target] = row[x * channels];
      pixels[target + 1] = row[x * channels + 1];
      pixels[target + 2] = row[x * channels + 2];
      pixels[target + 3] = channels === 4 ? row[x * channels + 3] : 255;
    }

    previous = row;
  }

  return { width, height, pixels };
}

function predict(filter, left, up, upLeft) {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return (left + up) >> 1;
    case 4: {
      const estimate = left + up - upLeft;
      const toLeft = Math.abs(estimate - left);
      const toUp = Math.abs(estimate - up);
      const toUpLeft = Math.abs(estimate - upLeft);

      if (toLeft <= toUp && toLeft <= toUpLeft) {
        return left;
      }

      return toUp <= toUpLeft ? up : upLeft;
    }
    default:
      throw new Error(`unknown PNG filter ${filter}`);
  }
}

function encodePng({ width, height, pixels }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    raw.set(
      pixels.subarray(y * stride, (y + 1) * stride),
      y * (stride + 1) + 1,
    );
  }

  const header = Buffer.alloc(13);

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// 256색 팔레트 APNG 입니다. 앞 프레임과 같은 픽셀은 투명색으로 두고 겹쳐 그려서(blend OVER),
// 화면 떨림으로 매 프레임 화면 전체가 바뀌어도 1초에 1MB 안팎이 됩니다(손실 없는 APNG 는 20MB).
function encodeApng(frames, slow) {
  const { width, height } = frames[0];
  const palette = medianCut(frames, 255);
  const lookup = nearestColors(palette);
  const transparent = palette.length;
  const indexed = frames.map(({ pixels }) => {
    const out = new Uint8Array(width * height);

    for (let p = 0; p < out.length; p++) {
      out[p] = lookup[colorKey(pixels, p * 4)];
    }

    return out;
  });
  const header = Buffer.alloc(13);

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 3, 0, 0, 0], 8);

  const chunks = [
    chunk("IHDR", header),
    chunk("PLTE", Buffer.from([...palette.flat(), 0, 0, 0])),
    chunk("tRNS", Buffer.from([...palette.map(() => 255), 0])),
    chunk("acTL", uint32s(frames.length, 0)),
  ];
  let sequence = 0;

  indexed.forEach((image, i) => {
    const previous = indexed[i - 1];
    const [x0, y0, x1, y1] = previous
      ? changedBox(previous, image, width, height)
      : [0, 0, width, height];
    const stride = x1 - x0 + 1;
    const raw = Buffer.alloc(stride * (y1 - y0));

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const p = y * width + x;

        raw[(y - y0) * stride + 1 + x - x0] =
          previous && previous[p] === image[p] ? transparent : image[p];
      }
    }

    const control = Buffer.alloc(26);

    control.writeUInt32BE(sequence++, 0);
    control.writeUInt32BE(x1 - x0, 4);
    control.writeUInt32BE(y1 - y0, 8);
    control.writeUInt32BE(x0, 12);
    control.writeUInt32BE(y0, 16);
    control.writeUInt16BE(slow, 20);
    control.writeUInt16BE(60, 22);
    control[25] = previous ? 1 : 0;
    chunks.push(chunk("fcTL", control));

    const data = zlib.deflateSync(raw, { level: 9 });

    chunks.push(
      previous
        ? chunk("fdAT", Buffer.concat([uint32s(sequence++), data]))
        : chunk("IDAT", data),
    );
  });

  chunks.push(chunk("IEND", Buffer.alloc(0)));

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ...chunks,
  ]);
}

function colorKey(pixels, i) {
  return (
    ((pixels[i] >> 3) << 10) |
    ((pixels[i + 1] >> 3) << 5) |
    (pixels[i + 2] >> 3)
  );
}

function medianCut(frames, size) {
  const counts = new Float64Array(32768);
  const sums = new Float64Array(32768 * 3);

  for (const { pixels } of frames) {
    for (let i = 0; i < pixels.length; i += 4) {
      const key = colorKey(pixels, i);

      counts[key]++;
      sums[key * 3] += pixels[i];
      sums[key * 3 + 1] += pixels[i + 1];
      sums[key * 3 + 2] += pixels[i + 2];
    }
  }

  const bins = [];

  for (let key = 0; key < 32768; key++) {
    if (counts[key] > 0) {
      bins.push({
        count: counts[key],
        color: [0, 1, 2].map((c) => sums[key * 3 + c] / counts[key]),
      });
    }
  }

  const boxes = [bins];
  const total = (box) => box.reduce((sum, bin) => sum + bin.count, 0);

  while (boxes.length < size) {
    let best = null;

    boxes.forEach((box, index) => {
      if (box.length < 2) {
        return;
      }

      for (let axis = 0; axis < 3; axis++) {
        const values = box.map((bin) => bin.color[axis]);
        const score =
          (Math.max(...values) - Math.min(...values)) * Math.sqrt(total(box));

        if (!best || score > best.score) {
          best = { index, axis, score };
        }
      }
    });

    if (!best) {
      break;
    }

    const box = boxes[best.index].sort(
      (a, b) => a.color[best.axis] - b.color[best.axis],
    );
    const half = total(box) / 2;
    let cut = 1;

    for (let seen = box[0].count; cut < box.length - 1 && seen < half; cut++) {
      seen += box[cut].count;
    }

    boxes.splice(best.index, 1, box.slice(0, cut), box.slice(cut));
  }

  return boxes.map((box) =>
    [0, 1, 2].map((c) =>
      Math.round(
        box.reduce((sum, bin) => sum + bin.color[c] * bin.count, 0) /
          total(box),
      ),
    ),
  );
}

function nearestColors(palette) {
  const lookup = new Uint8Array(32768);

  for (let key = 0; key < 32768; key++) {
    const color = [(key >> 10) << 3, ((key >> 5) & 31) << 3, (key & 31) << 3];
    let best = 0;
    let bestDistance = Infinity;

    palette.forEach((entry, index) => {
      const distance =
        (entry[0] - color[0] - 4) ** 2 +
        (entry[1] - color[1] - 4) ** 2 +
        (entry[2] - color[2] - 4) ** 2;

      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });

    lookup[key] = best;
  }

  return lookup;
}

function changedBox(previous, image, width, height) {
  let [x0, y0, x1, y1] = [width, height, -1, -1];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (previous[y * width + x] !== image[y * width + x]) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }

  return x1 < 0 ? [0, 0, 1, 1] : [x0, y0, x1 + 1, y1 + 1];
}

function uint32s(...values) {
  const buffer = Buffer.alloc(values.length * 4);

  values.forEach((value, i) => buffer.writeUInt32BE(value, i * 4));

  return buffer;
}

function chunk(type, body) {
  const length = Buffer.alloc(4);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(body.length);
  crc.writeUInt32BE(zlib.crc32(typed));

  return Buffer.concat([length, typed, crc]);
}

async function run({ flags }) {
  const before = flags.before ?? "origin/main";
  const after = flags.after ?? "WORKTREE";
  const views = parseViews(flags.views);
  const motion = flags["reduced-motion"] !== true;
  const webgl = flags["no-webgl"] !== true;
  const out = path.join(EVIDENCE, stamp());

  prepareBuild("before", before);
  prepareBuild("after", after);
  await shootBuild("before", {
    port: 3101,
    views,
    motion,
    webgl,
    out: path.join(out, "before"),
  });
  await shootBuild("after", {
    port: 3102,
    views,
    motion,
    webgl,
    out: path.join(out, "after"),
  });
  console.log(
    compareDirs(
      path.join(out, "before"),
      path.join(out, "after"),
      path.join(out, "diff"),
    ).report,
  );
  console.log(`\nevidence: ${out}`);
}

async function cleanup() {
  const state = readState();

  for (const server of state.servers) {
    killTree(server.pid);
  }

  for (const chrome of state.chromes) {
    killTree(chrome.pid);
    rmSync(chrome.profile, { recursive: true, force: true });
  }

  writeState({ servers: [], chromes: [] });

  for (const build of listBuilds()) {
    removeBuild(build.name);
  }

  rmSync(LOGS, { recursive: true, force: true });
  console.log(`cleanup done; evidence kept in ${EVIDENCE}`);
}

function readState() {
  return existsSync(STATE)
    ? JSON.parse(readFileSync(STATE, "utf8"))
    : { servers: [], chromes: [] };
}

function writeState(state) {
  mkdirSync(HOME, { recursive: true });
  writeFileSync(STATE, JSON.stringify(state, null, 2));
}

function remember(kind, entry) {
  const state = readState();

  state[kind].push(entry);
  writeState(state);
}

function forget(kind, pid) {
  const state = readState();

  state[kind] = state[kind].filter((entry) => entry.pid !== pid);
  writeState(state);
}

function killTree(pid) {
  if (!isAlive(pid)) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
  } else {
    process.kill(pid, "SIGTERM");
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });

    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(true);
    });
  });
}

function git(args, env = {}) {
  const result = spawnSync("git", args, {
    cwd: REPO,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }

  return result.stdout.trim();
}

function exec(command, args, cwd, env = {}) {
  // Windows 의 pnpm 은 .cmd 파일이라 cmd.exe 를 거쳐야 실행됩니다.
  const [file, fileArgs] =
    process.platform === "win32"
      ? [process.env.ComSpec ?? "cmd.exe", ["/d", "/c", command, ...args]]
      : [command, args];
  const result = spawnSync(file, fileArgs, {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed in ${cwd}`);
  }
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (message.id !== undefined) {
      const request = pending.get(message.id);

      pending.delete(message.id);

      if (message.error) {
        request?.reject(
          new Error(`${request.method}: ${message.error.message}`),
        );
      } else {
        request?.resolve(message.result);
      }

      return;
    }

    for (const listener of listeners.get(message.method) ?? []) {
      listener(message.params);
    }
  });

  const on = (method, listener) => {
    const set = listeners.get(method) ?? new Set();

    set.add(listener);
    listeners.set(method, set);

    return () => set.delete(listener);
  };

  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = nextId++;

        pending.set(id, { resolve, reject, method });
        socket.send(JSON.stringify({ id, method, params }));
      }),
    on,
    once: (method) =>
      new Promise((resolve) => {
        const off = on(method, (params) => {
          off();
          resolve(params);
        });
      }),
    close: () => socket.close(),
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
