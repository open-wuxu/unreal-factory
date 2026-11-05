# 上海外滩 v3.0 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `material/上海外滩v3.0/` 交付一个基于真实 OSM 地理数据、3D-GloBFP 高度补全和 Copernicus DEM 的 1:1 上海外滩—陆家嘴 Three.js 城市场景。

**Architecture:** 先用离线脚本把 OSM/GloBFP/DEM 处理成本地 ENU 米制 `city.json`、`terrain.json` 和 `manifest.json`；运行时用纯 Three.js 读取这些数据，生成地形、真实岸线水面、道路、合并建筑几何和四座参数化地标，并复用 v2 的昼夜、材质与后处理体系。

**Tech Stack:** Node.js ≥ 20.19、Vite 7、Three.js 0.186.0、Node 内置 `node:test`、Playwright（系统 Chrome）、Python 3（pyshp、numpy、tifffile、imagecodecs，仅数据处理）。

**Spec:** `docs/superpowers/specs/2026-11-05-shanghai-bund-v3-design.md`

## Global Constraints

- 工作目录：所有文件位于 `material/上海外滩v3.0/`；从该目录运行命令。
- 1 Three.js 单位 = 1 米；坐标原点 `121.495E, 31.240N`；`x=东`、`y=上`、`z=南`。
- 场景范围：`121.475–121.515E, 31.225–31.255N`。
- 不使用 CesiumJS；运行时不得请求任何在线服务、地图瓦片或外部模型/贴图。
- 建筑轮廓：OSM 为主；GloBFP 仅补全独有建筑，面积 ≥ 60 m²，质心不在 OSM 多边形内、距离 > 10 m、重叠 < 30%。
- 高度优先级：`osm:height` > `osm:levels` > 人工核对（仅四大地标与 OSM 具名缺高塔楼）> `globfp` > `estimated`。
- `estimated` 比例目标 ≤15%，硬上限 30%；超过 30% 时 `data:verify` 必须失败。
- 数据体积：`city.json` < 20 MB（gzip 前），gzip 后 < 6 MB；三角形 < 250 万；draw calls < 300。
- 每个阶段必须用真实浏览器验证（Playwright 截图），不能只跑代码检查。
- Node 测试：`npm test`；浏览器测试：`npm run test:browser`。
- 提交信息末尾加：`Co-Authored-By: Claude Code <noreply@anthropic.com>`。

## Review Focus

以下 5 类输入/失败模式最容易在实现中出错，相关任务必须包含对应测试：

1. **OSM 建筑 relation 的内环或未闭合环**：不能变成实心块，也不能让解析器崩溃。→ Task 3、Task 11。
2. **重叠瓦片中的同一栋建筑**：必须只输出一次，ID 一致。→ Task 3、Task 5。
3. **GloBFP 把 632 m 塔楼匹配到旁边 50 m 棚屋**：面积比与距离必须拒绝。→ Task 5。
4. **DSM 把塔楼屋顶当成地面**：建筑基底必须采样滤波后的近似地面，不能采样原始 DSM。→ Task 4、Task 8、Task 11。
5. **浏览器空白画布**：数据加载或 WebGL 失败时，测试必须检查非空截图与控制台无错误，而不是只看 `ready`。→ Task 1、Task 7、Task 21。

---

## 阶段一：数据处理与坐标

### Task 1: 项目脚手架、测试与浏览器冒烟

**Files:**
- Create: `material/上海外滩v3.0/package.json`
- Create: `material/上海外滩v3.0/vite.config.js`
- Create: `material/上海外滩v3.0/index.html`
- Create: `material/上海外滩v3.0/.gitignore`
- Create: `material/上海外滩v3.0/src/main.js`
- Create: `material/上海外滩v3.0/playwright.config.mjs`
- Create: `material/上海外滩v3.0/tests/browser.spec.mjs`

**Interfaces:**
- Produces: Vite 项目可在 5173 端口启动；`window.__bund.ready === true`；`npm test`、`npm run test:browser` 可用。

- [ ] **Step 1: 创建 `package.json`**

```json
{
  "name": "shanghai-bund-3d-v3",
  "private": true,
  "version": "3.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test tests/*.test.mjs",
    "test:browser": "playwright test",
    "data:fetch": "node tools/fetch-osm.mjs",
    "data:globfp": "python3 tools/process_globfp.py",
    "data:dem": "python3 tools/process_dem.py",
    "data:build": "node tools/build-dataset.mjs",
    "data:verify": "node tools/verify-dataset.mjs"
  },
  "dependencies": { "three": "0.186.0" },
  "devDependencies": { "vite": "^7.1.0", "@playwright/test": "^1.50.0", "polygon-clipping": "^0.15.7", "fast-xml-parser": "^4.4.1" }
}
```

- [ ] **Step 2: 创建 Vite 配置、页面骨架与占位入口**

`vite.config.js` 使用 `base: "./"`、端口 5173、`host: true`。`index.html` 包含
`<canvas id="scene">`、`#loading` 和 `#ui` 容器。`src/main.js` 创建 WebGL2 渲染器、
清屏为深色，并渲染一个可见的彩色网格/立方体（保证冒烟截图非空），
在首帧后设置 `window.__bund = { ready: true }`。

- [ ] **Step 3: 创建 `.gitignore`**

忽略 `node_modules/`、`dist/`、`tools/.cache/`、`test-results/`、`playwright-report/`、`.DS_Store`。

- [ ] **Step 4: 配置 Playwright**

`playwright.config.mjs`：`testDir: "./tests"`、`testMatch: /.*\.spec\.mjs/`、
`webServer.command: "npm run dev -- --port 5174 --strictPort"`、
`use.baseURL: "http://localhost:5174"`、`projects: [{ name: "chrome", use: { channel: "chrome", viewport: { width: 1280, height: 800 } } }]`。
WebGL 启动参数加 `--use-angle=swiftshader --enable-unsafe-swiftshader`。
若系统没有 Chrome，改用 Playwright 自带的 chromium（`npx playwright install chromium`，
并去掉 `channel`）；若 headless 下 WebGL 不可用，设置 `headless: false` 再运行。

- [ ] **Step 5: 写浏览器冒烟测试**

`tests/browser.spec.mjs`：

```js
import { test, expect } from "@playwright/test";

test("boots and renders a non-blank canvas", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/");
  await page.waitForFunction(() => window.__bund?.ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  await expect(page.locator("#scene")).toBeVisible();
  const shot = await page.screenshot({ path: "test-results/task-01.png" });
  expect(shot.length).toBeGreaterThan(20000);
  expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
});
```

