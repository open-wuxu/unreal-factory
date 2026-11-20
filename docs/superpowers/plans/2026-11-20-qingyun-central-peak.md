# 青云七峰 · 中央主峰构图重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把青云七峰重构为「通天峰居中统领、六峰不规则环绕」的布局，同步更新提示词、机位、云带与水系，并重新导出 36 秒 2K60 成片。

**Architecture:** 七峰坐标和高度集中在 `src/config.js` 的 `PEAKS`，地形 `heightAt`、建筑群、植被、飞鸟都从它派生；机位在 `filmTimeline.js` 与 `CAMERA_VIEWS`；云带是 `clouds.js` 的 shader 常量；水体在 `water.js`。按「配置 → 测试 → 机位 → 云 → 水 → 视觉验证 → 导出」顺序改动，每步跑现有 node 测试。

**Tech Stack:** Three.js 0.186、Vite 7、Node ≥ 20.19、Playwright（Chrome）、ffmpeg、Python numpy/scipy。

**Spec:** `docs/superpowers/specs/2026-11-20-qingyun-central-peak-layout-design.md`

## Global Constraints

- 坐标：X 东、Z 南、Y 上；1 世界单位 ≈ 1 米；谷地 `valleyBase = 420`。
- 峰顶高度为绝对世界 Y；通天峰 1790；六峰占通天峰 65%–78%，彼此不等高。
- 所有资源程序化生成，不引入外部模型、图片、音频素材。
- 成片规格：2560×1440 / 60 fps / 36.000 s / 2160 帧 / H.264 + AAC / −18 LUFS。
- 修改峰形或机位后必须重新逐帧导出，不能只替换视频文件。
- 项目命令在 `material/诛仙青云山七峰/` 下执行，不能从仓库根目录运行。

## Review Focus

- **峰间山脚视觉**：新坐标可能让山体融合成环形高地或出现陡峭接缝；测试只查台地与接缝数学，不查观感 → Task 2 加峰间连线高度采样断言，Task 8 看截图。
- **镜三遮挡**：主峰可能挡住小竹峰；测试只验 target 位置，不验可见性 → Task 4 断言 target，Task 8 用 18.5 s 截图确认。
- **风回瀑布落差**：峰高从 1600 降到 1300，瀑布落差可能跌破 300 m 测试线或气势不足 → Task 6 先改测试再改实现。
- **山腰云遮峰**：六峰峰顶落在云带高度内，云可能盖住大竹峰 → Task 5 改 shader 参数，Task 8 检查截图。
- **大竹支瀑落点**：可能悬空或落进台地 → Task 6 测试断言起点/终点贴地且落差在 80–220 m。

---

## Execution setup

- [ ] 用 `superpowers:using-git-worktrees` 在 `.claude/worktrees/qingyun-central-peak` 创建分支 `feat/qingyun-central-peak`（基于 master）。设计文档与本计划需先提交到 master，或复制进 worktree 后随首个提交入库。
- [ ] 在 worktree 的 `material/诛仙青云山七峰/` 执行 `npm install`。
- [ ] 跑基线 `npm test`，确认改动前全部通过（应输出 6 个 ok）。

---

### Task 1: 更新提示词

**Files:**
- Modify: `prompt/诛仙青云山七峰.md`

**Interfaces:**
- Produces: 后续任务不再读提示词，但文档与代码必须一致；Task 2 的坐标/高度表以此为准。

- [ ] **Step 1: 在文末追加章节**（完整粘贴；末句为用户粘贴稿的补全）

