#!/usr/bin/env node
/**
 * 浏览器冒烟检查：启动开发服务器后运行。
 *
 *   node scripts/verify-scene.mjs --url http://127.0.0.1:5188/
 *
 * 检查叶片/枝条数量、WebGL 上下文、Shader 编译错误与渲染统计，
 * 并输出若干关键帧到 deliverables/checks/。
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
    if (!next || next.startsWith("--")) args[name] = true;
    else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

async function waitForServer(url, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // 服务器还没起来
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`server not ready: ${url}`);
}

const args = readArgs(process.argv.slice(2));
const url = args.url ?? "http://127.0.0.1:5188/";
const outDir = path.resolve(args.out ?? "deliverables/checks");
fs.mkdirSync(outDir, { recursive: true });

await waitForServer(url);

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
  if (message.type() === "warning" && /shader|webgl/i.test(message.text())) {
    console.warn("warning:", message.text());
  }
});

const search = new URLSearchParams({ film: "1", capture: "1" });
const targetUrl = `${url}${url.includes("?") ? "&" : "?"}${search.toString()}`;
await page.goto(targetUrl, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__capture?.ready, null, { timeout: 300000 });
await page.evaluate(() => document.fonts.ready);

const info = await page.evaluate(() => {
  const app = window.__yinxing;
  const renderer = app.renderer;
  return {
    capture: {
      width: window.__capture.width,
      height: window.__capture.height,
      duration: window.__capture.duration,
      fps: window.__capture.fps,
    },
    stats: app.stats,
    leafCount: app.world.tree.leafCount,
    branchCount: app.world.tree.branchCount,
    twigCount: app.world.tree.twigCount,
    heroLeaf: app.world.tree.heroLeaf.position.toArray(),
    crownBounds: app.world.tree.crownBounds
      ? {
          min: app.world.tree.crownBounds.min.toArray(),
          max: app.world.tree.crownBounds.max.toArray(),
        }
      : null,
    shadowMapSize: app.world.sunLight.shadow.mapSize.toArray(),
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    contextLost: renderer.getContext().isContextLost(),
  };
});

const checks = [
  { time: 1.2, name: "check-01-reveal" },
  { time: 8.2, name: "check-02-orbit" },
  { time: 13.6, name: "check-03-lookup" },
  { time: 18.4, name: "check-04-macro" },
  { time: 23.2, name: "check-05-bark" },
  { time: 28.6, name: "check-06-finale" },
];

for (const check of checks) {
  await page.evaluate((value) => window.__capture.renderAt(value), check.time);
  await page.screenshot({
    path: path.join(outDir, `${check.name}.png`),
    type: "png",
  });
}

const render = await page.evaluate(() => {
  const renderer = window.__yinxing.renderer;
  const info = renderer.info;
  return {
    calls: info.render.calls,
    triangles: info.render.triangles,
    points: info.render.points,
    lines: info.render.lines,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
  };
});

const report = { url: targetUrl, info, render, errors };
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();

if (errors.length) {
  console.error(`FAILED: ${errors.length} browser error(s)`);
  process.exit(1);
}
if (!info.stats || info.stats.leaves < 20000) {
  console.error("FAILED: too few leaves", info.stats);
  process.exit(1);
}
if (info.contextLost) {
  console.error("FAILED: WebGL context lost");
  process.exit(1);
}
console.log("OK: scene rendered without browser errors");
