#!/usr/bin/env node
/**
 * 交互冒烟测试：自动演示 → 自由浏览 → 机位 / 环绕 / 飘叶 / 重置。
 *
 *   node scripts/test-interactions.mjs --url http://127.0.0.1:5188/
 */

import process from "node:process";
import { chromium } from "playwright-core";

function readArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[name] = true;
    else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

async function waitForServer(url, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // 服务器还没起来
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`server not ready: ${url}`);
}

const args = readArgs(process.argv.slice(2));
const url = args.url ?? "http://127.0.0.1:5188/";
await waitForServer(url);

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});

await page.goto(url, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => window.__yinxing, null, { timeout: 120000 });

const initial = await page.evaluate(() => ({
  mode: window.__yinxing.mode,
  playing: window.__yinxing.playing,
  body: document.body.className,
  leaves: window.__yinxing.stats.leaves,
  twigs: window.__yinxing.stats.twigs,
}));

await page.click('[data-view="up"]');
await page.waitForTimeout(2200);
const afterUp = await page.evaluate(() => ({
  mode: window.__yinxing.mode,
  view: window.__yinxing.currentView,
  camera: window.__yinxing.camera.position.toArray().map((v) => +v.toFixed(2)),
  target: window.__yinxing.controls.target.toArray().map((v) => +v.toFixed(2)),
}));

await page.click('[data-view="leaf"]');
await page.waitForTimeout(2200);
const afterLeaf = await page.evaluate(() => ({
  view: window.__yinxing.currentView,
  camera: window.__yinxing.camera.position.toArray().map((v) => +v.toFixed(2)),
  focus: window.__yinxing.bokehPass.uniforms.focus.value,
  aperture: window.__yinxing.bokehPass.uniforms.aperture.value,
}));

await page.click('[data-action="play"]');
await page.waitForTimeout(500);
const afterPlay = await page.evaluate(() => ({
  mode: window.__yinxing.mode,
  playing: window.__yinxing.playing,
  body: document.body.className,
}));

await page.click('[data-action="reset"]');
await page.waitForTimeout(2000);
const afterReset = await page.evaluate(() => ({
  mode: window.__yinxing.mode,
  view: window.__yinxing.currentView,
  camera: window.__yinxing.camera.position.toArray().map((v) => +v.toFixed(2)),
}));

await page.click('[data-toggle="orbit"]');
await page.waitForTimeout(200);
const afterOrbit = await page.evaluate(() => ({
  autoRotate: window.__yinxing.controls.autoRotate,
}));

await page.click('[data-toggle="falling"]');
const afterFalling = await page.evaluate(() => ({
  fallingEnabled: window.__yinxing.world.falling.enabled,
  visible: window.__yinxing.world.falling.mesh.visible,
}));

await page.screenshot({ path: "deliverables/checks/interactive-page.png" });

await page.goto(`${url}?film=1`, { waitUntil: "load", timeout: 120000 });
await page.waitForTimeout(900);
const filmMode = await page.evaluate(() => ({
  body: document.body.className,
  hudOpacity: getComputedStyle(document.querySelector(".hud")).opacity,
}));

await page.goto(`${url}?film=1&capture=1`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => window.__capture?.ready, null, { timeout: 120000 });
const captureMode = await page.evaluate(() => ({
  body: document.body.className,
  hudDisplay: getComputedStyle(document.querySelector(".hud")).display,
  backDisplay: getComputedStyle(document.querySelector(".film__back")).display,
}));

const report = {
  initial,
  afterUp,
  afterLeaf,
  afterPlay,
  afterReset,
  afterOrbit,
  afterFalling,
  filmMode,
  captureMode,
  errors,
};
console.log(JSON.stringify(report, null, 2));

await browser.close();

const failures = [];
if (initial.mode !== "demo" || !initial.playing) failures.push("demo did not start");
if (afterUp.mode !== "free" || afterUp.view !== "up") failures.push("view switch failed");
if (afterLeaf.view !== "leaf" || afterLeaf.aperture < 0.005) failures.push("macro DOF failed");
if (afterPlay.mode !== "demo" || !afterPlay.playing) failures.push("play toggle failed");
if (afterReset.mode !== "free" || afterReset.view !== "overview") failures.push("reset failed");
if (!afterOrbit.autoRotate) failures.push("auto orbit failed");
if (afterFalling.fallingEnabled !== false || afterFalling.visible !== false) {
  failures.push("falling toggle failed");
}
if (filmMode.hudOpacity !== "0") failures.push("film HUD not hidden");
if (captureMode.hudDisplay !== "none") failures.push("capture HUD not removed");
if (captureMode.backDisplay !== "none") failures.push("capture back link not removed");
if (errors.length) failures.push(`browser errors: ${errors[0]}`);

if (failures.length) {
  console.error("FAILED:", failures);
  process.exit(1);
}
console.log("OK: interactions passed");
