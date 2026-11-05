#!/usr/bin/env node
/**
 * 逐帧导出影片模式到 JPEG 序列。
 *
 * 用法：
 *   node scripts/export-film.mjs --url http://127.0.0.1:5188/ \
 *     --frames deliverables/frames --fps 60 --duration 28
 *
 * 需要先启动 `npm run dev -- --port 5188 --strictPort`。
 * 渲染在 `?film=1&capture=1` 下以固定 1/60 秒步长推进，保证可重复。
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";

function readArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

const args = readArgs(process.argv.slice(2));
const url = args.url ?? "http://127.0.0.1:5188/";
const framesDir = path.resolve(args.frames ?? "deliverables/frames");
const fps = Number(args.fps ?? 60);
const duration = Number(args.duration ?? 28);
const quality = Number(args.quality ?? 95);
const limitSeconds = args["limit-seconds"]
  ? Number(args["limit-seconds"])
  : null;
const resume = Boolean(args.resume);
const totalFrames = Math.round(
  (limitSeconds == null ? duration : Math.min(duration, limitSeconds)) * fps,
);

fs.mkdirSync(framesDir, { recursive: true });

function framePath(frame) {
  return path.join(framesDir, `f_${String(frame).padStart(5, "0")}.jpg`);
}

function existingFrameCount() {
  let count = 0;
  while (fs.existsSync(framePath(count))) count++;
  return count;
}

let startFrame = 0;
if (resume) {
  startFrame = existingFrameCount();
  console.log(`resume: replaying ${startFrame} frames, capturing from ${startFrame}`);
} else {
  for (const file of fs.readdirSync(framesDir)) {
    if (/^f_\d{5}\.jpg$/.test(file)) fs.rmSync(path.join(framesDir, file));
  }
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});

const page = await browser.newPage({
  viewport: { width: 2560, height: 1440 },
  deviceScaleFactor: 1,
});

const pageErrors = [];
page.on("pageerror", (error) => {
  pageErrors.push(error.message);
  console.error("pageerror:", error.message);
});
page.on("console", (message) => {
  if (message.type() === "error") console.error("console:", message.text());
});

console.log(`opening ${url}?film=1&capture=1`);
await page.goto(`${url}?film=1&capture=1`, {
  waitUntil: "load",
  timeout: 120000,
});
await page.waitForFunction(() => window.__capture?.ready, null, {
  timeout: 120000,
});
await page.evaluate(() => document.fonts.ready);

const info = await page.evaluate(() => ({
  width: window.__capture.width,
  height: window.__capture.height,
  duration: window.__capture.duration,
  fps: window.__capture.fps,
}));
console.log("capture", info, "total frames", totalFrames);

if (info.width !== 2560 || info.height !== 1440) {
  throw new Error(`unexpected viewport ${info.width}x${info.height}`);
}

const startedAt = Date.now();

// 断点续传时先无截图重放，恢复船只、车流与昼夜过渡状态。
for (let frame = 0; frame < startFrame; frame++) {
  await page.evaluate((value) => window.__capture.renderAt(value), frame / fps);
  if (frame > 0 && frame % 300 === 0) {
    console.log(`replay ${frame}/${startFrame}`);
  }
}

for (let frame = startFrame; frame < totalFrames; frame++) {
  const t = frame / fps;
  await page.evaluate((value) => window.__capture.renderAt(value), t);

  const target = framePath(frame);
  const temp = `${target}.tmp`;
  await page.screenshot({ path: temp, type: "jpeg", quality });
  fs.renameSync(temp, target);

  if (frame === startFrame || (frame + 1) % 60 === 0) {
    const elapsed = (Date.now() - startedAt) / 1000;
    const done = frame + 1 - startFrame;
    const rate = done / Math.max(elapsed, 0.001);
    const remaining = (totalFrames - frame - 1) / Math.max(rate, 0.001);
    console.log(
      `frame ${frame + 1}/${totalFrames}  ${rate.toFixed(2)} fps  eta ${Math.ceil(
        remaining,
      )}s`,
    );
  }

  if ((frame + 1) % 120 === 0 || frame === totalFrames - 1) {
    const lost = await page.evaluate(() =>
      window.__bund.renderer.getContext().isContextLost(),
    );
    if (lost) throw new Error("WebGL context lost during capture");
    if (pageErrors.length) {
      throw new Error(`page error during capture: ${pageErrors[0]}`);
    }
  }
}

const manifest = {
  url,
  width: info.width,
  height: info.height,
  fps,
  duration,
  frames: totalFrames,
  quality,
  capturedAt: new Date().toISOString(),
  elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
};
fs.writeFileSync(
  path.join(framesDir, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
console.log("done", manifest);

await browser.close();
