# 诛仙 · 青云山七峰 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `material/诛仙青云山七峰/` 交付一个全程序化 Three.js 仙侠山脉场景：七座差异化主峰、体积云海、山门建筑群、36 秒五镜头电影与 2K60 成片。

**Architecture:** 单一解析高度函数 `heightAt(x,z)` 驱动同心方环地形网格；七峰由参数化轮廓叠加而成。渲染链为场景 → 半分辨率体积云 Pass → Bloom → 调色 → 输出；建筑、植被、水体全部程序化并由共享材质与实例化支撑。影片由纯函数时间线 `filmTimeline.js` 驱动，`film.js` 负责 DOM 与状态。

**Tech Stack:** three 0.186.0、Vite 7、playwright-core、FFmpeg、Python 3 + numpy/scipy。

**Spec:** `docs/superpowers/specs/2026-11-18-qingyun-seven-peaks-design.md`

## Global Constraints

- Node.js ≥ 20.19；桌面 WebGL 2；所有渲染在浏览器内完成。
- 依赖仅限 `three@0.186.0`、`vite@^7.1.0`、`playwright-core@^1.64.1`；不得引入模型/图片/音频文件。
- 坐标：X 东、Z 南、Y 上；1 世界单位 = 1 米。谷地基准 Y = 420。
- 输出：2560×1440、60 fps、36.0 s、H.264 + AAC、响度 -18 LUFS。
- 每个模块导出 `createX(...)` 并返回 `{ group, update(...) }`，在 `world/index.js` 装配。
- 所有随机必须来自 `seededRandom`；捕获模式下由 `deterministic.js` 覆盖 `Math.random`。
- 中文 UI 与字幕使用系统衬线字体；字幕文案以本计划为准。

## Review Focus

1. **方环地形接缝**：相邻环共享边必须逐顶点重合；低机位掠射不应见裂缝。测试：`test-core` 校验边界采样一致，Task 2 截图从贴地视角检查。
2. **云 Pass 深度兼容**：composer 渲染目标必须带 `DepthTexture` 且不用 MSAA；窗口 resize 后云不消失、不黑屏。测试：Task 4 的 resize 截图。
3. **相机穿地**：自由飞行与低空镜头不得钻入地形；`main.js` 每帧以 `heightAt` 抬高相机。测试：Task 9 的低空机位截图 + 断言。
4. **阴影焦点切换**：切镜或飞行后阴影必须立即跟随新焦点，不能残留旧投影。测试：Task 9 在两次 `setShadowFocus` 后截图对比。
5. **时间轴可重放**：任意拖动到同一 `t` 两次，画面一致（云、植被、瀑布状态都由绝对时间推导）。测试：Task 13 `renderAt` 两次截图字节一致。

---

### Task 1: 项目脚手架、配置、噪声与高度函数

**Files:**
- Create: `package.json`, `vite.config.js`, `.gitignore`, `index.html`, `src/style.css`
- Create: `src/config.js`, `src/utils/noise.js`, `src/world/shape.js`
- Create: `src/deterministic.js`, `src/main.js`（仅空场景）
- Test: `scripts/test-core.mjs`

**Interfaces:**
- Produces:
  - `config.js`：`WORLD { valleyBase:420, cloudBase:740, cloudTop:1080, bandBase:1150, bandTop:1500, far:19200 }`；`PEAKS: Peak[]`；`CAMERA_VIEWS`；`SUN_KEYS`；`COLORS`；`ATMOSPHERE`。
  - `Peak = { id, name, x, z, height, radius, plateau, ridge, seed, stretch, rotation, palette }`
  - `noise.js`：`seededRandom(seed) -> () => number`、`fbm2(x,z,octaves,seed)`、`ridged2(x,z,octaves,seed)`、`hash2`、`valueNoise2`、`smoothstep`、`clamp`。
  - `shape.js`：`heightAt(x,z) -> number`、`normalAt(x,z,target?) -> THREE.Vector3`（单位向量）、`peakHeightAt(peakId) -> number`。
- PEAKS 精确值：

```js
[
  { id:"tongtian", name:"通天峰", x:0,     z:0,     height:1790, radius:1500, plateau:150, ridge:5, seed:11, stretch:1.12, rotation:0.35, palette:"granite" },
  { id:"longshou", name:"龙首峰", x:-200,  z:-2900, height:1540, radius:1250, plateau:90,  ridge:7, seed:23, stretch:1.65, rotation:2.10, palette:"darkRock" },
  { id:"luoxia",   name:"落霞峰", x:-2350, z:-1750, height:1270, radius:1050, plateau:80,  ridge:6, seed:37, stretch:1.05, rotation:1.15, palette:"autumn" },
  { id:"fenghui",  name:"风回峰", x:-3250, z:250,   height:1600, radius:1250, plateau:85,  ridge:8, seed:41, stretch:1.30, rotation:0.80, palette:"granite" },
  { id:"dazhu",    name:"大竹峰", x:-2000, z:2600,  height:1170, radius:1400, plateau:140, ridge:4, seed:53, stretch:1.10, rotation:2.70, palette:"bamboo" },
  { id:"xiaozhu",  name:"小竹峰", x:1700,  z:2900,  height:1330, radius:1000, plateau:70,  ridge:9, seed:67, stretch:0.72, rotation:1.70, palette:"bamboo" },
  { id:"chaoyang", name:"朝阳峰", x:3100,  z:-250,  height:1450, radius:1300, plateau:110, ridge:5, seed:79, stretch:1.20, rotation:1.95, palette:"granite" }
]
```

