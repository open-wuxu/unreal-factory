#!/usr/bin/env node
/**
 * 从影片时间线导出 2K 关键画面（PNG），用于交付预览与验收。
 *
 * 用法：
 *   node scripts/capture-stills.mjs --out deliverables/previews
 *
 * 仍从 0 秒逐帧重放，保证昼夜、船只与文字状态与视频完全一致。
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
const outDir = path.resolve(args.out ?? "deliverables/previews");
const fps = 60;

const stills = [
  { time: 1.6, name: "01-opening" },
  { time: 7.6, name: "02-bund" },
  { time: 14.2, name: "03-lujiazui-daylight" },
  { time: 18.6, name: "04-nightfall" },
  { time: 20.7, name: "05-lujiazui-night" },
  { time: 25.6, name: "06-finale" },
];

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({
  viewport: { width: 2560, height: 1440 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (error) => console.error("pageerror:", error.message));

await page.goto(`${url}?film=1&capture=1`, {
  waitUntil: "load",
  timeout: 120000,
});
await page.waitForFunction(() => window.__capture?.ready, null, {
  timeout: 120000,
});
await page.evaluate(() => document.fonts.ready);

const byFrame = new Map(
  stills.map((still) => [Math.round(still.time * fps), still]),
);
const maxFrame = Math.max(...byFrame.keys());

for (let frame = 0; frame <= maxFrame; frame++) {
  await page.evaluate((value) => window.__capture.renderAt(value), frame / fps);
  const still = byFrame.get(frame);
  if (!still) continue;

  const target = path.join(outDir, `${still.name}.png`);
  await page.screenshot({ path: target, type: "png" });
  console.log("still", still.name, `t=${still.time.toFixed(2)}s`, target);
}

await browser.close();
