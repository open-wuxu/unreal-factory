#!/usr/bin/env node
/**
 * 重放确定性：同一时刻从不同 seek 历史渲染，像素必须一致。
 * 用法：先启动 dev server，再执行
 *   node scripts/test-determinism.mjs --url http://127.0.0.1:5199/
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
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
const url = args.url ?? "http://127.0.0.1:5199/";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "qingyun-determinism-"));

function pixelHash(file) {
  const result = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-f", "md5", "-"],
    { encoding: "utf8" },
  );
  if (result.status === 0 && result.stdout.trim()) {
    return `pixels:${result.stdout.trim()}`;
  }
  return `bytes:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (error) => console.error("pageerror:", error.message));

const targetUrl = `${url}${url.includes("?") ? "&" : "?"}film=1&capture=1`;
await page.goto(targetUrl, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__capture?.ready, null, {
  timeout: 300000,
});

async function capture(time, name) {
  await page.evaluate((value) => window.__capture.renderAt(value), time);
  const file = path.join(tempDir, `${name}.png`);
  await page.screenshot({ path: file, type: "png" });
  return file;
}

const first = await capture(12, "a-first");
await page.evaluate(() => window.__capture.renderAt(5));
const second = await capture(12, "a-second");
const later = await capture(24, "b-first");
await page.evaluate(() => window.__capture.renderAt(3));
const laterAgain = await capture(24, "b-second");

const a = pixelHash(first);
const b = pixelHash(second);
const c = pixelHash(later);
const d = pixelHash(laterAgain);

await browser.close();

if (a !== b) throw new Error(`t=12 differs: ${a} vs ${b}`);
if (c !== d) throw new Error(`t=24 differs: ${c} vs ${d}`);

console.log("determinism ok", a, c);