- [ ] **Step 6: 安装并验证**

Run: `npm install && npm run test:browser`
Expected: 1 passed；`test-results/task-01.png` 存在且大于 20 KB。

- [ ] **Step 7: 提交**

```bash
git add material/上海外滩v3.0
git commit -m "chore(v3): scaffold project, tests and browser smoke

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: WGS84 → ENU 坐标模块

**Files:**
- Create: `material/上海外滩v3.0/src/geo/geodesy.js`
- Test: `material/上海外滩v3.0/tests/geodesy.test.mjs`

**Interfaces:**
- Produces: `createProjection(origin) -> { toScene(lon, lat, y=0), toLonLat(x, z) }`；
  `toScene` 返回 `{ x, y, z }`，其中 `x=东`、`z=-北`、`y` 原样保留。
- Produces: `distanceMeters(lon1, lat1, lon2, lat2) -> number`。

- [ ] **Step 1: 写失败测试**

`tests/geodesy.test.mjs`：

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createProjection, distanceMeters } from "../src/geo/geodesy.js";

const origin = { lon: 121.495, lat: 31.24 };
const p = createProjection(origin);

test("origin maps to zero", () => {
  const v = p.toScene(origin.lon, origin.lat);
  assert.ok(Math.abs(v.x) < 0.01 && Math.abs(v.z) < 0.01);
});

test("0.001 deg east is about 95 m", () => {
  const v = p.toScene(origin.lon + 0.001, origin.lat);
  assert.ok(Math.abs(v.x - 95.2) < 1.0, `x=${v.x}`);
});

test("0.001 deg north is about 111 m, negative z", () => {
  const v = p.toScene(origin.lon, origin.lat + 0.001);
  assert.ok(Math.abs(v.z + 110.9) < 1.0, `z=${v.z}`);
});

test("round trip is within 1e-6 deg", () => {
  const v = p.toScene(121.5016, 31.2354);
  const back = p.toLonLat(v.x, v.z);
  assert.ok(Math.abs(back.lon - 121.5016) < 1e-6);
  assert.ok(Math.abs(back.lat - 31.2354) < 1e-6);
});

test("distanceMeters approximates local scale", () => {
  assert.ok(Math.abs(distanceMeters(121.495, 31.24, 121.496, 31.24) - 95.2) < 1);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/geodesy.test.mjs`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现**

`createProjection` 实现 WGS84 → ECEF → ENU，原点取 `origin.lon/lat`，高程 0；
`toLonLat` 用逆变换。`distanceMeters` 使用等距圆柱近似或 haversine。

- [ ] **Step 4: 运行确认通过**

Run: `node --test tests/geodesy.test.mjs`
Expected: 5 passed。

- [ ] **Step 5: 提交**

```bash
git add material/上海外滩v3.0/src/geo/geodesy.js material/上海外滩v3.0/tests/geodesy.test.mjs
git commit -m "feat(v3): add WGS84 to ENU projection

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: OSM 抓取与解析

**Files:**
- Create: `material/上海外滩v3.0/tools/fetch-osm.mjs`
- Create: `material/上海外滩v3.0/tools/parse-osm.mjs`
- Create: `material/上海外滩v3.0/tests/fixtures/osm-sample.xml`
- Test: `material/上海外滩v3.0/tests/parse-osm.test.mjs`

**Interfaces:**
- Produces: `parseOsmXml(xml) -> { nodes, ways, relations }`，
  `nodes: Map<string,{lat,lon}>`，`ways/relations` 为带 `id/tags/refs|members` 的数组。
- Produces: `dedupeOsm(osm) -> osm`，按元素 ID 去重。
- Produces: `extractBuildings(osm) -> Building[]`，字段：
  `{ id, source:"osm", osmId, tags, ring:[[lon,lat],...], holes:[[[lon,lat],...]], areaM2 }`。
- Produces: `extractRoads(osm) -> Road[]`，字段：
  `{ id, osmId, class, widthM, lanes, bridge, tunnel, layer, points:[[lon,lat],...] }`。
- Produces: `extractWater(osm) -> { polygons, centerlines }`。

- [ ] **Step 1: 创建 fixture**

`tests/fixtures/osm-sample.xml` 至少包含：

```xml
<osm version="0.6">
  <node id="1" lat="31.240" lon="121.495"/>
  <node id="2" lat="31.240" lon="121.496"/>
  <node id="3" lat="31.241" lon="121.496"/>
  <node id="4" lat="31.241" lon="121.495"/>
  <node id="5" lat="31.24025" lon="121.49525"/>
  <node id="6" lat="31.24025" lon="121.49575"/>
  <node id="7" lat="31.24075" lon="121.49575"/>
  <node id="8" lat="31.24075" lon="121.49525"/>
  <way id="10">
    <nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/>
    <tag k="building" v="yes"/><tag k="height" v="30"/><tag k="name" v="Test Building"/>
  </way>
  <way id="11"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/></way>
  <way id="12"><nd ref="5"/><nd ref="6"/><nd ref="7"/><nd ref="8"/><nd ref="5"/></way>
  <relation id="20">
    <member type="way" ref="11" role="outer"/>
    <member type="way" ref="12" role="inner"/>
    <tag k="building" v="yes"/><tag k="name" v="Courtyard"/>
  </relation>
  <way id="30">
    <nd ref="1"/><nd ref="2"/>
    <tag k="highway" v="primary"/><tag k="bridge" v="yes"/><tag k="lanes" v="4"/>
  </way>
  <way id="31">
    <nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/>
    <tag k="natural" v="water"/><tag k="water" v="river"/>
  </way>
  <way id="32">
    <nd ref="1"/><nd ref="3"/>
    <tag k="waterway" v="river"/><tag k="name" v="黄浦江"/>
  </way>