- `SUN_KEYS`（影片绝对秒）：`[{t:0,elevation:14,azimuth:315,color:0xffd2a1,skyTop:0x3f6ea8,skyHorizon:0xf3c58e,fog:0xd9a97e,exposure:1.08}, {t:18,elevation:9,...}, {t:30,elevation:6,...}, {t:36,elevation:4,color:0xff8a52,...}]`；`azimuth` 为从 +X 逆时针的度数，315° 指向西北（太阳落在落霞峰方向）。
- `CAMERA_VIEWS`：`overview [6200,2600,7600] → [0,950,0]`；`tongtian [900,1980,1200] → [0,1790,0]`；`longshou [-300,1800,-1900] → [-200,1500,-2900]`；`luoxia [-1200,1620,-850] → [-2350,1280,-1750]`；`fenghui [-3900,1500,900] → [-3250,1450,250]`；`dazhu [-2350,1500,3300] → [-2000,1150,2600]`；`xiaozhu [900,1500,3500] → [1700,1320,2900]`；`chaoyang [3900,1650,500] → [3100,1450,-250]`。

- [ ] **Step 1: 写失败的核心测试**

`scripts/test-core.mjs`：

```js
import assert from "node:assert/strict";
import { PEAKS, WORLD } from "../src/config.js";
import { heightAt, normalAt, peakHeightAt } from "../src/world/shape.js";
import { seededRandom, fbm2 } from "../src/utils/noise.js";

for (const p of PEAKS) {
  assert.ok(Math.abs(peakHeightAt(p.id) - p.height) < 2, `${p.id} summit`);
  assert.ok(heightAt(p.x, p.z) > WORLD.cloudTop, `${p.id} above clouds`);
}
const saddle = heightAt(-1000, 1300);
assert.ok(saddle < 1000, `saddle too high: ${saddle}`);
for (let i = 0; i < PEAKS.length; i++)
  for (let j = i + 1; j < PEAKS.length; j++) {
    const a = PEAKS[i], b = PEAKS[j];
    assert.ok(Math.hypot(a.x-b.x, a.z-b.z) > 2000, `${a.id}/${b.id} too close`);
  }
const n = normalAt(0, 0);
assert.ok(Math.abs(n.length() - 1) < 1e-3, "normal unit");
const r1 = seededRandom(7), r2 = seededRandom(7);
assert.equal(r1(), r2());
assert.ok(Number.isFinite(fbm2(12.3, -4.5, 4, 9)));
assert.equal(heightAt(0, 0), heightAt(0, 0));
console.log("core ok");
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/test-core.mjs`
Expected: 报错 `Cannot find module .../src/config.js`

- [ ] **Step 3: 实现脚手架与核心函数**

`package.json` 使用与枫桥夜泊相同的依赖与脚本（`test` 指向 `node scripts/test-core.mjs`）。`index.html` 只含 `<canvas id="scene">`、`#loading` 与 `#fallback`。`main.js` 创建 renderer（ACES、pixelRatio ≤1.6）、PerspectiveCamera(42°)、OrbitControls、天空色清屏和动画循环，暴露 `window.__qingyun`。

`shape.js` 算法（实现者照此写）：

1. `base = WORLD.valleyBase + 60 * fbm2(x*0.00016, z*0.00016, 4, 3)`。
2. 对每个峰：旋转 `(dx,dz)` 到峰本地系，按 `stretch` 缩放后求 `d`；有效半径
   `R = radius * (0.78 + 0.34 * ridged2(angle*ridge, d*0.0008 + seed, 3, seed))`；
   `t = clamp(1 - d/R, 0, 1)`；贡献 `body = (height - WORLD.valleyBase) * pow(t, 2.2) * asym`，
   其中 `asym = 1 + 0.12 * sin(angle*3 + seed)`。
3. 峰体用 smooth-max（k=60）合并，避免相邻峰简单相加把峰顶抬高。
4. 峰顶平台：`d < plateau` 时用 smoothstep 压平到 `height`；`plateau..plateau*1.6` 过渡。
5. 叠加细节：`24 * fbm2(x*0.004,z*0.004,4,seed)` 乘以高度权重（峰顶权重 0）；减去
   `12 * ridged2(x*0.0018, z*0.0018, 4, seed+5)` 形成冲沟。
