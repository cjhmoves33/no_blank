#!/usr/bin/env node
// no_blank 체육관 장면을 저장소 밖의 격리된 빌드로 띄워 정해진 시점에서 찍고, 두 빌드의 화면을 비교합니다.
// 의존성 없이 Node 24 내장 기능(WebSocket, zlib)과 설치된 Chrome 만 씁니다.
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
const VIEWPORT = { width: 1280, height: 800 };
const SETTLE_FRAMES = 30;
// 한 채널이라도 이만큼 넘게 달라야 바뀐 픽셀로 셉니다. 같은 빌드를 두 번 찍었을 때의 차이는 0 입니다.
const CHANGED_DELTA = 8;

// 시점은 화면 비율 좌표로 적은 사용자 입력입니다. 가운데는 도형이라, 배경 드래그는 왼쪽 가장자리에서 시작합니다.
const VIEWS = {
  home: [],
  "turned-left": [{ drag: [0.12, 0.85, 0.22, 0.85] }],
  "turned-right": [{ drag: [0.22, 0.85, 0.12, 0.85] }],
  high: [{ drag: [0.12, 0.3, 0.12, 0.8] }],
  low: [{ drag: [0.12, 0.8, 0.12, 0.3] }],
  near: [{ wheel: { deltaY: -120, times: 40 } }],
  far: [{ wheel: { deltaY: 120, times: 40 } }],
  pressed: [{ press: [0.5, 0.5] }],
  // 포인터가 도형 위에 남으면 hover 빛이 켜지므로, 놓은 뒤 배경으로 옮기고 누름 빛이 사라질 때까지 기다립니다.
  "shape-drag": [
    { drag: [0.5, 0.5, 0.6, 0.5] },
    { move: [0.02, 0.02] },
    { wait: 2000 },
  ],
  "home-later": [{ wait: 2000 }],
};
const DEFAULT_VIEWS = [
  "home",
  "turned-left",
  "turned-right",
  "high",
  "low",
  "near",
  "far",
];

// AudioContext 의 출력에 분석기를 하나 더 이어, 실제로 소리가 나갔는지 최대 진폭으로 남깁니다.
const AUDIO_TAP = `(() => {
  const connect = AudioNode.prototype.connect;
  const taps = new WeakMap();
  window.__verifyAudioPeak = 0;
  AudioNode.prototype.connect = function (target, ...rest) {
    if (target instanceof AudioDestinationNode) {
      let analyser = taps.get(this.context);
      if (!analyser) {
        analyser = new AnalyserNode(this.context, { fftSize: 2048 });
        taps.set(this.context, analyser);
        const samples = new Float32Array(analyser.fftSize);
        const poll = () => {
          analyser.getFloatTimeDomainData(samples);
          for (const value of samples) {
            window.__verifyAudioPeak = Math.max(window.__verifyAudioPeak, Math.abs(value));
          }
          requestAnimationFrame(poll);
        };
        poll();
      }
      connect.call(this, analyser);
    }
    return connect.call(this, target, ...rest);
  };
})();`;

const commands = { doctor, prepare, shoot, compare, diff, run, cleanup };

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

// ---------------------------------------------------------------- doctor

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

// ---------------------------------------------------------------- prepare

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
  // 저장소 밖에서 빌드하므로, 사용자의 dev 서버가 감시하는 파일은 건드리지 않습니다.
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

// 실제 index 를 건드리지 않고, 추적하지 않는 파일까지 포함한 작업 트리를 커밋 하나로 찍습니다.
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

// ---------------------------------------------------------------- shoot

