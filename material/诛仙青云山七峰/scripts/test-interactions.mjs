#!/usr/bin/env node
/**
 * 交互回归：机位按钮、键盘、resize、相机防穿地、阴影焦点。
 *
 * 用法：先启动 `npm run dev -- --port 5189 --strictPort`，
 * 再执行 `node scripts/test-interactions.mjs --url http://127.0.0.1:5189/`。
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
  const distance = await page.evaluate((viewName) => {
    const { camera, controls } = window.__qingyun;
    const target = window.__qingyun.world ? null : null;
    void target;
    const expected = {
      overview: [0, 1000, 0],
      tongtian: [0, 1790, 0],
      longshou: [-200, 1500, -2900],
      luoxia: [-2350, 1280, -1750],
      fenghui: [-3250, 1450, 250],
      dazhu: [-2000, 1150, 2600],
      xiaozhu: [1700, 1320, 2900],
      chaoyang: [3100, 1450, -250],
    }[viewName];
    return Math.hypot(
      controls.target.x - expected[0],
      controls.target.y - expected[1],
      controls.target.z - expected[2],
    );
  }, name);
  if (distance > 40) throw new Error(`${name}: camera target off by ${distance}`);
}

await page.keyboard.press("r");
await page.waitForFunction(() => !window.__qingyun.flight.active, null, {
  timeout: 30000,
});
await page.waitForTimeout(400);
const overviewDistance = await page.evaluate(() => {
  const { controls } = window.__qingyun;
  return Math.hypot(controls.target.x, controls.target.y - 1000, controls.target.z);
});
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

// 阴影焦点：切换两次焦点，光源 target 必须跟随。
const shadowOk = await page.evaluate(() => {
  const { world, THREE } = window.__qingyun;
  world.setShadowFocus(new THREE.Vector3(-2000, 1170, 2600), 1200);
  const a = world.sky.sunLight.target.position.clone();
  world.setShadowFocus(new THREE.Vector3(1700, 1330, 2900), 1200);
  const b = world.sky.sunLight.target.position.clone();
  return (
    a.distanceTo(new THREE.Vector3(-2000, 1170, 2600)) < 1 &&
    b.distanceTo(new THREE.Vector3(1700, 1330, 2900)) < 1 &&
    world.sky.sunLight.shadow.needsUpdate === true
  );
});
if (!shadowOk) throw new Error("shadow focus did not follow");

await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(1200);
if (errors.length) throw new Error(`page errors: ${errors[0]}`);

console.log("interactions ok");
await browser.close();