6. 远山：在半径 9–15 km 增加 5 条宽 gaussian 山脊（高 600–1100），让地平线不空。
7. `heightAt` 必须纯函数、无随机、无缓存副作用；`normalAt` 用中心差分，步长 4 m。

- [ ] **Step 4: 运行测试**

Run: `node scripts/test-core.mjs`
Expected: 输出 `core ok`；若峰顶高度因合并偏差 >2 m，调整 smooth-max 与平台权重，不得放宽断言。

- [ ] **Step 5: 启动确认**

Run: `npm install && npm run dev`
Expected: 页面显示空场景与加载遮罩，浏览器控制台无错误。

- [ ] **Step 6: 提交**

```bash
git add material/诛仙青云山七峰
git commit -m "feat(qingyun): scaffold project, peaks config and height field"
```

---

### Task 2: 地形网格、材质与烘焙 AO

**Files:**
- Create: `src/utils/textures.js`（先实现 `createRockTexture`、`createGroundTexture`）
- Create: `src/world/materials.js`, `src/world/terrain.js`, `src/world/index.js`
- Modify: `src/main.js`, `index.html`
- Test: `scripts/test-core.mjs`（追加接缝断言）

**Interfaces:**
- Consumes: `heightAt`, `normalAt`, `PEAKS`, `WORLD`。
- Produces:
  - `materials.js`: `createMaterials() -> { rock, ground, ... }`（`MeshStandardMaterial` 工厂，缓存）。
  - `terrain.js`: `createTerrain(scene) -> { group, sampleHeight, sampleNormal, ringCount, vertexCount }`。
  - `index.js`: `createWorld(scene, camera) -> { update(delta, elapsed, state), terrain }`。
- 方环参数：6 环，ring 0 单元 6 m / 半边长 1200 m；ring k 单元 `6*2^k`、半边长 `1200*2^k`，最大 38.4 km；每环是挖去内圈的方环三角网格，顶点坐标取整到该环网格。

- [ ] **Step 1: 追加接缝测试**

在 `test-core.mjs` 末尾断言：对 ring 0/1 的共享边界坐标（例如 `x = -1200, z ∈ {-1200,-600,...,1200}`），用同一 `heightAt` 采样两次相等；并断言 `heightAt` 在 ring 0 外边界的相邻顶点高差的连续性（`|h(x)-h(x+6)| < 400`）。先运行确认失败或通过都记录。

- [ ] **Step 2: 实现几何**

`terrain.js` 用 `BufferGeometry` 逐环生成 `(segments+1)² - inner²` 顶点与索引；法线用 `normalAt` 而非 `computeVertexNormals`，保证环间一致。顶点属性 `color` 按坡度、高度、palette 写入岩壁/林地/竹坡/秋林色；另写 `aAO` 属性（半球 8 方向对 `heightAt` 采样，返回值 0.55–1）。

- [ ] **Step 3: 地形材质**

`MeshStandardMaterial({ vertexColors:true, roughness:0.94, metalness:0 })` + `onBeforeCompile` 注入：世界坐标三平面岩壁细节、坡度混合草地细节、`aAO` 调制间接光。`map` 用 Canvas 生成的灰阶噪点贴图（256²，`RepeatWrapping`）。

- [ ] **Step 4: 装配**

`world/index.js` 创建 terrain 并挂到 scene；`main.js` 让相机初始位于 `CAMERA_VIEWS.overview`，调用 `world.update`。添加临时环境光保证可见。

- [ ] **Step 5: 视觉验证**

Run: `npm run dev`，访问 `?view=overview`，确认：七峰可数、无裂缝、无 NaN 黑面。再从 `?view=ground`（相机 `heightAt+3` 的贴地视角）截图检查接缝。

- [ ] **Step 6: 提交**

```bash
git add material/诛仙青云山七峰
git commit -m "feat(qingyun): clipmap terrain with baked AO and triplanar material"
```

---

### Task 3: 天空、太阳、雾与时间状态

**Files:**
- Create: `src/world/sky.js`
- Create: `src/utils/textures.js`（追加 `createCloudNoise3D`）
- Modify: `src/world/index.js`, `src/main.js`
- Test: `scripts/test-core.mjs`

**Interfaces:**
- Produces:
  - `sky.js`: `createSky(scene, renderer) -> { group, sunLight, hemiLight, setTime(t), update(delta,state), environment }`
  - `config.js` 追加 `sunDirectionAt(t) -> THREE.Vector3`（由 `SUN_KEYS` 插值）。
- 天空穹顶半径 24000，`ShaderMaterial`：天顶/地平线渐变、太阳盘 + 光晕、两层 FBM 卷云；`sunLight` 为 `DirectionalLight`，`hemiLight` 冷暖双色。
- 环境贴图：用 `PMREMGenerator.fromScene(skyScene)` 在时间关键帧变化 >0.5° 时重建，缓存。