```markdown
# 核心构图方案：中央主峰统领群山（方案 A）

本项目最终采用「中央主峰 + 六峰环绕」的构图方案。

这是整个青云七峰三维场景的核心设计原则，优先级高于单座山峰的局部建模和特效设计。

## 1. 整体空间布局

以通天峰作为整个青云山脉的中央核心。

通天峰位于场景中心，具有明显高于其他六峰的海拔和体量，是整个山脉的最高点。

其他六座主峰围绕通天峰分布，形成自然、不规则的环绕结构。

具体布局：

- 中央：通天峰，最高、最大、最宏伟。
- 东北方向：龙首峰，山势险峻，突出岩石山脊。
- 西北方向：大竹峰，山体宽阔，竹林与瀑布丰富。
- 正东方向：朝阳峰，山脊延伸，顶部开阔。
- 正西方向：风回峰，峡谷纵横，山势层叠。
- 东南方向：小竹峰，山体秀丽，植被茂密。
- 西南方向：落霞峰，山体轮廓优美，突出悬崖与岩峰。

以上方向作为三维建模的初始布局，不要求严格对称，可以根据最终镜头构图微调。

## 2. 七峰高度与体量关系

建立明确的主次关系：

- 通天峰：高度 100%，作为基准。
- 其他六峰：高度约为通天峰的 55%—78%。
- 次级山峰：高度约为通天峰的 20%—50%。
- 远景山脉：高度逐渐降低，并延伸至地平线。

上述比例是场景设计参数，不代表原著中的实际海拔关系。

通天峰必须明显高出周围六峰，顶部建筑群能够从其他山峰和云海中清晰辨认。

其他六峰不能排列成同一高度，也不能围绕通天峰形成完美圆环。

采用不规则椭圆式分布，使整个山脉具有自然形成的地理感觉。

## 3. 山脉连接关系

七峰必须融入同一个完整的地形系统。

- 七座主峰的山脚与周围次级山脉自然连接。
- 山峰之间存在山脊、峡谷、山谷和天然平台。
- 部分山峰之间通过低矮山脉相连。
- 部分山峰之间由深邃峡谷和云海隔开。
- 每座主峰具有独立的山体轮廓。
- 山体不能呈现七个独立圆锥体的排列效果。

从高空俯瞰，整体应像一片规模庞大的东方仙山山脉。

## 4. 通天峰重点设计

通天峰是整个场景的绝对视觉中心。

- 山体高耸，底部宽阔。
- 山体向上逐渐形成复杂的岩峰与天然平台。
- 山顶建立大型青云门主殿建筑群。
- 建筑群沿山体中轴线层层展开。
- 主殿位于最高处，形成清晰的天际线。
- 山腰存在多层殿宇、石阶、山门和亭台。
- 山体局部存在垂直悬崖和突出岩脊。
- 山峰顶部穿出云海，沐浴在阳光之中。

从远景观察，首先看到的应该是通天峰，而不是六座次峰。

## 5. 最终全景镜头

全景镜头采用高空斜俯视视角。

构图要求：

- 通天峰位于画面中央。
- 其他六峰向周围错落展开。
- 通天峰顶部建筑群清晰可见。
- 六峰各自具有独立轮廓。
- 山峰之间分布大量次级山脉。
- 云海主要填充山谷和低海拔区域。
- 远景具有连续山脉和空气透视效果。
- 太阳光从通天峰后方或侧后方照来，形成逆光轮廓。
```

- [ ] **Step 2: 同步第三节坐标表**为下面七行（替换原表格数据行，表头与坐标约定段落不变）：

```markdown
| 山峰 | 位置 (x, z) | 峰顶高度 | 基座半径 | 顶部台地 |
| --- | --- | --- | --- | --- |
| 通天峰 | (0, 0) | 1790 | 1500 | 150 |
| 龙首峰 | (1450, −2500) | 1390 | 1250 | 90 |
| 大竹峰 | (−2600, −1800) | 1170 | 1400 | 140 |
| 风回峰 | (−3250, 250) | 1300 | 1250 | 85 |
| 落霞峰 | (−2500, 2500) | 1250 | 1050 | 80 |
| 小竹峰 | (1900, 3000) | 1330 | 1000 | 70 |
| 朝阳峰 | (3300, −150) | 1340 | 1300 | 110 |
```

- [ ] **Step 3: 同步第四节方位描述**：
  - 龙首峰「位于主峰正北」→「位于主峰东北」
  - 大竹峰「位于西南」→「位于西北」
  - 落霞峰「位于西北」→「位于西南」；「西向悬崖正对落日」保留（西南向仍面朝落日）
  - 风回峰、小竹峰、朝阳峰描述不变

- [ ] **Step 4: 验证**

Run: `grep -n "东北\|西北\|西南\|1450\|−2600\|−2500" prompt/诛仙青云山七峰.md | head`
Expected: 追加章节、坐标表与第四节三处方位都出现新值；不存在「位于主峰正北」「位于西北，西向悬崖」等旧描述。

- [ ] **Step 5: Commit**

```bash
git add prompt/诛仙青云山七峰.md
git commit -m "docs(qingyun): adopt central-peak composition in prompt"
```

---

### Task 2: 七峰坐标、高度与布局测试

**Files:**
- Create: `material/诛仙青云山七峰/scripts/test-layout.mjs`
- Modify: `material/诛仙青云山七峰/src/config.js:41-140`
- Modify: `material/诛仙青云山七峰/package.json:11`

