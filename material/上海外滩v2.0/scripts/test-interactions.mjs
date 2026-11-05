#!/usr/bin/env node
/**
 * 正常交互页回归检查：时间切换、地标飞行、影片入口。
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
  viewport: { width: 2560, height: 1440 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => window.__bund, null, { timeout: 120000 });
await page.waitForTimeout(3500);

await page.click('[data-time="night"]');
await page.waitForTimeout(2200);
const night = await page.evaluate(() => ({
  current: window.__bund.time.current,
  target: window.__bund.time.target,
  pressed: document.querySelector('[data-time="night"]').getAttribute("aria-pressed"),
}));

await page.click('[data-landmark="pearl"]');
await page.waitForTimeout(2200);
const pearl = await page.evaluate(() => ({
  position: window.__bund.camera.position.toArray().map((v) => +v.toFixed(0)),
  target: window.__bund.controls.target.toArray().map((v) => +v.toFixed(0)),
  flightActive: window.__bund.flight.active,
}));

await page.click("#reset-view");
await page.waitForTimeout(2200);
const reset = await page.evaluate(() => ({
  position: window.__bund.camera.position.toArray().map((v) => +v.toFixed(0)),
  flightActive: window.__bund.flight.active,
}));

const filmLink = await page.getAttribute(".film-link", "href");
await page.click(".film-link");
await page.waitForFunction(() => window.__bund?.film, null, { timeout: 120000 });
const film = await page.evaluate(() => ({
  url: location.search,
  ui: getComputedStyle(document.getElementById("ui")).display,
  filmHidden: document.getElementById("film").hidden,
}));

console.log({ night, pearl, reset, filmLink, film, errors });
await browser.close();

const ok =
  night.current === "night" &&
  night.pressed === "true" &&
  pearl.flightActive === false &&
  reset.flightActive === false &&
  filmLink === "?film=1" &&
  film.url.includes("film=1") &&
  film.ui === "none" &&
  film.filmHidden === false &&
  errors.length === 0;

if (!ok) {
  console.error("interaction check failed");
  process.exit(1);
}
console.log("interaction check passed");