async function shoot({ positional, flags }) {
  const [name] = positional;

  if (!name) {
    throw new Error(
      "usage: shoot <name> [--port 3101] [--views a,b] [--motion] [--no-webgl] [--out dir]",
    );
  }

  const out = flags.out ?? path.join(EVIDENCE, `${stamp()}-${name}`);

  await shootBuild(name, {
    port: Number(flags.port ?? 3101),
    views: parseViews(flags.views),
    motion: flags.motion === true,
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
          file: path.join(out, `${view}.png`),
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
          `  ${view}: canvas=${meta.canvas} audioPeak=${meta.audioPeak.toFixed(3)} errors=${meta.errors.length}`,
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

  // 서버가 응답하는 것만으로는 부족하고, 체육관 캔버스가 든 HTML 이 와야 준비된 것입니다.
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${port}/`);

      if (response.ok && (await response.text()).includes("<canvas")) {
        return { pid: child.pid, port };
      }
    } catch {
      // 아직 포트를 열지 않았습니다.
    }

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
  } catch {
    // 이미 닫혔습니다.
  }

  chrome.cdp.close();
  await sleep(500);
  killTree(chrome.pid);
  rmSync(chrome.profile, { recursive: true, force: true });
  forget("chromes", chrome.pid);
}

async function shootView(cdp, { url, view, motion, file }) {
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
  // 동작 줄이기를 켜면 도형 회전, 먼지, 카메라 관성이 멈춰서 같은 입력이 늘 같은 프레임을 만듭니다.
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
      source: AUDIO_TAP,
    },
  );
  const loaded = cdp.once("Page.loadEventFired");

  await cdp.send("Page.navigate", { url });
  await loaded;

  await waitForCanvas(cdp);
  await frames(cdp, SETTLE_FRAMES);

  for (const action of VIEWS[view]) {
    await perform(cdp, action);
  }

  await frames(cdp, 10);

  // WebGL 을 만들지 못하면 캔버스가 잠깐 생겼다가 사라지므로, 찍는 순간에 다시 확인합니다.
  const canvas = await evaluate(
    cdp,
    "document.querySelector('canvas') !== null",
  );
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });

  writeFileSync(file, Buffer.from(data, "base64"));
  await sleep(400);

  const audioPeak = await evaluate(cdp, "window.__verifyAudioPeak ?? 0");

  await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  offConsole();
  offException();

  return { view, actions: VIEWS[view], canvas, audioPeak, errors };
}

async function waitForCanvas(cdp) {
  for (let i = 0; i < 20; i++) {
    if (await evaluate(cdp, "document.querySelector('canvas') !== null")) {
      return true;
    }

    await sleep(100);
  }

  return false;
}

function frames(cdp, count) {
  return evaluate(
    cdp,
    `new Promise((resolve) => { let n = 0; const tick = () => (++n >= ${count} ? resolve(n) : requestAnimationFrame(tick)); requestAnimationFrame(tick); })`,
  );
}

async function perform(cdp, action) {
  const at = (x, y) => ({
    x: Math.round(x * VIEWPORT.width),
    y: Math.round(y * VIEWPORT.height),
  });

  if (action.wait) {
    await sleep(action.wait);

    return;
  }

  if (action.move) {
    await mouse(cdp, "mouseMoved", at(...action.move), 0);

    return;
  }

  if (action.press) {
    const point = at(...action.press);

    await mouse(cdp, "mousePressed", point, 1);
    await frames(cdp, 2);
    await mouse(cdp, "mouseReleased", point, 0);

    return;
  }

  if (action.drag) {
    const [x0, y0, x1, y1] = action.drag;
    const steps = 20;

    await mouse(cdp, "mousePressed", at(x0, y0), 1);

    for (let i = 1; i <= steps; i++) {
      await mouse(
        cdp,
        "mouseMoved",
        at(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps),
        1,
      );
    }

    await mouse(cdp, "mouseReleased", at(x1, y1), 0);

    return;
  }

  if (action.wheel) {
    const center = at(0.12, 0.85);

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

function mouse(cdp, type, point, buttons) {
  return cdp.send("Input.dispatchMouseEvent", {
    type,
    ...point,
    button: "left",
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

// ---------------------------------------------------------------- compare

async function compare({ positional, flags }) {
  const [before, after] = positional;

  if (!before || !after) {
    throw new Error("usage: compare <before-dir> <after-dir> [--out dir]");
  }

  const report = compareDirs(
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
  const rows = views.map((view) => {
    const before = path.join(beforeDir, `${view}.png`);

    if (!existsSync(before)) {
      return { view, stats: null };
    }

    return {
      view,
      stats: diffImages(
        before,
        path.join(afterDir, `${view}.png`),
        path.join(outDir, `${view}.png`),
      ),
    };
  });
  const lines = [
    `# Before / after`,
    "",
    `- before: ${beforeDir}`,
    `- after: ${afterDir}`,
    `- diff images: ${outDir} (changed pixels in red over a dimmed after image)`,
    "",
    "| view | changed pixels | max channel delta | mean delta |",
    "| ---- | -------------- | ----------------- | ---------- |",
    ...rows.map(({ view, stats }) =>
      stats
        ? `| ${view} | ${stats.changed} (${stats.percent.toFixed(3)}%) | ${stats.maxDelta} | ${stats.meanDelta.toFixed(3)} |`
        : `| ${view} | missing in before | | |`,
    ),
  ];
  const report = lines.join("\n");

  writeFileSync(path.join(path.dirname(outDir), "report.md"), `${report}\n`);

  return report;
}

function diffImages(fileA, fileB, outFile) {
  const a = decodePng(readFileSync(fileA));
  const b = decodePng(readFileSync(fileB));

  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `size differs: ${fileA} ${a.width}x${a.height}, ${fileB} ${b.width}x${b.height}`,
    );
  }

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

  if (outFile) {
    writeFileSync(
      outFile,
      encodePng({ width: a.width, height: a.height, pixels: out }),
    );
  }

  const pixelCount = a.pixels.length / 4;

  return {
    changed,
    percent: (changed / pixelCount) * 100,
    maxDelta,
    meanDelta: totalDelta / pixelCount,
  };
}

function formatStats(stats) {
  return `changed ${stats.changed} px (${stats.percent.toFixed(3)}%), max delta ${stats.maxDelta}, mean delta ${stats.meanDelta.toFixed(3)}`;
}

// Chrome 이 저장하는 8비트 RGB/RGBA, 비인터레이스 PNG 만 읽습니다.
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

function chunk(type, body) {
  const length = Buffer.alloc(4);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(body.length);
  crc.writeUInt32BE(zlib.crc32(typed));

  return Buffer.concat([length, typed, crc]);
}

// ---------------------------------------------------------------- run

async function run({ flags }) {
  const before = flags.before ?? "origin/main";
  const after = flags.after ?? "WORKTREE";
  const views = parseViews(flags.views);
  const motion = flags.motion === true;
  const out = path.join(EVIDENCE, stamp());

  prepareBuild("before", before);
  prepareBuild("after", after);
  await shootBuild("before", {
    port: 3101,
    views,
    motion,
    webgl: true,
    out: path.join(out, "before"),
  });
  await shootBuild("after", {
    port: 3102,
    views,
    motion,
    webgl: true,
    out: path.join(out, "after"),
  });
  console.log(
    compareDirs(
      path.join(out, "before"),
      path.join(out, "after"),
      path.join(out, "diff"),
    ),
  );
  console.log(`\nevidence: ${out}`);
}

// ---------------------------------------------------------------- cleanup

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

// ---------------------------------------------------------------- helpers

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

// 이 스크립트가 띄운 PID 만 죽입니다. 프로세스 이름으로 찾지 않습니다.
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