**Interfaces:**
- Consumes: `PEAKS`（`{ id, name, x, z, height, radius, plateau, ridge, seed, stretch, rotation, palette }`）、`heightAt(x, z)`。
- Produces: 新 `PEAKS` 数据；后续任务的机位、水体、植被都以此为准。

- [ ] **Step 1: 写 `scripts/test-layout.mjs`**

```js
import assert from "node:assert/strict";
import { PEAKS } from "../src/config.js";
import { heightAt } from "../src/world/shape.js";

const byId = Object.fromEntries(PEAKS.map((peak) => [peak.id, peak]));
assert.equal(PEAKS.length, 7);

const tt = byId.tongtian;
assert.deepEqual([tt.x, tt.z, tt.height], [0, 0, 1790], "tongtian at center");

const ringIds = ["longshou", "dazhu", "fenghui", "luoxia", "xiaozhu", "chaoyang"];
const inDirection = {
  longshou: (p) => p.x > 800 && p.z < -800,
  dazhu: (p) => p.x < -800 && p.z < -800,
  fenghui: (p) => p.x < -2000 && Math.abs(p.z) < Math.abs(p.x),
  luoxia: (p) => p.x < -800 && p.z > 800,
  xiaozhu: (p) => p.x > 800 && p.z > 800,
  chaoyang: (p) => p.x > 2000 && Math.abs(p.z) < Math.abs(p.x),
};
for (const id of ringIds) {
  assert.ok(inDirection[id](byId[id]), `${id} not in its direction`);
  const ratio = byId[id].height / tt.height;
  assert.ok(ratio >= 0.55 && ratio <= 0.78, `${id} ratio ${ratio}`);
  assert.ok(byId[id].height < tt.height, `${id} not lower than tongtian`);
}

const heights = ringIds.map((id) => byId[id].height);
assert.equal(new Set(heights).size, heights.length, "six peaks must differ");

const rings = ringIds.map((id) => Math.hypot(byId[id].x, byId[id].z));
assert.ok(Math.max(...rings) - Math.min(...rings) > 100, "rings too regular");

for (let i = 0; i < PEAKS.length; i++) {
  for (let j = i + 1; j < PEAKS.length; j++) {
    const a = PEAKS[i];
    const b = PEAKS[j];
    assert.ok(
      Math.hypot(a.x - b.x, a.z - b.z) > 2000,
      `${a.id}/${b.id} too close`,
    );
  }
}

// 峰间关系：沿七峰两两连线取最低点，至少有 2 组深谷（低于云顶 1080），
// 至少有 2 组低矮山脊（高于云顶但明显低于两峰）。
let valleys = 0;
let ridges = 0;
for (let i = 0; i < PEAKS.length; i++) {
  for (let j = i + 1; j < PEAKS.length; j++) {
    const a = PEAKS[i];
    const b = PEAKS[j];
    let low = Infinity;
    for (let s = 1; s < 20; s++) {
      const u = s / 20;
      low = Math.min(low, heightAt(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u));
    }
    const lowerPeak = Math.min(a.height, b.height);
    if (low < 1080) valleys++;
    else if (low < lowerPeak - 120) ridges++;
  }
}
assert.ok(valleys >= 2, `only ${valleys} valleys between peaks`);
assert.ok(ridges >= 2, `only ${ridges} ridge saddles`);

console.log("layout ok");
```

- [ ] **Step 2: 加入测试命令并运行（应失败）**

Modify `package.json:11` test 链，在 `test:terrain` 后加 `node scripts/test-layout.mjs &&`。

Run: `npm test`
Expected: FAIL，`tongtian at center` 或方向断言失败（旧布局龙首在正北）。

- [ ] **Step 3: 更新 `src/config.js` 的 `PEAKS`**

| id | x | z | height | radius | plateau |
|---|---|---|---|---|---|
| tongtian | 0 | 0 | 1790 | 1500 | 150 |
| longshou | 1450 | −2500 | 1390 | 1250 | 90 |
| dazhu | −2600 | −1800 | 1170 | 1400 | 140 |
| fenghui | −3250 | 250 | 1300 | 1250 | 85 |
| luoxia | −2500 | 2500 | 1250 | 1050 | 80 |
| xiaozhu | 1900 | 3000 | 1330 | 1000 | 70 |
| chaoyang | 3300 | −150 | 1340 | 1300 | 110 |

保留各峰 `ridge / seed / stretch / rotation / palette` 现值。`shape.js` 的顶点标定会自动跟随。

- [ ] **Step 4: 运行测试**

