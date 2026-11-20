#!/usr/bin/env node
/**
 * 交互回归：机位按钮、键盘、resize、相机防穿地、阴影焦点。
 *
 * 用法：先启动 `npm run dev -- --port 5189 --strictPort`，
 * 再执行 `node scripts/test-interactions.mjs --url http://127.0.0.1:5189/`。
 */

import process from "node:process";
import { chromium } from "playwright-core";
import { CAMERA_VIEWS } from "../src/config.js";

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

const args = readArgs(process.argv.slice(2));
const url = args.url ?? "http://127.0.0.1:5189/";

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(url, { waitUntil: "load", timeout: 240000 });
await page.waitForFunction(() => window.__qingyun?.world?.sky, null, {
  timeout: 180000,
});

const viewNames = [
  "overview",
  "tongtian",
  "longshou",
  "luoxia",
  "fenghui",
  "dazhu",
  "xiaozhu",
  "chaoyang",
];

for (const name of viewNames) {
  await page.click(`[data-view="${name}"]`);
  await page.waitForFunction(() => !window.__qingyun.flight.active, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(400);
  const expected = CAMERA_VIEWS[name].target;
  const distance = await page.evaluate((target) => {
    const { controls } = window.__qingyun;
    return Math.hypot(
      controls.target.x - target[0],
      controls.target.y - target[1],
      controls.target.z - target[2],
    );
  }, expected);
  if (distance > 40) throw new Error(`${name}: camera target off by ${distance}`);
}

await page.keyboard.press("r");
await page.waitForFunction(() => !window.__qingyun.flight.active, null, {
  timeout: 30000,
});
await page.waitForTimeout(400);
const overviewDistance = await page.evaluate((target) => {
  const { controls } = window.__qingyun;
  return Math.hypot(
    controls.target.x - target[0],
    controls.target.y - target[1],
    controls.target.z - target[2],
  );
}, CAMERA_VIEWS.overview.target);
if (overviewDistance > 40) {
  throw new Error(`overview reset off by ${overviewDistance}`);
}

// 相机防穿地：把相机压到峰脚地面以下，主循环应把它抬起来。
const clampResult = await page.evaluate(() => {
  const { camera, controls, world } = window.__qingyun;
  const x = -1000;
  const z = 1300;
  camera.position.set(x, world.terrain.sampleHeight(x, z) - 30, z);
  controls.target.set(0, 1500, 0);
  controls.update();
  return { x, z };
});
await page.waitForTimeout(600);
const clampOk = await page.evaluate(({ x, z }) => {
  const { camera, world } = window.__qingyun;
  return camera.position.y > world.terrain.sampleHeight(x, z) + 3;
}, clampResult);
if (!clampOk) throw new Error("camera sunk through terrain");

// 阴影焦点：切换两次焦点，光源 target 必须跟随，且不应每帧自动重建。
const shadowOk = await page.evaluate(({ a, b }) => {
  const { world, renderer, THREE } = window.__qingyun;
  world.setShadowFocus(new THREE.Vector3(...a), 1200);
  const first = world.sky.sunLight.target.position.clone();
  world.setShadowFocus(new THREE.Vector3(...b), 1200);
  const second = world.sky.sunLight.target.position.clone();
  return (
    renderer.shadowMap.autoUpdate === false &&
    first.distanceTo(new THREE.Vector3(...a)) < 1 &&
    second.distanceTo(new THREE.Vector3(...b)) < 1 &&
    world.sky.sunLight.shadow.needsUpdate === true
  );
}, { a: CAMERA_VIEWS.fenghui.target, b: CAMERA_VIEWS.xiaozhu.target });
if (!shadowOk) throw new Error("shadow focus did not follow");

// 飞行途中也必须贴地：从龙首飞到小竹，逐帧采样离地高度。
await page.click('[data-view="longshou"]');
await page.waitForFunction(() => !window.__qingyun.flight.active, null, {
  timeout: 30000,
});
await page.click('[data-view="xiaozhu"]');
let minClearance = Infinity;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(80);
  const sample = await page.evaluate(() => {
    const { camera, world, flight } = window.__qingyun;
    return {
      clearance:
        camera.position.y -
        world.terrain.sampleHeight(camera.position.x, camera.position.z),
      active: flight.active,
    };
  });
  minClearance = Math.min(minClearance, sample.clearance);
  if (!sample.active) break;
}
if (minClearance < 4) {
  throw new Error(`flight drilled into terrain (${minClearance.toFixed(1)} m)`);
}

await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(1200);
if (errors.length) throw new Error(`page errors: ${errors[0]}`);

console.log("interactions ok");
await browser.close();