- [ ] **Step 1: 测试太阳插值**

断言 `sunDirectionAt(0)` 与 `sunDirectionAt(36)` 均为单位向量、仰角单调下降；`SUN_KEYS` 首尾 t 覆盖 0 与 36。

- [ ] **Step 2: 实现天空 shader 与光照**

`setTime(t)` 插值颜色/仰角/曝光，更新 uniform、`sunLight.color/intensity/direction`、`scene.fog`（`FogExp2(0x..., 0.00006)`）、`renderer.toneMappingExposure`。

- [ ] **Step 3: 环境贴图**

在 `world/index.js` 初始化后调用一次 `setTime(0)`，并用 `PMREMGenerator` 生成环境贴图赋给 `scene.environment`。

- [ ] **Step 4: 验证**

从 overview 与 ground 两个机位截图：太阳方位在西北、地平线暖、天空冷、雾不吃掉近景。

- [ ] **Step 5: 提交**

```bash
git commit -am "feat(qingyun): procedural sky, sun keyframes and atmosphere"
```

---

### Task 4: 体积云海 Pass

**Files:**
- Create: `src/world/clouds.js`
- Modify: `src/main.js`（composer 链）、`src/world/index.js`
- Test: `scripts/verify-scene.mjs`（新建，Task 13 前先提供 resize 检查）

**Interfaces:**
- Produces:
  - `clouds.js`: `createClouds({ renderer, camera }) -> { pass, update(delta, state), setEnabled(bool), setDepthTexture(tex), uniforms }`。
  - `pass` 是 `three/addons/postprocessing/Pass.js` 的子类实例，含 `setSize(w,h)`。
- 云层：主体 Y 740–1080（密度峰 820–950），山腰带 1150–1500（密度 ×0.15）；3D 噪声纹理 64³ 可平铺 `RedFormat`/`UnsignedByteType`；32 步、4 步光照；半分辨率。
- 主渲染目标：`new THREE.WebGLRenderTarget(1,1,{ type: HalfFloatType, depthTexture: new DepthTexture(1,1), depthBuffer:true })`，**不启用 MSAA**；抗锯齿由 `SMAAPass` 在 `OutputPass` 之后完成。

- [ ] **Step 1: 实现噪声纹理**

`createCloudNoise3D(size=64, seed)` 生成两通道：低频 FBM 与高频细节；写入 `Data3DTexture`，`wrapS/T/R = RepeatWrapping`，`minFilter/magFilter = LinearFilter`。

- [ ] **Step 2: 实现 Pass**

`CloudPass.render(renderer, writeBuffer, readBuffer)`：
1. 半分辨率 `WebGLRenderTarget` 渲染 raymarch（全屏三角形，uniform：`tDepth`、`cameraNear/Far`、`inverseProjectionMatrix`、`cameraMatrixWorld`、`tNoise`、`uTime`、`uSunDirection`、`uSunColor`、`uEnabled`）。
2. 用另一全屏三角形把半分辨率结果双线性合成到 `writeBuffer`（原场景颜色来自 `readBuffer`）。
3. 深度：从 `tDepth` 还原视空间距离，步进越界即终止；在云边界 8 m 内做软 alpha。
4. 无云或 `uEnabled=0` 时直接拷贝 `readBuffer`。

- [ ] **Step 3: 接入 composer**

`main.js`：composer 的主 RT 带 depthTexture → `RenderPass` → `world.clouds.pass` → `UnrealBloomPass` → `GradePass` → `OutputPass` → `SMAAPass`。把 `composer.renderTarget1.depthTexture` 传给 `setDepthTexture`。resize 时 `pass.setSize` 与 RT 同步。

- [ ] **Step 4: 验证**

- overview 截图：七峰底部没入云海、峰顶露出、云有明暗与银边。
- 把窗口改到 1280×720 再回 2560×1440，截图：云不消失、不糊成全屏白。
- 控制台无 shader 错误。

- [ ] **Step 5: 提交**

```bash
git commit -am "feat(qingyun): half-res raymarched volumetric cloud sea with depth occlusion"
```

---

### Task 5: 建筑构件库

**Files:**
- Create: `src/world/buildings.js`
- Create: `src/utils/textures.js`（追加 `createRoofTileTexture`、`createWoodTexture`、`createLatticeTexture`、`createStoneTexture`、`createPlaqueTexture`）
- Create: `src/world/materials.js`（追加建筑材质）
- Test: `scripts/test-buildings.mjs`