Run: `npm test`
Expected: `core ok`、`terrain ok`、`layout ok`、`buildings ok`、`vegetation ok`、`water ok`、`film ok`。
若 `test-core` 的 `heightAt(-1000, 1300) < 1000` 鞍部断言失败，先确认真实地形再决定是否调整该采样点，
不得为了通过测试而抬高鞍部阈值。

- [ ] **Step 5: Commit**

```bash
git add material/诛仙青云山七峰/src/config.js material/诛仙青云山七峰/scripts/test-layout.mjs material/诛仙青云山七峰/package.json
git commit -m "feat(qingyun): recenter seven peaks around tongtian"
```

---

### Task 3: 预设机位

**Files:**
- Modify: `material/诛仙青云山七峰/src/config.js:203-212`
- Modify: `material/诛仙青云山七峰/scripts/test-layout.mjs`

**Interfaces:**
- Consumes: 新 `PEAKS`。
- Produces: `CAMERA_VIEWS`，键名不变（`overview / tongtian / longshou / luoxia / fenghui / dazhu / xiaozhu / chaoyang`），供 `main.js` 与 UI 按钮使用。

- [ ] **Step 1: 加机位断言（先失败）**

在 `test-layout.mjs` 顶部 import `CAMERA_VIEWS`，末尾加：

```js
const targetFor = ["tongtian", "longshou", "luoxia", "fenghui", "dazhu", "xiaozhu", "chaoyang"];
for (const id of targetFor) {
  const view = CAMERA_VIEWS[id];
  const peak = byId[id];
  const t = view.target;
  assert.ok(
    Math.hypot(t[0] - peak.x, t[2] - peak.z) < 500,
    `${id} view target off peak`,
  );
  assert.ok(t[1] >= peak.height - 80 && t[1] <= peak.height + 120, `${id} view target height`);
  assert.ok(view.position[1] > peak.height - 200, `${id} view below summit`);
}
assert.ok(Math.hypot(CAMERA_VIEWS.overview.target[0], CAMERA_VIEWS.overview.target[2]) < 300);
```

Run: `node scripts/test-layout.mjs`
Expected: FAIL（旧 target 指向旧坐标）。

- [ ] **Step 2: 更新 `CAMERA_VIEWS`**

```js
export const CAMERA_VIEWS = {
  overview: { position: [5200, 2400, -5600], target: [0, 1050, 0] },
  tongtian: { position: [900, 1980, 1200], target: [0, 1790, 0] },
  longshou: { position: [500, 1700, -1200], target: [1450, 1420, -2500] },
  luoxia: { position: [-1000, 1650, 800], target: [-2500, 1290, 2500] },
  fenghui: { position: [-4200, 1500, 900], target: [-3250, 1330, 250] },
  dazhu: { position: [-1200, 1500, -900], target: [-2600, 1210, -1800] },
  xiaozhu: { position: [800, 1500, 1900], target: [1900, 1360, 3000] },
  chaoyang: { position: [4200, 1650, 250], target: [3300, 1370, -150] },
};
```

- [ ] **Step 3: 运行测试**

Run: `node scripts/test-layout.mjs`
Expected: `layout ok`。

- [ ] **Step 4: Commit**

```bash
git add material/诛仙青云山七峰/src/config.js material/诛仙青云山七峰/scripts/test-layout.mjs
git commit -m "feat(qingyun): retarget navigation views to new layout"
```

---

### Task 4: 五镜头机位

**Files:**
- Modify: `material/诛仙青云山七峰/src/filmTimeline.js:15-73`
- Modify: `material/诛仙青云山七峰/scripts/test-film.mjs`

**Interfaces:**
- Consumes: 新 `PEAKS`、`sampleFilmCamera(time, outPosition, outTarget)` 现有签名不变。
- Produces: 新 `FILM_SHOTS`（5 段，切点 8/15/22/29，字幕不变）。

- [ ] **Step 1: 加镜头-峰位断言（先失败）**

在 `test-film.mjs` 顶部 import `PEAKS` 与 `byId`，在 `sampleFilmCamera` 循环后加：

```js
const byId = Object.fromEntries(PEAKS.map((p) => [p.id, p]));
function assertTargetNear(time, id, tolerance) {
  sampleFilmCamera(time, position, target);
  const peak = byId[id];
  assert.ok(
    Math.hypot(target.x - peak.x, target.z - peak.z) < tolerance,
    `t=${time} target not near ${id}`,
  );
}
assertTargetNear(7.5, "tongtian", 400);
assertTargetNear(14, "tongtian", 400);
assertTargetNear(16, "dazhu", 500);
assertTargetNear(21.8, "xiaozhu", 900);
assertTargetNear(24.5, "fenghui", 600);
assertTargetNear(31.5, "luoxia", 400);
sampleFilmCamera(35.8, position, target);
assert.ok(Math.hypot(target.x, target.z) < 600, "ending overview targets tongtian");
```

