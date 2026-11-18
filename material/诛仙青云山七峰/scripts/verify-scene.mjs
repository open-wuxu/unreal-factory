#!/usr/bin/env node
/**
 * 场景验证：加载页面、检查运行时错误、截图，并可选做 resize 回归。
 *
 * 用法：
 *   node scripts/verify-scene.mjs --url http://127.0.0.1:5199/ --resize
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
const url = args.url ?? "http://127.0.0.1:5199/";
const outDir = path.resolve(args.out ?? "deliverables/previews");
const resize = Boolean(args.resize);

fs.mkdirSync(outDir, { recursive: true });

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

await page.goto(url, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__qingyun?.world?.clouds, null, {
  timeout: 300000,
});
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(outDir, "verify-scene.png") });

if (resize) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "verify-scene-720p.png") });
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "verify-scene-1440p.png") });
}

const lost = await page.evaluate(() =>
  window.__qingyun.renderer.getContext().isContextLost(),
);
const stats = await page.evaluate(() => ({
  mode: window.__qingyun.mode,
  film: window.__qingyun.film?.duration,
  vegetation: window.__qingyun.world.vegetation.counts,
}));

if (lost) throw new Error("WebGL context lost");
if (errors.length) throw new Error(`page errors: ${errors[0]}`);
console.log("verify ok", JSON.stringify(stats));
await browser.close();