**Interfaces:**
- Produces（均返回 `THREE.Group`，原点在底面中心）：
  - `createPlatform({ width, depth, height, steps })`
  - `createRoof({ width, depth, height, tiers=1, upturn=0.55, overhang=1.4, color })`
  - `createHall({ width, depth, height, bays=5, roofHeight, tiers=1 })`
  - `createGate({ width, height })`
  - `createPavilion({ radius, height, tiers=1 })`
  - `createPagoda({ radius, levels })`
  - `createStaircase({ from, to, width, risers })`（`from/to` 为 `Vector3`，沿坡放样）
  - `createBalustrade({ points, height=1.1 })`（点数组，沿折线布置望柱与栏杆）
  - `createBridge({ from, to, width, arch })`
  - `createLantern({ height, color })`（返回 `{ group, material }`，材质登记为 `emissiveType:"lamp"`）
  - `createIncenseBurner({ size })`, `createStele({ width, height, text })`
- 几何约束：屋顶为两层坡面 + 正脊 + 四角起翘；瓦垄用重复几何或贴图；斗拱带用实例化小构件。

- [ ] **Step 1: 写失败测试**

`scripts/test-buildings.mjs`：对每个构件创建后遍历 `group`，断言所有 `BufferGeometry.position` 数值有限、包围盒三轴尺寸 > 0；`createRoof({tiers:2})` 的子网格数大于单层；`createStaircase` 的总升高等于 `to.y - from.y`（±0.01）。

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/test-buildings.mjs`
Expected: 模块不存在。

- [ ] **Step 3: 实现构件**

按接口逐个实现；共享几何缓存（同一尺寸不重复生成）；栏杆/斗拱/瓦当用 `InstancedMesh`。

- [ ] **Step 4: 运行测试**

Run: `node scripts/test-buildings.mjs`
Expected: 全部通过。

- [ ] **Step 5: 提交**

```bash
git commit -am "feat(qingyun): procedural Chinese palace building kit"
```

---

### Task 6: 七峰建筑群与场地

**Files:**
- Create: `src/world/peaks.js`
- Modify: `src/world/index.js`
- Test: `scripts/test-buildings.mjs`（追加峰组断言）

**Interfaces:**
- Consumes: 建筑构件库、`heightAt`、`PEAKS`。
- Produces:
  - `createPeaks(scene) -> { group, complexes, update(delta,state) }`
  - `complexes[id] = { plateauY, center: Vector3, landmark: Vector3 }`，供相机与灯光聚焦。
- 每峰台地高度 = `peak.height - 4`；建筑体量不得悬空，基座用 `createPlatform` 补齐与地形的落差。
- 组合（最低体量要求）：
  - 通天峰：牌坊、120 级玉阶、广场香炉、玉清殿（重檐五开间）、后殿、东西配殿、钟亭、栏杆。
  - 龙首峰：石殿、铁索栈道（沿脊线折线）、碑崖、望云台。
  - 落霞峰：三层临崖楼阁、秋林石亭、西向长廊。
  - 风回峰：廊桥、观瀑平台、石灯、水潭边栏杆。
  - 大竹峰：守静堂院落、木栈道、柴门、晒药架。
  - 小竹峰：望月台重檐亭、小殿、竹林小径。
  - 朝阳峰：山门、阶梯台地、观日台、钟亭。

- [ ] **Step 1: 追加断言**

每个峰至少 5 个建筑 `Group`；`complexes[id].plateauY` 与 `heightAt(center.x,center.z)` 差 < 6；所有建筑包围盒最低点 ≥ 台地 - 8。

- [ ] **Step 2: 实现组合与场地平整**

台地已在 `shape.js` 的 `plateau` 中压平；建筑按峰本地朝向布置（不要求朝南）。玉阶从云线附近的 `heightAt` 起坡到台地边缘，用 `createStaircase` 放样。

- [ ] **Step 3: 验证**

逐峰截图（`?view=tongtian` 等），确认建筑落位、无悬空、主殿有台基/柱列/重檐/栏杆层次。

- [ ] **Step 4: 提交**

```bash
git commit -am "feat(qingyun): seven peak architectural complexes"
```

---

### Task 7: 植被（竹海、松、秋树、草）

**Files:**
- Create: `src/world/vegetation.js`
- Create: `src/utils/textures.js`（追加 `createBambooLeafTexture`、`createPineNeedleTexture`、`createGrassTexture`）
- Modify: `src/world/index.js`
- Test: `scripts/test-core.mjs`（植被采样断言可移到独立 `test-vegetation.mjs`）

**Interfaces:**
- Produces:
  - `createVegetation(scene) -> { group, update(delta,state), counts }`
  - `counts = { bamboo, pine, autumn, grass }`
- 分布：大竹峰 12000–15000 竿、小竹峰 5000–7000 竿；松 800–1200 棵；秋树 500–700 棵（落霞峰）；草 3000 簇。用 `seededRandom` 按峰与坡度筛选落点，查询 `heightAt` 贴地。
- 竹竿：实例化分段圆柱 + 竹节环；叶簇为交叉 alpha-test 卡片；顶点着色器按世界坐标施加风摆，`uWind` 由 `update` 驱动。

- [ ] **Step 1: 断言**

断言 `bamboo` 落在 [12000,15000]+[5000,7000] 区间；随机抽 200 个实例，其世界 Y 与 `heightAt(x,z)` 差 < 2；大竹峰区域竹实例数 > 0。

- [ ] **Step 2: 实现**

先做竹（最重），再做松/秋树/草；所有卡片用 `alphaTest:0.35`，避免透明排序。

- [ ] **Step 3: 验证**

大竹峰、小竹峰、落霞峰截图；确认竹海有密度、风摆可见、无漂浮与大面积穿插建筑。

- [ ] **Step 4: 提交**

```bash
git commit -am "feat(qingyun): instanced bamboo sea, pines, autumn groves with wind"
```

---

### Task 8: 瀑布、山泉、水潭、雾带与仙鹤

**Files:**
- Create: `src/world/water.js`, `src/world/mist.js`, `src/world/birds.js`
- Modify: `src/world/index.js`
- Test: `scripts/test-core.mjs`（位置合理性）

**Interfaces:**
- `createWater(scene) -> { group, update, waterfalls }`：风回峰瀑布（崖面样条水带 + 底部水雾 + 潭面 `Reflector` + 涟漪），大竹峰与小竹峰山泉。
- `createMist(scene) -> { group, update, setEnabled }`：3–4 层贴谷雾片 + 瀑布水雾粒子。
- `createBirds(scene) -> { group, update }`：5 群仙鹤，固定航线，振翅/滑翔周期动画。
- 所有动画由绝对时间推导，可拖时间轴重放。

- [ ] **Step 1: 断言**

瀑布起点 Y 高于终点 Y 至少 300 m；仙鹤航线采样点在 `heightAt` 之上 150 m 以上；雾片不做地形穿透检查但必须低于 1600 m。

- [ ] **Step 2: 实现**

瀑布用滚动噪声 alpha 水带 + 底部 `Points` 水雾；潭面用小型 `Reflector`（512²）；雾片用 Canvas 雾纹理与加色混合。

- [ ] **Step 3: 验证**

风回峰截图显示瀑布接入云海；大竹峰溪流沿地形；仙鹤不穿山。

- [ ] **Step 4: 提交**

```bash
git commit -am "feat(qingyun): waterfall, streams, mist sheets and cranes"
```

---

### Task 9: 世界装配、相机、阴影焦点与交互

**Files:**
- Modify: `src/world/index.js`, `src/main.js`, `index.html`, `src/style.css`
- Create: `src/ui.js`
- Test: `scripts/test-interactions.mjs`（新建）

**Interfaces:**
- `world/index.js`: `createWorld(scene, camera) -> { update, terrain, sky, clouds, peaks, vegetation, water, mist, birds, sunLight, hemiLight, setShadowFocus(point, extent=1500), setTime(t) }`
- `sunLight.shadow.camera` 正交范围 ±extent，`mapSize 4096`，`autoUpdate=false`；`setShadowFocus` 立即 `needsUpdate=true`。
- `ui.js`: `createUI(handlers) -> { setPlaying, setTime, setFreeMode, setView }`，绑定 `data-time`、`data-view`、`data-toggle`。
- `main.js`: 聚焦/拖动进入自由模式；`1–7` 切峰、`8` 全景、`Space`、`R`；相机每帧 `y = max(y, heightAt(x,z)+8)`（自由模式）。
- `?view=<id>` 直接定位机位（调试）；`window.__qingyun` 暴露 `renderer/scene/camera/controls/world/ui/flyTo/setView/setShadowFocus`。

- [ ] **Step 1: 实现装配与 UI**

把所有子系统接入 `world.update`，顺序：terrain → sky → clouds → vegetation → water → mist → birds。更新 `setShadowFocus(controls.target)` 在相机移动超过 200 m 时触发。

- [ ] **Step 2: 交互测试**

`scripts/test-interactions.mjs`（playwright，需 dev server 5188）：打开页面 → 断言 `__qingyun` 存在、无 console error → 点击每个 `data-view` 按钮 → 断言相机位置在 3 s 内接近目标（±5%）→ 按 `KeyR` 回到 overview → 调整视口 1280×720 无报错。

- [ ] **Step 3: 低空穿地断言**

在页面内把相机设到峰脚低空 `(peak.x+300, heightAt+20, peak.z+300)`，前进 2 s，断言 `camera.position.y > heightAt(camera.x,camera.z)+4`。

- [ ] **Step 4: 阴影焦点验证**

调用 `setShadowFocus(peakA)` 与 `setShadowFocus(peakB)`，各截一张图，确认阴影出现在对应区域（人眼/模型检查，图存 `deliverables/previews/verify-shadow-*.png`）。

- [ ] **Step 5: 提交**

```bash
git commit -am "feat(qingyun): world assembly, camera views, shadow focus and interaction"
```

---

### Task 10: 影片时间线、穿云转场与字幕

**Files:**
- Create: `src/filmTimeline.js`, `src/film.js`
- Modify: `index.html`, `src/style.css`, `src/main.js`
- Test: `scripts/test-core.mjs`（时间线纯函数）

**Interfaces:**
- `filmTimeline.js`（纯函数，无 DOM）：
  - `FILM_DURATION = 36`, `FILM_FPS = 60`
  - `FILM_SHOTS`: 5 个镜头，`{ index, start, end, subtitle, keys: [{t, position, target}] }`
  - `sampleFilmCamera(time, outPosition, outTarget)`（每镜头内 Catmull-Rom）
  - `shotIndexAt(time)`, `transitionOpacityAt(time)`（切点前后 0.8 s 的穿云遮罩），`subtitleOpacitiesAt(time) -> Record<key, number>`
- `film.js`: `createFilm({ camera, controls, world, composer, beforeRender }) -> { duration, time, seek, renderFrame, update, reset }`，每帧调用 `world.setTime(t)` 与 `world.setShadowFocus(target)`。
- 镜头关键帧（初始值，允许按截图微调 ±10%）：
  - Shot 1 `0–8`：`(6800,3000,8200)→(0,950,0)`；`(5200,2400,6200)→(0,980,0)`；`(3800,1900,4300)→(-200,1050,-500)`
  - Shot 2 `8–15`：`(1300,1450,1500)→(0,1650,0)`；`(600,1620,700)→(0,1760,0)`；`(180,1830,480)→(0,1830,0)`；`(60,1880,260)→(0,1810,0)`
  - Shot 3 `15–22`：`(-2400,1350,3000)→(-2050,1200,2600)`；`(-1500,1420,3200)→(-800,1300,3000)`；`(600,1500,3200)→(1700,1350,2900)`
  - Shot 4 `22–29`：`(-3450,1050,900)→(-3250,1300,300)`；`(-3500,1250,700)→(-3220,1450,250)`；`(-2900,1900,1200)→(-500,1450,-1800)`
  - Shot 5 `29–36`：`(-1150,1620,-850)→(-2350,1280,-1750)`；`(-1500,1500,-1050)→(-2300,1300,-1740)`；`(-2400,1800,-1600)→(-2350,1300,-1750)`；`(-5600,3100,-4100)→(0,1050,0)`
- 字幕：`cloud-open`「云海初开，七峰浮青」、`stair`「通天一径，玉阶凌云」、`bamboo`「竹影摇风，双峰对望」、`waterfall`「龙首垂瀑，风回千仞」、`sunset`「落霞满袖，青云不老」；片尾 `青云七峰` 与副题 `云海仙门`。
- 转场：`.film-wipe` 全屏云纹遮罩，`transitionOpacityAt`：边界前后各 0.8 s 内升到 1（切点处 1），其余 0；`film.js` 按时间设置透明度。

- [ ] **Step 1: 时间线测试**

断言：`shotIndexAt(0)=0`、`shotIndexAt(35.9)=4`；`transitionOpacityAt(8)=1`、`(4)=0`、`(15)=1`；各镜头首尾采样位置有限；同一 t 两次采样相等；`subtitleOpacitiesAt` 在镜头中段 >0.5、切点 <0.1。

- [ ] **Step 2: 实现纯时间线与 film.js**

`film.js` 在 `?film=1` 下隐藏交互 UI；`?capture=1` 暴露 `window.__capture = { ready, duration, fps, width, height, renderAt(t), reset() }`；`renderAt` 内 `world.setTime(t)`、`world.setShadowFocus(target)`、`sunLight.shadow.needsUpdate=true`、`composer.render()`。

- [ ] **Step 3: 验证**

逐镜头截图（0、6、11、13、18、21、25、28、32、35 秒）；确认无穿地、字幕与画面匹配、切点被云纹遮住。

- [ ] **Step 4: 提交**

```bash
git commit -am "feat(qingyun): 36s five-shot film timeline with cloud-wipe transitions"
```

---

### Task 11: 程序化声音

**Files:**
- Create: `src/audio.js`
- Modify: `src/main.js`, `index.html`

**Interfaces:** `createAudio() -> { toggle(force?), update(time), setEnabled(bool), enabled }`；Web Audio 合成风声、云海低频、瀑布（22–29 s）、远处编钟、仙鹤鸣叫；默认关闭，用户点击开启。

- [ ] **Step 1: 实现并手动验证**：点击声音开关后无爆音；`update(25)` 能听到瀑布层。
- [ ] **Step 2: 提交**：`git commit -am "feat(qingyun): procedural Web Audio ambience"`

---

### Task 12: 提示词文档补全

**Files:**
- Create: `prompt/诛仙青云山七峰.md`

- [ ] **Step 1: 写文档**：以用户粘贴稿（截至「通天峰…多层屋檐」）为原文基础，保留章节与措辞，补全：其余六峰差异化设计、核心动态（云海翻涌、瀑布、竹浪、仙鹤、光照）、36 秒五镜头时间轴与字幕、交互、Three.js 技术要求、性能、交付与验收。硬性要求沿用原文：不要简单 HTML、不要圆锥体、不要平面云海贴图。与设计文档的坐标、云层高度、镜头时间一致。
- [ ] **Step 2: 校对**：文档中七峰名称、时间点、分辨率与设计文档一致；无未完成段落。
- [ ] **Step 3: 提交**：`git commit -am "docs: add Qingyun seven peaks prompt"`

---

### Task 13: 导出、验证脚本与静态截图

**Files:**
- Create: `scripts/verify-scene.mjs`, `scripts/export-film.mjs`, `scripts/encode-film.mjs`, `scripts/capture-stills.mjs`
- Modify: `package.json`, `src/audio.js`（按需）

**Interfaces:**
- `verify-scene.mjs`：打开 `--url`，检查 `__qingyun`、console error、WebGL 上下文丢失；截图 `deliverables/previews/verify-*.png`；`--resize` 检查 1280×720 → 2560×1440。
- `export-film.mjs`：参数 `--url --frames --fps 60 --duration 36 --width 2560 --height 1440 --quality 94 --resume`；复用枫桥夜泊的断点续传逻辑；写 `manifest.json`。
- `encode-film.mjs`：ffmpeg libx264、`-crf 16 -preset slow -pix_fmt yuv420p -r 60`。
- `capture-stills.mjs`：按 `--times 0,6,11,13,18,21,25,28,32,35` 截图 PNG。
- `package.json` 增加 `verify:scene`、`export:film`、`encode:film`、`stills:film`。

- [ ] **Step 1: 实现脚本**（直接以枫桥夜泊同名脚本为模板，替换 `__fengqiao`→`__qingyun`、时长 40→36）。
- [ ] **Step 2: 运行**：`npm run dev -- --port 5188 --strictPort` 后 `npm run verify:scene`、`npm run stills:film -- --out deliverables/previews`；确认 10 张截图非空、无报错。
- [ ] **Step 3: 重放一致性**：同一 `t` 调两次 `renderAt` 截图，比较文件字节一致（`shasum`）。
- [ ] **Step 4: 提交**：`git commit -am "feat(qingyun): film export and scene verification scripts"`

---

### Task 14: 配乐、成片渲染、文档收尾

**Files:**
- Create: `scripts/compose-score.py`, `README.md`, `deliverables/REPORT.md`
- Modify: `CLAUDE.md`（在「枫桥夜泊」后新增青云山七峰说明）

- [ ] **Step 1: 配乐**：36 s，48 kHz 立体声；D 宫五声音阶；箫/笛主旋律、古琴拨弦、低频云海铺底、22–29 s 瀑布层、34 s 编钟；`loudnorm I=-18 TP=-2 LRA=9`。输出 `deliverables/qingyun-score.wav`。
- [ ] **Step 2: 渲染**：`npm run export:film -- --frames deliverables/frames`（2160 帧，`?film=1&capture=1`）。
- [ ] **Step 3: 编码封装**：无声 MP4 → 混入音轨 → `deliverables/qingyun-seven-peaks-2k60.mp4`；同时保留 `-silent.mp4`。
- [ ] **Step 4: 截图**：关键镜头 2K PNG + `docs/preview.jpg`。
- [ ] **Step 5: 文档**：README 写运行、交互、镜头表、场景构成、技术亮点、导出流程与资源许可；REPORT 记录实际分辨率/帧率/时长/码率/响度/渲染耗时；CLAUDE.md 增加项目段落。
- [ ] **Step 6: 最终验证**：`npm run build`、`npm test`、`npm run verify:scene` 全通过；视频 `ffprobe` 确认 2560×1440/60/36.0 s/有音轨。
- [ ] **Step 7: 提交**：`git commit -am "feat(qingyun): score, 2k60 film and docs"`

---

## Self-Review

- 设计文档 §4 方案取舍 → Task 1/2/4；§5 世界设计 → Task 1/3/6；§6.3 云 → Task 4；§6.4 建筑 → Task 5/6；§6.5 植被 → Task 7；§6.6 水 → Task 8；§6.7 渲染 → Task 2/3/4/9；§6.8 影片 → Task 9/10；§6.9 导出 → Task 13/14；§7 提示词 → Task 12；§8 验收 → Task 13/14。
- 接口名称已统一：`heightAt` / `normalAt` / `setShadowFocus` / `createClouds` / `createPeaks` / `createVegetation` / `sampleFilmCamera` / `transitionOpacityAt`。
- 五个 Review Focus 均有对应任务测试：接缝 Task 1/2；云 resize Task 4；穿地 Task 9；阴影 Task 9；重放 Task 13。