Run: `node scripts/test-film.mjs`
Expected: FAIL（旧镜三/四/五指向旧坐标）。

- [ ] **Step 2: 替换 `FILM_SHOTS` 机位**

```js
export const FILM_SHOTS = [
  {
    index: 0,
    start: 0,
    end: 8,
    subtitle: "云海初开，七峰浮青",
    keys: [
      { t: 0, position: V(6200, 3100, -6800), target: V(0, 1050, 0) },
      { t: 4, position: V(4600, 2500, -5200), target: V(0, 1080, 0) },
      { t: 8, position: V(2600, 1900, -3600), target: V(0, 1150, 0) },
    ],
  },
  {
    index: 1,
    start: 8,
    end: 15,
    subtitle: "通天一径，玉阶凌云",
    keys: [
      { t: 8, position: V(900, 2250, 1500), target: V(0, 1780, 0) },
      { t: 11, position: V(520, 2000, 950), target: V(0, 1785, 0) },
      { t: 13.5, position: V(260, 1890, 640), target: V(0, 1790, 0) },
      { t: 15, position: V(80, 1850, 400), target: V(0, 1800, 0) },
    ],
  },
  {
    index: 2,
    start: 15,
    end: 22,
    subtitle: "竹影摇风，双峰对望",
    keys: [
      { t: 15, position: V(-3200, 1420, -1000), target: V(-2600, 1220, -1800) },
      { t: 18, position: V(-2500, 1520, -700), target: V(-800, 1350, 300) },
      { t: 22, position: V(-900, 1850, 500), target: V(1900, 1400, 3000) },
    ],
  },
  {
    index: 3,
    start: 22,
    end: 29,
    subtitle: "龙首垂瀑，风回千仞",
    keys: [
      { t: 22, position: V(-2700, 1200, 700), target: V(-3070, 1180, 450) },
      { t: 25, position: V(-2760, 1240, 710), target: V(-3070, 1200, 450) },
      { t: 29, position: V(-1200, 2050, 100), target: V(1450, 1450, -2500) },
    ],
  },
  {
    index: 4,
    start: 29,
    end: 36,
    subtitle: "落霞满袖，青云不老",
    keys: [
      { t: 29, position: V(-1200, 1750, 1100), target: V(-2500, 1300, 2500) },
      { t: 31, position: V(-1450, 1680, 1300), target: V(-2500, 1300, 2500) },
      { t: 32.5, position: V(-1800, 1800, 1600), target: V(-2500, 1300, 2500) },
      { t: 36, position: V(-6200, 3200, -4000), target: V(0, 1000, 0) },
    ],
  },
];
```

- [ ] **Step 3: 运行测试**

Run: `node scripts/test-film.mjs`
Expected: `film ok`。

- [ ] **Step 4: Commit**

```bash
git add material/诛仙青云山七峰/src/filmTimeline.js material/诛仙青云山七峰/scripts/test-film.mjs
git commit -m "feat(qingyun): reframe five shots for central-peak layout"
```

---

### Task 5: 山腰云带限高降密

**Files:**
- Modify: `material/诛仙青云山七峰/src/world/clouds.js:58-62, 282-283`
- Modify: `material/诛仙青云山七峰/src/config.js:10-17`

**Interfaces:**
- Produces: shader `heightDensity(y)` 的新山腰带；`uBandTop = 1460`；`WORLD.bandBase = 1120`、`WORLD.bandTop = 1460`。

- [ ] **Step 1: 改 shader 高度密度**

`clouds.js` 中替换：

```glsl
  float heightDensity(float y) {
    float main = exp(-pow((y - 900.0) / 105.0, 2.0));
    float band = 0.05 * exp(-pow((y - 1310.0) / 120.0, 2.0));
    return main + band;
  }
```

- [ ] **Step 2: 改 ray march slab 与配置常量**

`clouds.js` 的 `uBandTop: { value: 1500 }` → `{ value: 1460 }`。
`config.js` 的 `WORLD`：`bandBase: 1150` → `1120`，`bandTop: 1500` → `1460`。
`clouds.js` 顶部注释的 `[cloudBase, bandTop]` 保持不变。

