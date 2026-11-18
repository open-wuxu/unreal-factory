#!/usr/bin/env node
/**
 * 构建产物回归检查：本地 preview 下的交互页与影片页。
 * 用法：npm run preview -- --port 4188，然后 node scripts/verify-build.mjs
 */

import fs from "node:fs";
import { chromium } from "playwright-core";

fs.mkdirSync("deliverables/previews", { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({
  viewport: { width: 2560, height: 1440 },
  deviceScaleFactor: 1,
});
const errors = [];
const failed = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("requestfailed", (r) => failed.push(r.url()));

await page.goto("http://127.0.0.1:4188/", { waitUntil: "load" });
await page.waitForFunction(() => window.__fengqiao, null, { timeout: 120000 });
await page.waitForTimeout(3200);
const normal = await page.evaluate(() => ({
  hasApp: Boolean(window.__fengqiao),
  link: document.querySelector(".film-link")?.getAttribute("href"),
  hud: getComputedStyle(document.getElementById("ui")).display,
  mode: window.__fengqiao.mode,
}));
await page.screenshot({
  path: "deliverables/previews/web-normal.jpg",
  type: "jpeg",
  quality: 90,
});

await page.goto("http://127.0.0.1:4188/?film=1", { waitUntil: "load" });
await page.waitForFunction(() => window.__fengqiao?.film, null, {
  timeout: 120000,
});
await page.waitForTimeout(1800);
const film = await page.evaluate(() => ({
  ui: getComputedStyle(document.getElementById("ui")).display,
  isFilm: document.body.classList.contains("is-film"),
  intro: getComputedStyle(document.querySelector('[data-film="intro"]')).opacity,
  line: getComputedStyle(document.querySelector('[data-film="line1"]')).opacity,
}));
await page.screenshot({
  path: "deliverables/previews/web-film.jpg",
  type: "jpeg",
  quality: 90,
});

console.log({ normal, film, errors, failed });
await browser.close();

const ok =
  normal.hasApp &&
  normal.link === "?film=1" &&
  normal.hud !== "none" &&
  normal.mode === "demo" &&
  film.ui === "none" &&
  film.isFilm &&
  Number(film.intro) > 0.05 &&
  !errors.length &&
  !failed.length;

if (!ok) {
  console.error("build verification failed");
  process.exit(1);
}
console.log("build verification passed");