</osm>
```

- [ ] **Step 2: 写失败测试**

`tests/parse-osm.test.mjs` 覆盖：

1. 建筑 way 解析出 1 栋，`height` 为 30。
2. relation 解析出 1 栋，`ring` 取 outer，`holes` 有 1 条。
3. 道路解析出 `bridge=true`、`lanes=4`、`widthM=14`（4×3.5）。
4. 水域解析出 1 个 polygon（way 31）与 1 条中心线（way 32）。
5. 将同一份 XML 解析两次并合并，`dedupeOsm` 后建筑数量仍为 2。
6. 未闭合环（首尾不同）被跳过（不产出建筑），不产生 NaN。
7. 缺失节点引用被跳过，不抛异常。

- [ ] **Step 3: 运行确认失败**

Run: `node --test tests/parse-osm.test.mjs`
Expected: FAIL，模块不存在。

- [ ] **Step 4: 实现解析器**

`fetch-osm.mjs`：按 0.01° 瓦片请求
`https://api.openstreetmap.org/api/0.6/map?bbox=W,S,E,N`，带
`User-Agent: unreal-factory-v3/1.0`，请求间延迟 300 ms，写入 `tools/.cache/osm/`，
已有非空文件则跳过。默认范围 `121.475,31.225,121.515,31.255`。

`parse-osm.mjs`：用 `fast-xml-parser` 解析（`ignoreAttributes: false`）；实现上述接口。
建筑面积用局部平面鞋带公式；`building:levels × 3.2` 作为 `levelsHeight` 字段返回。

- [ ] **Step 5: 运行确认通过**

Run: `node --test tests/parse-osm.test.mjs`
Expected: 7 passed。

- [ ] **Step 6: 实抓并提交**

Run: `node tools/fetch-osm.mjs`
Expected: `tools/.cache/osm/` 至少 12 个非空 XML 文件。

```bash
git add material/上海外滩v3.0/tools/fetch-osm.mjs material/上海外滩v3.0/tools/parse-osm.mjs material/上海外滩v3.0/tests
git commit -m "feat(v3): fetch and parse OSM city data

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: GloBFP 与 DEM 数据提取

**Files:**
- Create: `material/上海外滩v3.0/tools/process_globfp.py`
- Create: `material/上海外滩v3.0/tools/process_dem.py`
- Create: `material/上海外滩v3.0/tools/requirements.txt`

**Interfaces:**
- Produces: `tools/.cache/globfp-core.json`：
  `{ "buildings": [{ "id": "glo:<gridId>:<index>", "lon", "lat", "height", "areaM2", "ring": [[lon,lat],...] }] }`。
- Produces: `public/data/terrain.json`：
  `{ "origin": {"lon","lat","elevation"}, "width", "height", "step", "heights": [number...] }`，
  `heights` 为行优先、相对原点的高程。

- [ ] **Step 1: 创建 `requirements.txt`**

```
pyshp==2.3.1
numpy==2.1.3
tifffile==2024.9.20
imagecodecs==2024.9.18
```

- [ ] **Step 2: 实现 `process_globfp.py`**

CLI：`--input <shp> --bounds W,S,E,N --out tools/.cache/globfp-core.json`。
只保留面积 ≥ 60 m² 的要素；取最大外环；对环做 Douglas-Peucker 简化（容差 1 m）；
输出 WGS84 环。用 `pyshp` 读取，用鞋带公式计算面积（局部米制）。

- [ ] **Step 3: 实现 `process_dem.py`**

CLI：`--input <tif> --bounds W,S,E,N --origin LON,LAT --out public/data/terrain.json`。
用 `tifffile` 读 ModelPixelScale/ModelTiepoint；裁剪；5×5 中值滤波 + 3×3 均值；
输出约 30 m 网格（宽高由范围决定），高程减去原点附近陆地区域中位数。
必须打印：滤波前后 min/max/中位数、江面区域中位数。

- [ ] **Step 4: 下载原始数据并运行**

```bash
mkdir -p tools/.cache/raw
curl -L -o tools/.cache/raw/globfp.zip "https://ndownloader.figshare.com/files/54116807"
unzip -o tools/.cache/raw/globfp.zip -d tools/.cache/raw/globfp
curl -L -o tools/.cache/raw/copernicus.tif \
  "https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N31_00_E121_00_DEM/Copernicus_DSM_COG_10_N31_00_E121_00_DEM.tif"