- [ ] **Step 3: 验证**

Run: `npm test`
Expected: 全部 ok（云参数不影响 node 测试）。
视觉验证留给 Task 8：确认大竹峰（1170）与小竹峰（1330）峰顶不被云盖。

- [ ] **Step 4: Commit**

```bash
git add material/诛仙青云山七峰/src/world/clouds.js material/诛仙青云山七峰/src/config.js
git commit -m "feat(qingyun): cap mid-altitude cloud band below summits"
```

---

### Task 6: 水系统（山泉跟随 + 大竹支瀑）

**Files:**
- Modify: `material/诛仙青云山七峰/src/world/water.js:137-276`
- Modify: `material/诛仙青云山七峰/scripts/test-water.mjs`

**Interfaces:**
- Produces: `water.waterfalls` 每条新增 `kind: "main" | "tributary"`；`water.streams` 仍为 `{ points, mesh }[]`。`createWater(scene)` 签名不变。

- [ ] **Step 1: 改测试（先失败）**

替换 `test-water.mjs` 的瀑布断言为：

```js
const main = water.waterfalls.find((item) => item.kind === "main");
assert.ok(main, "main waterfall missing");
assert.ok(main.start.y - main.end.y > 300, `main drop ${main.start.y} -> ${main.end.y}`);

const tributary = water.waterfalls.find((item) => item.kind === "tributary");
assert.ok(tributary, "dazhu tributary waterfall missing");
const drop = tributary.start.y - tributary.end.y;
assert.ok(drop >= 80 && drop <= 220, `tributary drop ${drop}`);
assert.ok(
  Math.abs(heightAt(tributary.start.x, tributary.start.z) + 1 - tributary.start.y) < 12,
  "tributary start not grounded",
);
assert.ok(
  Math.abs(heightAt(tributary.end.x, tributary.end.z) + 1 - tributary.end.y) < 12,
  "tributary end not grounded",
);
const dazhu = PEAKS.find((peak) => peak.id === "dazhu");
assert.ok(
  Math.hypot(tributary.start.x - dazhu.x, tributary.start.z - dazhu.z) < dazhu.radius * 0.6,
  "tributary not on dazhu",
);

const streamPeaks = ["dazhu", "xiaozhu"];
for (const peakId of streamPeaks) {
  const peak = PEAKS.find((item) => item.id === peakId);
  const near = water.streams.some((stream) => {
    const p0 = stream.points[0];
    const p1 = stream.points[stream.points.length - 1];
    return Math.min(
      Math.hypot(p0.x - peak.x, p0.z - peak.z),
      Math.hypot(p1.x - peak.x, p1.z - peak.z),
    ) < peak.radius * 0.8;
  });
  assert.ok(near, `no stream near ${peakId}`);
}
```

顶部补 `import { PEAKS } from "../src/config.js";`。

Run: `node scripts/test-water.mjs`
Expected: FAIL，`main waterfall missing`（现有没有 `kind`）。

- [ ] **Step 2: 重构 `water.js` 的瀑布创建**

提取内部函数，在 `createWater` 内定义：

```js
function addWaterfall({ start, end, width, sprayCount, pondRadius, kind }) {
  const curve = new THREE.CatmullRomCurve3([
    start,
    new THREE.Vector3(start.x + width * 1.4, start.y - 120, start.z + width * 2.6),
    new THREE.Vector3(end.x + width * 0.75, end.y + 80, end.z + width * 0.9),
    end,
  ]);
  const mesh = new THREE.Mesh(ribbonGeometry(curve.getPoints(56), width), waterfallMaterial);
  mesh.frustumCulled = false;
  group.add(mesh);
  // spray + pond 沿用现有代码，尺寸按 width / pondRadius 缩放；
  // pond 仅在 pondRadius > 0 且 typeof window !== "undefined" 时创建。
  waterfalls.push({ start, end, mesh, kind });
}
```

- 风回主瀑：`kind: "main"`，`width: 24`，sprayCount 260，pondRadius 19，起点/终点保持现有坐标。
- 大竹支瀑：`kind: "tributary"`，`width: 9.6`，sprayCount 120，pondRadius 7。
  - 起点：从大竹峰台地北缘取点，筛选满足 `heightAt(x, z) ≈ 峰高 − 20` 的坡面点，例如沿 `x = −2600` 向 z 负方向每 10 m 采样。
  - 终点：沿同一方向继续下山，选取 `start.y − end.y ∈ [140, 180]` 且距峰心 < `radius * 0.6` 的点。
  - 实现时把选出的两点作为常量写入（记录注释），不要在两处重复采样逻辑。

