#!/usr/bin/env node
/**
 * 正常交互页回归检查：播放/暂停、取景飞行、时间轴、环境开关。
 * 用法：node scripts/test-interactions.mjs
 */

import { chromium } from "playwright-core";

const url = process.env.URL ?? "http://127.0.0.1:5188/";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => window.__fengqiao, null, { timeout: 120000 });
await page.waitForTimeout(2600);

const initial = await page.evaluate(() => ({
  mode: window.__fengqiao.mode,
  playing: window.__fengqiao.playing,
  pausedClass: document.body.classList.contains("is-paused"),
}));

await page.click("#play");
await page.waitForTimeout(300);
const paused = await page.evaluate(() => ({
  playing: window.__fengqiao.playing,
  pausedClass: document.body.classList.contains("is-paused"),
  label: document.getElementById("play-label").textContent,
}));

await page.click('[data-view="boat"]');
await page.waitForTimeout(2400);
const boat = await page.evaluate(() => ({
  mode: window.__fengqiao.mode,
  playing: window.__fengqiao.playing,
  flightActive: window.__fengqiao.flight.active,
  position: window.__fengqiao.camera.position.toArray().map((v) => +v.toFixed(0)),
  target: window.__fengqiao.controls.target.toArray().map((v) => +v.toFixed(0)),
  freeClass: document.body.classList.contains("free-mode"),
}));

await page.click('[data-toggle="mist"]');
await page.waitForTimeout(200);
const mist = await page.evaluate(() => ({
  enabled: window.__fengqiao.world.mist.enabled,
  pressed: document.querySelector('[data-toggle="mist"]').getAttribute("aria-pressed"),
}));

await page.click('[data-toggle="subtitles"]');
await page.waitForTimeout(200);
const subtitles = await page.evaluate(() => ({
  off: document.body.classList.contains("subtitles-off"),
  pressed: document.querySelector('[data-toggle="subtitles"]').getAttribute("aria-pressed"),
}));

await page.evaluate(() => {
  const el = document.getElementById("timeline");
  el.value = "24";
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.waitForTimeout(600);
const seek = await page.evaluate(() => ({
  mode: window.__fengqiao.mode,
  time: +window.__fengqiao.film.time.toFixed(1),
  playing: window.__fengqiao.playing,
  pausedClass: document.body.classList.contains("is-paused"),
}));

const filmLink = await page.getAttribute(".film-link", "href");

console.log({ initial, paused, boat, mist, subtitles, seek, filmLink, errors });
await browser.close();

const ok =
  initial.mode === "demo" &&
  initial.playing === true &&
  paused.playing === false &&
  paused.pausedClass === true &&
  paused.label === "播放" &&
  boat.mode === "free" &&
  boat.playing === false &&
  boat.flightActive === false &&
  boat.freeClass === true &&
  Math.abs(boat.position[0] - 34) < 4 &&
  mist.enabled === false &&
  mist.pressed === "false" &&
  subtitles.off === true &&
  subtitles.pressed === "false" &&
  seek.mode === "demo" &&
  Math.abs(seek.time - 24) < 0.5 &&
  seek.playing === false &&
  seek.pausedClass === true &&
  filmLink === "?film=1" &&
  errors.length === 0;

if (!ok) {
  console.error("interaction check failed");
  process.exit(1);
}
console.log("interaction check passed");