python3 tools/process_globfp.py --input tools/.cache/raw/globfp/*.shp --bounds 121.475,31.225,121.515,31.255 --out tools/.cache/globfp-core.json
python3 tools/process_dem.py --input tools/.cache/raw/copernicus.tif --bounds 121.475,31.225,121.515,31.255 --origin 121.495,31.240 --out public/data/terrain.json
```

Expected: GloBFP 核心区 > 8,000 栋；`terrain.json` 高程范围在 -10–20 m 内，
无 NaN；滤波前后最大差异 < 30 m。

- [ ] **Step 5: 提交**

```bash
git add material/上海外滩v3.0/tools/process_globfp.py material/上海外滩v3.0/tools/process_dem.py material/上海外滩v3.0/tools/requirements.txt material/上海外滩v3.0/public/data/terrain.json
git commit -m "feat(v3): extract GloBFP heights and Copernicus DEM

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: 数据集合并、去重、投影与输出

**Files:**
- Create: `material/上海外滩v3.0/tools/build-dataset.mjs`
- Create: `material/上海外滩v3.0/tools/tower-heights.json`
- Create: `material/上海外滩v3.0/src/data/terrainHeight.js`
- Test: `material/上海外滩v3.0/tests/build-dataset.test.mjs`

**Interfaces:**
- Produces: `assignHeights(osmBuildings, globfpBuildings, opts) -> { buildings, stats }`。
- Produces: `mergeGlobfpBuildings(osmBuildings, globfpBuildings, opts) -> Building[]`。
- Produces: `overlapRatio(ringA, ringB) -> number`（0–1）。
- Produces: `heightAt(terrain, x, z) -> number`（双线性插值，越界 clamp）。
- Produces: `projectCity(features, projection) -> CityData`。
- Produces: `public/data/city.json` 与 `public/data/manifest.json`。

- [ ] **Step 1: 定义 `city.json` 契约**

```json
{
  "version": 1,
  "origin": { "lon": 121.495, "lat": 31.24 },
  "bounds": { "west": 121.475, "south": 31.225, "east": 121.515, "north": 31.255 },
  "buildings": [{
    "id": "osm:way/165792123", "source": "osm", "kind": "commercial",
    "name": "上海中心大厦", "height": 632, "heightSource": "osm:height",
    "levels": 128, "areaM2": 6534, "ground": 4.1,
    "ring": [[0, 0], [1, 0]], "holes": []
  }],
  "roads": [{ "id": "osm:way/1", "class": "primary", "widthM": 20, "bridge": false, "tunnel": false, "layer": 0, "points": [[0, 0]] }],
  "water": [{ "id": "osm:way/71118583", "outer": [[0, 0]], "holes": [] }],
  "riverCenterlines": [{ "id": "osm:relation/19289628", "points": [[0, 0]] }],
  "trees": [{ "x": 0, "z": 0 }],
  "waterLevel": -2.4
}
```

- [ ] **Step 2: 写失败测试**

`tests/build-dataset.test.mjs` 覆盖：

1. OSM `height` 优先于 `levels` 和 GloBFP。
2. 无 OSM 高度时使用 GloBFP 匹配值，`heightSource="globfp"`。
3. 面积比 0.1 的邻近棚屋被拒绝匹配。
4. GloBFP 独有建筑：面积 80 m² 且在 20 m 外 → 接受；质心落在 OSM 多边形内 → 拒绝。
5. 两栋重叠 >30% 的 GloBFP 建筑 → 拒绝补全。
6. `overlapRatio` 对两个相同正方形返回 1，对相离正方形返回 0。
7. 投影后原点附近坐标为 0；所有高度为有限数。
8. `heightAt` 对 3×3 高度数组做双线性插值，越界 clamp，NaN 输入返回有限数。

- [ ] **Step 3: 运行确认失败**

Run: `node --test tests/build-dataset.test.mjs`
Expected: FAIL，模块不存在。

- [ ] **Step 4: 实现**

使用 `polygon-clipping` 计算重叠面积；实现 Douglas-Peucker（容差 0.5 m）。
高度匹配参数：半径 30 m、面积比 0.5–2.0。补全参数：最小面积 60 m²、
最小高度 3 m、最小距离 10 m、最大重叠 30%。建筑 `ground` 从
`terrain.json` 的 `heightAt` 采样；无地形时取 0。`waterLevel` 取水域区域
滤波高程中位数。按 `manifest` 记录 `heightSources` 计数与 `estimatedRatio`。

`tools/tower-heights.json` 至少包含：

```json
{
  "上海中心大厦": { "height": 632, "source": "https://www.ctbuh.org/" },
  "上海环球金融中心": { "height": 492, "source": "https://www.ctbuh.org/" },
  "金茂大厦": { "height": 420.5, "source": "https://www.ctbuh.org/" },
  "东方明珠电视塔": { "height": 468, "source": "官方公开资料" }
}
```

- [ ] **Step 5: 运行确认通过并生成数据**

Run: `node --test tests/build-dataset.test.mjs && node tools/build-dataset.mjs`
Expected: 测试通过；`public/data/city.json` 与 `manifest.json` 存在；
`manifest.counts.estimatedRatio <= 0.30`。

- [ ] **Step 6: 提交**

```bash
git add material/上海外滩v3.0/tools/build-dataset.mjs material/上海外滩v3.0/tools/tower-heights.json material/上海外滩v3.0/src/data/terrainHeight.js material/上海外滩v3.0/tests/build-dataset.test.mjs material/上海外滩v3.0/public/data/city.json material/上海外滩v3.0/public/data/manifest.json
git commit -m "feat(v3): merge OSM and GloBFP into ENU city dataset

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: 数据集校验与来源文档

**Files:**
- Create: `material/上海外滩v3.0/tools/verify-dataset.mjs`
- Create: `material/上海外滩v3.0/DATA-SOURCES.md`
- Test: `material/上海外滩v3.0/tests/verify-dataset.test.mjs`

**Interfaces:**
- Produces: `verifyDataset(city, terrain, manifest) -> { ok: boolean, errors: string[] }`。
- Produces: `npm run data:verify`，失败时退出码 1。

- [ ] **Step 1: 写失败测试**

覆盖：

1. 合法最小数据集 `ok=true`。
2. 重复建筑 ID → `ok=false`。
3. `estimatedRatio > 0.30` → `ok=false`。
4. 建筑高度为 NaN 或 >700 → `ok=false`。
5. 四大地标缺失或位置偏差 >30 m → `ok=false`。
6. 水域为空或 terrain 尺寸/高程异常 → `ok=false`。

四大地标期望坐标（WGS84）：

| 名称 | 经度 | 纬度 |
| --- | --- | --- |
| 上海中心大厦 | 121.5016 | 31.2354 |
| 上海环球金融中心 | 121.5012 | 31.2374 |
| 金茂大厦 | 121.5010 | 31.2370 |
| 东方明珠电视塔 | 121.4998 | 31.2397 |

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/verify-dataset.test.mjs`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现校验器**

检查字段、唯一 ID、高度范围 2–700、坐标在场景范围内、四大地标按名称存在
且质心距离期望坐标 <30 m、`estimatedRatio <= 0.30`、水域/道路非空、
terrain 尺寸与范围一致。CLI 打印每项检查与统计，失败退出 1。

- [ ] **Step 4: 写 `DATA-SOURCES.md`**

列出：OSM（ODbL 1.0，`© OpenStreetMap contributors`，抓取日期、API 地址）、
3D-GloBFP（CC BY 4.0，Figshare 文件 54116807，论文 DOI）、Copernicus DEM
（30 m，下载 URL、许可）、四大地标高度来源。附下载 URL、文件大小与 SHA-256。

- [ ] **Step 5: 运行确认通过**

Run: `node --test tests/verify-dataset.test.mjs && npm run data:verify`
Expected: 6 passed；`data:verify` 输出 `OK`，退出码 0。

- [ ] **Step 6: 提交**

```bash
git add material/上海外滩v3.0/tools/verify-dataset.mjs material/上海外滩v3.0/tests/verify-dataset.test.mjs material/上海外滩v3.0/DATA-SOURCES.md
git commit -m "feat(v3): verify dataset and document data sources

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 阶段二：运行时骨架

### Task 7: 应用外壳、数据加载与灰盒场景

**Files:**
- Create: `material/上海外滩v3.0/src/config.js`
- Create: `material/上海外滩v3.0/src/data/loadCity.js`
- Modify: `material/上海外滩v3.0/src/main.js`
- Create: `material/上海外滩v3.0/src/world/index.js`
- Create: `material/上海外滩v3.0/tests/load-city.test.mjs`
- Create: `material/上海外滩v3.0/tests/fixtures/city-min.json`
- Modify: `material/上海外滩v3.0/tests/browser.spec.mjs`

**Interfaces:**
- Produces: `loadCity(cityUrl, terrainUrl) -> Promise<{ city, terrain }>`；
  `parseCity(json) -> CityData`（非法时抛错）；`validateCity(data) -> string[]`；
  `validateTerrain(data) -> string[]`。
- Produces: `createWorld({ scene, camera, city, terrain }) -> World`，灰盒阶段返回
  `{ group, update(), stats, landmarkSites }`。
- Produces: `window.__bund = { ready, city, terrain, scene, camera, renderer, world, stats, setView(name), pickAt(x, y) }`。

- [ ] **Step 1: 写 `loadCity` 失败测试**

用 `tests/fixtures/city-min.json` 覆盖：`parseCity` 合法数据返回对象；缺 `buildings`
抛错；建筑缺 `ring` 抛错；`validateCity` 对 `water` 为空返回错误信息；
`validateTerrain` 对尺寸不符或 NaN 返回错误。

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/load-city.test.mjs`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 `config.js` 与 `loadCity.js`**

`config.js` 导出 `ORIGIN`、`BOUNDS`、`LANDMARKS`（名称 → 期望高度/模型键）、
`VIEWS`（overview 与四个地标机位）。`VIEWS` 是近似 ENU 值，Task 16 落地标后校准。
`loadCity` 用 `fetch` 并行加载 `./data/city.json` 与 `./data/terrain.json`，
分别交给 `parseCity` 与 `validateTerrain`；`validateCity` 检查必需数组、字段与数值范围。

- [ ] **Step 4: 实现灰盒世界**

`createWorld` 添加地面网格、坐标轴、四大地标位置的半透明盒子（高度取
`city.buildings` 中同名建筑），确保灰盒阶段能看到正确相对位置。
`main.js` 加载 `./data/city.json` 与 `./data/terrain.json`，设置相机、OrbitControls、
循环、`window.__bund.ready = true`、加载进度与错误提示。

- [ ] **Step 5: 扩展浏览器测试**

在 `tests/browser.spec.mjs` 增加：

```js
test("loads city data and places landmark boxes", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__bund?.ready === true, null, { timeout: 60000 });
  const stats = await page.evaluate(() => window.__bund.stats);
  expect(stats.buildings).toBeGreaterThan(3000);
  expect(stats.landmarks).toBe(4);
  const shot = await page.screenshot({ path: "test-results/task-07.png" });
  expect(shot.length).toBeGreaterThan(20000);
});
```

- [ ] **Step 6: 运行确认通过**

Run: `node --test tests/load-city.test.mjs && npm run test:browser`
Expected: Node 测试通过；浏览器测试 2 passed；截图存在。

- [ ] **Step 7: 提交**

```bash
git add material/上海外滩v3.0/src material/上海外滩v3.0/tests
git commit -m "feat(v3): load city data into a gray-box scene

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: 地形网格

**Files:**
- Create: `material/上海外滩v3.0/src/world/terrain.js`
- Modify: `material/上海外滩v3.0/src/world/index.js`
- Test: `material/上海外滩v3.0/tests/terrain.test.mjs`

**Interfaces:**
- Produces: `createTerrain({ scene, terrain }) -> { group, mesh, heightAt(x, z) }`。
- Produces: `heightAt` 复用 `src/data/terrainHeight.js`，双线性插值，超出范围时 clamp。

- [ ] **Step 1: 写失败测试**

用 3×3 高度数组测试：中心点返回中值；四分之一位置返回线性插值；
边界外 clamp 到边缘；NaN 输入返回有限数。

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/terrain.test.mjs`
Expected: FAIL。

- [ ] **Step 3: 实现**

用 `PlaneGeometry` 或手写 `BufferGeometry` 生成网格，顶点 y 取 `terrain.heights`；
材质用 `MeshStandardMaterial`（土色/灰色）。`heightAt` 用行列双线性插值。
必须在浏览器测试中确认地形覆盖整个 bounds，且没有明显破面。

- [ ] **Step 4: 运行确认通过**

Run: `node --test tests/terrain.test.mjs && npm run test:browser`
Expected: 测试通过；浏览器截图 `test-results/task-08.png` 显示地形。

- [ ] **Step 5: 提交**

```bash
git add material/上海外滩v3.0/src/world/terrain.js material/上海外滩v3.0/src/world/index.js material/上海外滩v3.0/tests/terrain.test.mjs
git commit -m "feat(v3): render DEM terrain

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: 真实岸线水面

**Files:**
- Create: `material/上海外滩v3.0/src/world/water.js`
- Modify: `material/上海外滩v3.0/src/world/index.js`
- Test: `material/上海外滩v3.0/tests/water.test.mjs`

**Interfaces:**
- Produces: `buildWaterGeometry(waterPolygons, y) -> THREE.BufferGeometry`。
- Produces: `createWater({ scene, city }) -> { mesh, update(elapsed), applyPreset(state, sunDirection) }`。

- [ ] **Step 1: 写失败测试**

测试 `buildWaterGeometry`：单个矩形返回 2 个三角形；带内环的矩形返回外环三角化且
不把内环填满；空数组返回 0 三角形。

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/water.test.mjs`
Expected: FAIL。

- [ ] **Step 3: 实现**

用 `THREE.Shape` + `ShapeGeometry` 处理外环/内环，旋转到 XZ 平面，y 取
`city.waterLevel`；合并所有多边形后交给 `Reflector`。复用 v2 的水面 shader
参数（菲涅尔、夜间灯影、贴岸泡沫），没有岸线属性时省略泡沫。`applyPreset`
更新颜色、夜间强度与反射强度。

- [ ] **Step 4: 运行确认通过**

Run: `node --test tests/water.test.mjs && npm run test:browser`
Expected: 测试通过；截图 `test-results/task-09.png` 显示连续江面。

- [ ] **Step 5: 提交**

```bash
git add material/上海外滩v3.0/src/world/water.js material/上海外滩v3.0/src/world/index.js material/上海外滩v3.0/tests/water.test.mjs
git commit -m "feat(v3): render real shoreline water

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10: 道路与桥梁

**Files:**
- Create: `material/上海外滩v3.0/src/world/roads.js`
- Modify: `material/上海外滩v3.0/src/world/index.js`
- Test: `material/上海外滩v3.0/tests/roads.test.mjs`

**Interfaces:**
- Produces: `buildRoadRibbon(points, { widthM, heightAt, bridge = false, clearance = 8 }) -> THREE.BufferGeometry`。
- Produces: `createRoads({ scene, city, terrain }) -> { group, update(), stats }`。

- [ ] **Step 1: 写失败测试**

测试：3 点折线生成的 ribbon 顶点数正确；宽度为 20 m 时两侧偏移 ±10 m；
`bridge=true` 的道路顶点 y = `heightAt + clearance`；空点列返回空几何。

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/roads.test.mjs`
Expected: FAIL。

- [ ] **Step 3: 实现**

沿折线生成左右偏移条带；普通道路 y = `heightAt` + 0.15；桥梁 y =
`heightAt` + 桥面净高（8 m，写入 `config.js` 并标注估算）。用共享材质与
道路标线贴图；`stats` 记录道路数与桥梁数。隧道暂时按地面道路渲染并在数据中标记。

- [ ] **Step 4: 运行确认通过**

Run: `node --test tests/roads.test.mjs && npm run test:browser`
Expected: 测试通过；截图 `test-results/task-10.png` 显示路网。

- [ ] **Step 5: 提交**

```bash
git add material/上海外滩v3.0/src/world/roads.js material/上海外滩v3.0/src/world/index.js material/上海外滩v3.0/tests/roads.test.mjs
git commit -m "feat(v3): render OSM roads and bridges

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 11: 合并建筑几何、材质与拾取

**Files:**
- Create: `material/上海外滩v3.0/src/world/buildings.js`
- Create: `material/上海外滩v3.0/src/world/materials.js`
- Create: `material/上海外滩v3.0/src/utils/textures.js`
- Modify: `material/上海外滩v3.0/src/world/index.js`
- Test: `material/上海外滩v3.0/tests/buildings.test.mjs`

**Interfaces:**
- Produces: `extrudeBuilding(building, heightAt) -> THREE.BufferGeometry`。
- Produces: `buildFaceIndex(geometries) -> Uint32Array`，面序号 → 建筑数组下标。
- Produces: `createBuildings({ scene, city, terrain, materials }) -> { group, mesh, pick(raycaster), setEstimatedVisible(v), stats }`。

- [ ] **Step 1: 写失败测试**

测试：矩形建筑挤出后的 bbox 高度等于 `building.height`；带内环的建筑产生中空；
`buildFaceIndex` 长度等于总面数；`ground` 使用 `heightAt` 而不是 0；
NaN 高度被拒绝。

- [ ] **Step 2: 运行确认失败**

Run: `node --test tests/buildings.test.mjs`
Expected: FAIL。

- [ ] **Step 3: 实现**

用 `THREE.Shape` + `ExtrudeGeometry`（或手写侧墙 + 顶面）按 `ring/holes` 挤出；
基底 y = `heightAt(x,z)`，顶部 y = 基底 + `height`。按材质/高度带分 3–4 组合并；
UV 按建筑尺寸缩放。`materials.js` 提供 `facadeMaterial(kind)`、
`tagEmissive`、共享立面贴图；所有发光材质按 v2 的 `emissiveType` 分类。
Canvas 贴图必须惰性创建（函数调用时），保证 Node 测试导入模块时不访问 `document`。
`pick` 用 `Raycaster` 命中合并网格后，通过 `faceIndex` 查 `buildFaceIndex` 返回建筑 ID。
`setEstimatedVisible(false)` 隐藏 `heightSource="estimated"` 的建筑（用独立合并组）。

- [ ] **Step 4: 运行确认通过**

Run: `node --test tests/buildings.test.mjs && npm run test:browser`
Expected: 测试通过；浏览器测试断言 `stats.buildings === city.buildings.length`，
且 `window.__bund` 暴露 `pickAt(0.5,0.5)` 能返回一个建筑 ID。

- [ ] **Step 5: 提交**

```bash
git add material/上海外滩v3.0/src/world/buildings.js material/上海外滩v3.0/src/world/materials.js material/上海外滩v3.0/src/world/index.js material/上海外滩v3.0/tests/buildings.test.mjs
git commit -m "feat(v3): merge building geometry with picking

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 阶段三：四大地标

### Task 12: 上海中心

**Files:**
- Create: `material/上海外滩v3.0/src/world/landmarks/shanghaiTower.js`
- Test: `material/上海外滩v3.0/tests/landmarks.test.mjs`

**Interfaces:**
- Produces: `createShanghaiTower({ height = 632, floors = 128 }) -> { group, update(elapsed, state), stats }`。

- [ ] **Step 1: 写失败测试**

测试：`group` 的 bbox 高度与 `height` 误差 <1 m；无 NaN；三角形数 > 5000。
- [ ] **Step 2: 运行确认失败**：`node --test tests/landmarks.test.mjs` → FAIL。
- [ ] **Step 3: 实现**：120° 扭转的三叶圆角截面，按楼层放样；顶部冠部与螺旋灯缝；尺寸 1:1。
- [ ] **Step 4: 运行确认通过**：测试通过；在 Task 16 集成后浏览器截图。
- [ ] **Step 5: 提交**：`feat(v3): add Shanghai Tower model`。

---

### Task 13: 环球金融中心

**Files:**
- Create: `material/上海外滩v3.0/src/world/landmarks/swfc.js`
- Test: `material/上海外滩v3.0/tests/landmarks.test.mjs`（追加）

**Interfaces:**
- Produces: `createSWFC({ height = 492, floors = 101 }) -> { group, update, stats }`。

- [ ] **Step 1: 追加失败测试**：bbox 高度误差 <1 m；顶部开口存在（三角形数 > 3000）。
- [ ] **Step 2: 运行确认失败**。
- [ ] **Step 3: 实现**：参数化 U 形轮廓挤出"开瓶器"顶部，开口边缘冷光灯带。
- [ ] **Step 4: 运行确认通过**。
- [ ] **Step 5: 提交**：`feat(v3): add SWFC model`。

---

### Task 14: 金茂大厦

**Files:**
- Create: `material/上海外滩v3.0/src/world/landmarks/jinmao.js`
- Test: `material/上海外滩v3.0/tests/landmarks.test.mjs`（追加）

**Interfaces:**
- Produces: `createJinMao({ height = 420.5, floors = 88 }) -> { group, update, stats }`。

- [ ] **Step 1: 追加失败测试**：bbox 高度误差 <1 m；至少 10 段收分。
- [ ] **Step 2: 运行确认失败**。
- [ ] **Step 3: 实现**：八角形塔身逐层收分、金色腰带、塔尖与航空灯。
- [ ] **Step 4: 运行确认通过**。
- [ ] **Step 5: 提交**：`feat(v3): add Jin Mao Tower model`。

---

### Task 15: 东方明珠

**Files:**
- Create: `material/上海外滩v3.0/src/world/landmarks/pearl.js`
- Test: `material/上海外滩v3.0/tests/landmarks.test.mjs`（追加）

**Interfaces:**
- Produces: `createOrientalPearl({ height = 468 }) -> { group, update, stats }`。

- [ ] **Step 1: 追加失败测试**：bbox 高度误差 <1 m；三个球体存在（可用子节点名称断言）。
- [ ] **Step 2: 运行确认失败**。
- [ ] **Step 3: 实现**：三根立柱、三个球体（约 90/263/350 m）、斜撑、观光层、天线与航空灯。
- [ ] **Step 4: 运行确认通过**。
- [ ] **Step 5: 提交**：`feat(v3): add Oriental Pearl model`。

---

### Task 16: 地标落位与集成

**Files:**
- Create: `material/上海外滩v3.0/src/world/landmarks/index.js`
- Modify: `material/上海外滩v3.0/src/world/index.js`
- Modify: `material/上海外滩v3.0/tests/landmarks.test.mjs`
- Modify: `material/上海外滩v3.0/tests/browser.spec.mjs`

**Interfaces:**
- Produces: `findLandmarkSites(city) -> { pearl, shanghai, swfc, jinmao }`，每个站点含
  `{ x, z, ground, rotation, building }`。
- Produces: `createLandmarks({ scene, city, materials }) -> { group, sites, update(elapsed, state) }`。

- [ ] **Step 1: 写失败测试**

用 fixture 数据测试：按名称找到四栋建筑；站点坐标与建筑质心一致；
缺失地标时返回错误而不是静默跳过。

- [ ] **Step 2: 运行确认失败**。
- [ ] **Step 3: 实现**：从 `city.buildings` 按 `name` 查找；用轮廓质心与长轴确定
  `x/z/rotation`；将四个模型放在 `ground` 上，高度按配置缩放（保持 1:1）。
- [ ] **Step 4: 扩展浏览器测试**：`stats.landmarks === 4`；`setView("shanghai")`
  后截图 `test-results/task-16-shanghai.png`，上海中心高度与周边楼群比例正确。
- [ ] **Step 5: 运行确认通过并提交**：

```bash
git add material/上海外滩v3.0/src/world/landmarks material/上海外滩v3.0/src/world/index.js material/上海外滩v3.0/tests
git commit -m "feat(v3): place landmarks from OSM footprints

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 阶段四：视觉、环境与动态

### Task 17: 天空、材质与四时相时间系统

**Files:**
- Create: `material/上海外滩v3.0/src/world/sky.js`
- Create: `material/上海外滩v3.0/src/world/time.js`
- Modify: `material/上海外滩v3.0/src/world/materials.js`
- Modify: `material/上海外滩v3.0/src/utils/textures.js`
- Modify: `material/上海外滩v3.0/src/config.js`
- Test: `material/上海外滩v3.0/tests/time.test.mjs`

**Interfaces:**
- Produces: `TIME_PRESETS`，键为 `day | dusk | blue | night`。
- Produces: `createTimeSystem({ renderer, scene, world, bloomPass, sunLight, hemiLight, ambientLight, initial, onChange }) -> { state, current, setPreset(name), update(delta) }`。

- [ ] **Step 1: 写失败测试**

测试：四个预设包含 `NUMERIC_KEYS` 与 `COLOR_KEYS` 的全部键；`setPreset` 后
插值在 1.9 s 内到达目标；`applyEmissiveState` 按类型更新强度；未知预设被忽略。

- [ ] **Step 2: 运行确认失败**。
- [ ] **Step 3: 实现**：从 v2 复制并扩展 `sky.js`、`time.js`、`materials.js`、
  `utils/textures.js`；新增 `blue`（蓝调时刻）预设；复用环境贴图生成逻辑；
  天空球跟随相机；所有发光材质按 `emissiveType` 注册。
- [ ] **Step 4: 浏览器验证**：依次点击四个时间按钮，截图
  `test-results/task-17-{day,dusk,blue,night}.png`，无控制台错误。
- [ ] **Step 5: 提交**：

```bash
git add material/上海外滩v3.0/src/world/sky.js material/上海外滩v3.0/src/world/time.js material/上海外滩v3.0/src/world/materials.js material/上海外滩v3.0/src/utils/textures.js material/上海外滩v3.0/src/config.js material/上海外滩v3.0/tests/time.test.mjs
git commit -m "feat(v3): add four-state time system and sky

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 18: 树木、船只与街道设施

**Files:**
- Create: `material/上海外滩v3.0/src/world/trees.js`
- Create: `material/上海外滩v3.0/src/world/boats.js`
- Create: `material/上海外滩v3.0/src/world/streetFurniture.js`
- Modify: `material/上海外滩v3.0/src/world/index.js`
- Test: `material/上海外滩v3.0/tests/dynamics.test.mjs`

**Interfaces:**
- Produces: `createTrees({ scene, city }) -> { group, stats }`。
- Produces: `createBoats({ scene, city }) -> { group, update(delta, elapsed, state) }`。
- Produces: `createStreetFurniture({ scene, city, terrain }) -> { group, stats }`。

- [ ] **Step 1: 写失败测试**

测试：树木位置全部落在场景范围内且 y 有限；船只沿 `riverCenterlines` 的路径点
前进，`update` 后位置变化且不倒退；街道设施数量 > 0。
- [ ] **Step 2: 运行确认失败**。
- [ ] **Step 3: 实现**：树木用 `InstancedMesh`；船只沿 OSM 中心线分航线往返/循环，
  装饰性标注；路灯/栏杆沿道路与岸线实例化。
- [ ] **Step 4: 浏览器验证**：截图 `test-results/task-18.png`；船只可见、无穿地。
- [ ] **Step 5: 提交**：`feat(v3): add trees, boats and street furniture`。

---

### Task 19: HUD 与交互

**Files:**
- Modify: `material/上海外滩v3.0/index.html`
- Create: `material/上海外滩v3.0/src/ui/ui.js`
- Create: `material/上海外滩v3.0/src/style.css`
- Modify: `material/上海外滩v3.0/src/main.js`
- Modify: `material/上海外滩v3.0/tests/browser.spec.mjs`

**Interfaces:**
- Produces: `createUI({ onTimeChange, onLandmark, onToggleOrbit, onResetView, onToggleRoam, onToggleEstimated }) -> { setTime, setLandmark, setOrbit, setRoam, setEstimated }`。
- 按钮使用 `data-time` 与 `data-landmark` 属性；键盘 `1/2/3/4`、`Space`、`R`。

- [ ] **Step 1: 写浏览器测试**：四个时间按钮可点击且 `aria-pressed` 正确；
  四个地标按钮 + 外滩 + 全景存在；点击"上海中心"后相机位置改变；
  加载层消失；无控制台错误。
- [ ] **Step 2: 运行确认失败**（选择器不存在）。
- [ ] **Step 3: 实现** HTML HUD、样式与事件绑定；时间切换、地标飞行、自动环绕、
  重置视角、估算建筑开关；键盘快捷键。
- [ ] **Step 4: 运行确认通过**：`npm run test:browser`；截图 `test-results/task-19.png`。
- [ ] **Step 5: 提交**：`feat(v3): add HUD and camera interactions`。

---

## 阶段五：交互、性能与验收

### Task 20: 建筑属性面板与城市漫游

**Files:**
- Create: `material/上海外滩v3.0/src/ui/inspector.js`
- Create: `material/上海外滩v3.0/src/ui/roam.js`
- Modify: `material/上海外滩v3.0/src/main.js`
- Test: `material/上海外滩v3.0/tests/inspector.test.mjs`
- Modify: `material/上海外滩v3.0/tests/browser.spec.mjs`

**Interfaces:**
- Produces: `formatBuilding(building) -> { title: string, rows: [string, string][] }`。
- Produces: `createInspector({ container }) -> { show(building), hide() }`。
- Produces: `createRoam({ camera, domElement, controls, terrain, city }) -> { enable(), disable(), update(delta), enabled }`。
- 在 `window.__bund` 暴露 `inspector` 与 `roam`，供浏览器测试直接调用。

- [ ] **Step 1: 写失败测试**：`formatBuilding` 对 `osm:height`、`globfp`、`estimated`
  分别输出正确的中文来源标签；缺名称时显示 OSM ID；高度保留 1 位小数。
- [ ] **Step 2: 运行确认失败**。
- [ ] **Step 3: 实现** 属性面板与漫游：点击建筑 → 面板；WASD + 指针锁 + 地面跟随
  （视高 1.7 m）；首版不做建筑碰撞，只做地面 clamp。
- [ ] **Step 4: 浏览器测试**：`window.__bund.pickAt(0.5, 0.5)` 返回 ID；
  面板显示；开启漫游后按 `W` 相机位置变化；截图 `test-results/task-20.png`。
- [ ] **Step 5: 提交**：`feat(v3): add building inspector and walk mode`。

---

### Task 21: 性能、LOD 与数据等级开关

**Files:**
- Modify: `material/上海外滩v3.0/src/main.js`
- Modify: `material/上海外滩v3.0/src/world/buildings.js`
- Create: `material/上海外滩v3.0/tests/performance.spec.mjs`

**Interfaces:**
- Produces: `window.__bund.stats = { buildings, triangles, drawCalls, landmarks, estimatedRatio }`。
- Produces: `?debug=stats` 叠加层。

- [ ] **Step 1: 写浏览器性能测试**：等待 ready 后读取 `stats`，以
  `manifest.counts.buildings` 为基准（允许 ±10%），断言
  `triangles < 2_500_000`、`drawCalls < 300`；记录 2 秒 rAF 帧数但不硬性失败。
- [ ] **Step 2: 运行确认失败**（stats 字段不存在）。
- [ ] **Step 3: 实现** 统计、估算建筑独立合组与开关、必要时按距离合并/降级；
  像素比 ≤1.5；阴影只在太阳变化时重绘。
- [ ] **Step 4: 运行确认通过**；截图 `test-results/task-21.png`。
- [ ] **Step 5: 提交**：`perf(v3): add stats, LOD and estimated toggle`。

---

### Task 22: 精度报告、README 与最终验证

**Files:**
- Create: `material/上海外滩v3.0/docs/accuracy-report.md`
- Create: `material/上海外滩v3.0/README.md`
- Modify: `material/上海外滩v3.0/DATA-SOURCES.md`
- Create: `material/上海外滩v3.0/LICENSE`（MIT，代码）
- Modify: `material/上海外滩v3.0/tests/browser.spec.mjs`

**Interfaces:**
- 交付可运行的 `npm run dev` / `npm run build`；全部测试通过；报告含实测数字。

- [ ] **Step 1: 写精度报告**

包含：四大地标位置误差（米）、高度与来源对比、`heightSources` 统计、
`estimatedRatio`、GloBFP 超高层低估说明、DEM 滤波前后统计、道路宽度估算说明、
已知限制、数据日期与校验和。

- [ ] **Step 2: 写 README**

快速开始、交互说明、数据管线命令、目录结构、许可与署名、性能说明。
必须包含 `© OpenStreetMap contributors`、3D-GloBFP CC BY 4.0、
Copernicus DEM 署名。

- [ ] **Step 3: 最终浏览器验收测试**

增加一个完整流程测试：加载 → 四个时间状态 → 四个地标 → 点击建筑 →
漫游开关 → 截图五张；断言无控制台错误、canvas 非空。

- [ ] **Step 4: 运行全部验证**

```bash
npm test
npm run data:verify
npm run build
npm run test:browser
```

Expected: 全部通过；`dist/` 生成；截图齐全；报告数字与 `manifest.json` 一致。

- [ ] **Step 5: 提交**

```bash
git add material/上海外滩v3.0
git commit -m "docs(v3): add accuracy report and final verification

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 自检清单

- [ ] 每个 spec 要求都有对应任务：数据管线（1–6）、坐标（2、7）、地形（8）、水域（9）、道路（10）、建筑（11）、地标（12–16）、视觉（17–18）、交互（19–20）、性能（21）、验收（22）。
- [ ] 所有测试命令可执行；Node 测试与 Playwright 测试分离。
- [ ] 类型/字段名一致：`heightSource`、`ring`、`holes`、`areaM2`、`ground`、`waterLevel`、`buildFaceIndex`。
- [ ] Review Focus 的 5 类失败都有测试归属。
- [ ] 没有用虚构数据替代真实数据；估算值有来源标记与比例上限。