- [ ] **Step 3: 更新山泉坐标**

```js
const streamDefinitions = [
  [-2550, -1550, -2400, -1350], // 大竹峰南坡
  [1750, 2950, 1950, 3200],     // 小竹峰东南坡
];
```

- [ ] **Step 4: 运行测试**

Run: `node scripts/test-water.mjs`
Expected: `water ok`。
若风回主瀑落差不足 300 m，抬高起点崖口（沿坡向峰顶方向取更高点），不要降低测试阈值。

- [ ] **Step 5: Commit**

```bash
git add material/诛仙青云山七峰/src/world/water.js material/诛仙青云山七峰/scripts/test-water.mjs
git commit -m "feat(qingyun): follow new peaks in water and add dazhu tributary fall"
```

---

### Task 7: 植被、建筑与核心回归

**Files:**
- Modify (only if a test fails): `material/诛仙青云山七峰/src/world/vegetation.js`

**Interfaces:**
- Consumes: 新 `PEAKS`、`heightAt`。
- Produces: 通过全部 node 测试的植被/建筑布局。

- [ ] **Step 1: 运行全量测试**

Run: `npm test`
Expected: 6 个 ok。重点看：
- `test-vegetation`：大竹竹海 12000–15000、小竹 5000–7000、秋林 500–700、松树 800–1200。
- `test-buildings`：七峰各至少 5 个建筑、台阶贴地、无悬空。

- [ ] **Step 2: 若失败，按地形修正采样参数**

仅允许调整 `vegetation.js` 中 `grovePlacements(dazhu, …)` / `scatteredPlacements(luoxia, …)` 的半径、
坡度或排除区参数，使实例落在地形上；不得把测试阈值改宽来掩盖轨迹错误。
若大竹峰新位置的竹林数量不足，优先增大采样尝试次数或半径，而非抬高 `COUNTS`。

- [ ] **Step 3: 复跑**

Run: `npm test`
Expected: 6 个 ok。

- [ ] **Step 4: Commit（有改动才提交）**

```bash
git add material/诛仙青云山七峰/src/world/vegetation.js
git commit -m "fix(qingyun): keep groves grounded after relocation"
```

---

### Task 8: 场景与镜头视觉验证

**Files:**
- Modify (微调): `src/filmTimeline.js`、`src/config.js`
- 产物: `deliverables/preview-check/*.png`（不入库）

**Interfaces:**
- Consumes: 已完成的所有改动。
- Produces: 经确认可正式导出的机位与场景参数。

- [ ] **Step 1: 启动开发服务器**

Run: `cd material/诛仙青云山七峰 && npm run dev -- --port 5199 --strictPort`
（后台运行，保持到 Task 9 结束。）

- [ ] **Step 2: 运行时与 resize 验证**

Run: `node scripts/verify-scene.mjs --url http://127.0.0.1:5199/ --resize`
Expected: 无 pageerror；生成 `deliverables/previews/verify-scene.png` 与 720p 截图；云目标尺寸随 resize 半分辨率变化；阴影不自动重建。

- [ ] **Step 3: 导出七张低分辨率检查图**

Run:
```bash
node scripts/capture-stills.mjs --url http://127.0.0.1:5199/ \
  --out deliverables/preview-check --width 1280 --height 720
```
Expected: 7 张 PNG（时间点 1.6 / 5.4 / 12.5 / 18.5 / 24.5 / 31.5 / 35.0 s）。

- [ ] **Step 4: 逐张检查**

- `01/02`：通天峰居中、最高，六峰向四周展开，太阳侧后方，云海填谷。
- `03`：主殿群、玉阶梯级可辨。
- `04`：大竹竹海贴梢，越过主峰西北肩后能看到东南小竹峰（若被完全遮挡，按 Task 4 的 key 微调相机：提高 t=22 的 y 或把 t=18 后移）。
- `05`：风回瀑布从崖口坠向云海，画面后段转向东北龙首脊线。
- `06`：落霞峰临崖楼阁逆光，秋林暖色。
- `07`：片名与黑场正常。
- 全过程大竹峰、小竹峰峰顶不被山腰云覆盖。

- [ ] **Step 5: 必要时微调并复验**

只改 `filmTimeline.js` / `config.js` 中受影响的 key 或机位，重新执行 Step 3–4，直到五项通过。

- [ ] **Step 6: Commit（有微调才提交）**

