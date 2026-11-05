import { chromium } from "playwright-core";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"] });
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
const errors = [];
const failed = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("requestfailed", (r) => failed.push(r.url()));
await page.goto("http://127.0.0.1:4188/", { waitUntil: "load" });
await page.waitForFunction(() => window.__bund, null, { timeout: 120000 });
await page.waitForTimeout(2500);
console.log("prod normal", await page.evaluate(() => ({
  hasBund: !!window.__bund,
  link: document.querySelector(".film-link")?.getAttribute("href"),
  hud: getComputedStyle(document.getElementById("ui")).display,
})));
await page.screenshot({ path: "deliverables/previews/web-normal.jpg", type: "jpeg", quality: 90 });
await page.goto("http://127.0.0.1:4188/?film=1", { waitUntil: "load" });
await page.waitForFunction(() => window.__bund?.film, null, { timeout: 120000 });
await page.waitForTimeout(1800);
console.log("prod film", await page.evaluate(() => ({
  ui: getComputedStyle(document.getElementById("ui")).display,
  filmHidden: document.getElementById("film").hidden,
  title: getComputedStyle(document.querySelector('[data-film="title"]')).opacity,
})));
await page.screenshot({ path: "deliverables/previews/web-film.jpg", type: "jpeg", quality: 90 });
console.log({ errors, failed });
await browser.close();
if (errors.length || failed.length) process.exit(1);
