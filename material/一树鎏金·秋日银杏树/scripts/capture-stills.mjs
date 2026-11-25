#!/usr/bin/env node
/**
 * 从影片时间线导出关键画面（PNG）。
 *
 * 用法：
 *   node scripts/capture-stills.mjs --url http://127.0.0.1:5188/ \
 *     --out deliverables/previews --width 1920 --height 1080
 *
 * 场景状态全部由绝对时间推导，因此只需渲染目标时刻，不必逐帧重放。
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
const width = Number(args.width ?? 1920);
const height = Number(args.height ?? 1080);

const stills = [
  { time: 1.2, name: "01-reveal" },
  { time: 4.6, name: "02-push-in" },
  { time: 8.2, name: "03-orbit" },
  { time: 13.6, name: "04-look-up" },
  { time: 18.4, name: "05-macro-leaf" },
  { time: 23.2, name: "06-bark" },
  { time: 28.6, name: "07-finale" },
];

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
});
page.on("pageerror", (error) => console.error("pageerror:", error.message));

const search = new URLSearchParams({ film: "1", capture: "1" });
const targetUrl = `${url}${url.includes("?") ? "&" : "?"}${search.toString()}`;

await page.goto(targetUrl, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__capture?.ready, null, { timeout: 300000 });
await page.evaluate(() => document.fonts.ready);

for (const still of stills) {
  await page.evaluate((value) => window.__capture.renderAt(value), still.time);
  const target = path.join(outDir, `${still.name}.png`);
  await page.screenshot({ path: target, type: "png" });
  console.log("still", still.name, `t=${still.time.toFixed(2)}s`, target);
}

await browser.close();