```bash
git add material/诛仙青云山七峰/src/filmTimeline.js material/诛仙青云山七峰/src/config.js
git commit -m "fix(qingyun): tune shots after visual review"
```

---

### Task 9: 重新导出成片、配乐与截图

**Files:**
- 产物: `material/诛仙青云山七峰/deliverables/`（frames、MP4、WAV、PNG，均不入库）

**Interfaces:**
- Consumes: 已通过视觉验证的场景。
- Produces: 2K60 成片、无声备份、配乐、七张截图。

- [ ] **Step 1: 逐帧导出 2160 帧**

Run:
```bash
npm run export:film -- --url http://127.0.0.1:5199/ --frames deliverables/frames
```
Expected: `total frames 2160`，无 pageerror。中断可用 `--resume`。

- [ ] **Step 2: 编码无声视频**

Run:
```bash
npm run encode:film -- --frames deliverables/frames \
  --out deliverables/qingyun-seven-peaks-2k60-silent.mp4
```

- [ ] **Step 3: 配乐与母带**

Run:
```bash
python3 scripts/compose-score.py
ffmpeg -y -i deliverables/qingyun-score-raw.wav \
  -af "loudnorm=I=-18:TP=-2:LRA=9" -ar 48000 -ac 2 \
  deliverables/qingyun-score.wav
ffmpeg -y -i deliverables/qingyun-seven-peaks-2k60-silent.mp4 \
  -i deliverables/qingyun-score.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -shortest -movflags +faststart deliverables/qingyun-seven-peaks-2k60.mp4
```

- [ ] **Step 4: 截图**

Run:
```bash
npm run stills:film -- --url http://127.0.0.1:5199/ --out deliverables/previews
```
Expected: 七张 2560×1440 PNG，覆盖七个关键时间点。

- [ ] **Step 5: 验收规格**

Run: `ffprobe -v error -show_entries format=duration -show_streams deliverables/qingyun-seven-peaks-2k60.mp4`
Expected: 2560×1440、60 fps、2160 帧、36.000 s、H.264 + AAC 48 kHz 立体声。
Run: `ffmpeg -i deliverables/qingyun-seven-peaks-2k60.mp4 -af loudnorm=print_format=summary -f null -`
Expected: 响度约 −18 LUFS。

---

### Task 10: 更新 README 与 REPORT

**Files:**
- Modify: `material/诛仙青云山七峰/README.md`
- Modify: `material/诛仙青云山七峰/deliverables/REPORT.md`（若该文件被根 `.gitignore` 忽略，保持本地更新并在提交说明中注明）

**Interfaces:**
- Produces: 文档与最终布局、机位、导出规格一致。

- [ ] **Step 1: 更新布局说明**

README 与 REPORT 中凡出现旧坐标或「七峰环绕」描述处，改为：
通天峰居中 (0,0) 1790 m；六峰坐标见 Task 2 表格；六峰高度 65%–78%。
若 README 有镜头表，按 Task 4 的新机位更新镜头描述（字幕不变）。

- [ ] **Step 2: 更新导出规格**

按 Task 9 的 `ffprobe` / `loudnorm` 实测值更新 REPORT 的成片行（时长、码率、响度、文件大小）。

- [ ] **Step 3: 验证**

Run: `grep -rn "−2350\|−200, −2900\|正北" README.md deliverables/REPORT.md`
Expected: 无输出（旧坐标与旧方位已清除）。

- [ ] **Step 4: Commit**

```bash
git add material/诛仙青云山七峰/README.md
git commit -m "docs(qingyun): document central-peak layout and new export"
```

---

## Self-review

- **Spec coverage**：提示词（Task 1）、布局与高度（Task 2）、预设机位（Task 3）、五镜头（Task 4）、云带（Task 5）、大竹瀑布（Task 6）、视觉验收（Task 8）、重导出（Task 9）、文档（Task 10）均有对应任务。设计文档 4.3 的峰间连接由 Task 2 的 valley/ridge 断言与 Task 8 截图覆盖。
- **Step scan**：每个代码步骤给出精确文件、签名或常量；机位与坐标给出完整数值；测试断言可执行。
- **Type consistency**：`PEAKS` 字段不变；`water.waterfalls` 新增 `kind` 已同步到测试；`CAMERA_VIEWS` 键名与 UI 按钮一致；`sampleFilmCamera` 签名不变。
- **Review Focus**：五条风险分别在 Task 2、Task 4、Task 6、Task 5、Task 6 有对应测试或验证步骤。
- **Proportion**：计划以配置数值和断言为主，未转录实现代码。
