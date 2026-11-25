# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目性质

仓库名 `unreal_factory` **不是 Unreal Engine 项目**，与 Unreal Engine 没有任何关系。
这里是一组完全程序化生成、可交互的 Three.js 三维场景素材，`material/` 下每个目录都是
独立的 Vite 前端项目，根目录没有 `package.json`。

- `material/上海外滩v2.0/` — 外滩当前主版本（U 形江湾 + 陆家嘴半岛），新工作默认在这里进行。
- `material/上海外滩v1.0/` — 直线河道的存档版本，仅作参考；除非明确要求，不要同步修改。
- `material/上海外滩v3.0/` — 真实地理数据版，**源码在 `feat/shanghai-bund-v3` 分支**；
  master 下的同名目录只有本地构建产物，没有源码。详见「上海外滩 v3.0」一节。
- `material/枫桥夜泊/` — 独立的《枫桥夜泊》三维诗词短片项目，详见后文。
- `material/一树鎏金·秋日银杏树/` — 独立的程序化秋日银杏树展示与 30 秒短片，详见后文。
- 代码中出现的 `UnrealBloomPass` 是 three.js 自带的后处理通道，同样与 Unreal Engine 无关。

## 文档与提示词

- `prompt/*.md` — 各项目的原始需求提示词（`上海外滩v1.0` / `v2.0` / `v3.0`、`枫桥夜泊`、
  `一树鎏金·秋日银杏树`）。
  改动场景定位（真实地理比例、镜头安排、交付物）前先对照对应提示词。
- `docs/superpowers/specs|plans/` — 项目的设计与实施计划。v3.0 的 spec/plan 在
  `feat/shanghai-bund-v3` 分支上；master 里目前只有《诛仙·青云山七峰》的文档
  （分支 `feat/qingyun-seven-peaks`，独立 worktree 在 `.claude/worktrees/`）。
- `.superpowers/sdd/` — 子代理执行台账，本地文件，整体被忽略。

## 常用命令

每个项目目录独立安装、独立运行，命令不能从仓库根目录执行：

```bash
cd material/上海外滩v2.0

npm install
npm run dev       # Vite 开发服务器，默认 http://localhost:5173
npm run build     # 产物输出到 dist/，base 为 "./"，可部署到任意子目录
npm run preview   # 本地预览构建产物
```

v1.0 的命令相同，只需替换目录名。`material/枫桥夜泊` 另有 `export:film` /
`encode:film` / `stills:film` / `score` 脚本，见后文「枫桥夜泊」一节。

- 环境要求：Node.js ≥ 20.19（Vite 7），支持 WebGL 2 的桌面浏览器。
- 没有测试、lint 或类型检查脚本。验证改动的方式是 `npm run build` 通过，
  再在浏览器里实际查看场景（`npm run dev`）。

## 架构（上海外滩 v2.0）

### 启动链路

`index.html`（页面骨架 + HUD）→ `src/main.js`（渲染器、相机、控制器、后处理、主循环）
→ `createWorld(scene, camera)`（`src/world/index.js`）→ `createTimeSystem(...)`
（`src/world/time.js`）。

主循环每帧依次执行：

```js
time.update(delta);
world.update(delta, elapsed, time.state);  // 各子系统更新动画
composer.render();
```

`createWorld` 一次性装配天空、水面、四座地标、外滩建筑、城市基础设施、船只与灯光，
并返回 `{ update, sky, water, towers, bund, city, boats, sunLight, hemiLight, ambientLight, emissive }`。
每个 `world/*.js` 模块导出 `createX(scene)`，通常返回 `{ group, update(...) }`；
新增子系统时保持同样的契约，并在 `world/index.js` 的 `update` 中挂接。

### 河道是唯一空间基准（v2）

`src/world/river.js` 用一条 `CatmullRomCurve3` 中心线定义整个黄浦江，按弧长采样 900 段，
导出 `river` 查询对象：

- `pointAt / tangentAt / normalAt / halfWidthAt` — 按弧长参数 `u ∈ [0,1]` 取空间信息；
- `bankPoint(u, side, extra)` — 岸线取点，`side = +1` 为水流左侧（浦西 / 外滩），`-1` 为右侧（浦东 / 陆家嘴）；
- `lanePoint(u, offset)` — 江面上的航线取点；
- `nearest / isLand / signedShoreDistance` — 陆地/水面判定；
- `createRibbonGeometry(...)` / `createBankWallGeometry(...)` — 沿河生成步道、道路、护岸的通用几何。

水面网格、地块孔洞、岸墙、滨江道路、步道、外滩建筑排布、船只航线全部从这里取点，
因此修改河道控制点或宽度会同时影响所有沿江构件。**不要用硬编码世界坐标摆放新的沿江元素**，
应通过 `river` 查询或 ribbon 几何生成。

### 坐标系与尺度

在 `src/config.js` 中约定：X 轴向东、Z 轴向南、Y 轴向上；1 世界单位 ≈ 1 米。
水平基准高度集中在 `WORLD`：陆地 `landLevel = 3.0`、道路 `roadLevel = 3.12`、
水面 `waterLevel = 0.4`、河床 `riverBed = -7.0`。新增构件时引用这些常量，不要另写常量。

### 昼夜系统与发光材质注册表

`src/config.js` 的 `TIME_PRESETS` 定义 `day / dusk / night` 三套完整参数（默认 `dusk`），
`NUMERIC_KEYS` 与 `COLOR_KEYS` 决定哪些参数参与插值。新增昼夜参数时必须三处同步：
在三套 preset 中都给出值，并加入对应的 key 数组，否则不会被插值。

`src/world/time.js` 在 1.9 秒内插值并统一应用天空 uniform、太阳/半球光/环境光、雾、
曝光、泛光、水面参数和发光材质强度；切换时重新生成对应环境贴图。

发光材质不是逐帧遍历场景，而是启动时由 `collectEmissiveMaterials(scene)` 建立一次注册表：
材质必须用 `facadeMaterial()`、`emissiveMaterial()` 或 `tagEmissive()` 创建（设置
`userData.emissiveType` 为 `window | lamp | neon | car | boat`），才会响应昼夜变化。
运行时新建的材质不会被自动登记，需要重新收集或手动登记。

### 程序化资源

所有几何、贴图和环境贴图均由代码或 Canvas 生成，不依赖外部模型、图片或付费资源。
`src/utils/textures.js` 提供 `seededRandom()`（保证每次打开的亮窗分布一致）、
`createFacadeTextures()`（albedo + emissive 两张对齐的窗格贴图）、`getFacade(kind)` 缓存、
`createEnvironmentTexture()`、`createGlowTexture()`。新增贴图时应沿用固定 seed 和缓存，
避免每次刷新画面不同或重复生成大纹理。

### 渲染与性能约定

- `main.js` 使用 ACES Filmic tone mapping，像素比上限 1.6，WebGL 2 不可用时显示回退提示。
- 后处理链：`EffectComposer → RenderPass → UnrealBloomPass → OutputPass`，MSAA 4× 半浮点缓冲。
- 阴影：单主方向光 + 2048² PCF，`shadowMap.autoUpdate = false`，仅在太阳方向变化时
  `shadow.needsUpdate = true`。新增需要投影的物体时注意阴影相机范围（见 `world/index.js`）。
- 水面使用 `Reflector` 做真实平面反射，反射纹理尺寸独立于主画面。
- 建筑、树木、路灯、车辆、栏杆、立柱等大量重复构件使用 `InstancedMesh` 与共享材质；
  新增重复元素优先走实例化，而不是逐个 `Mesh`。

### 相机与 UI

相机机位与地标坐标在 `src/config.js`：`TOWER_POS` 决定地标落位，`LANDMARK_VIEWS`
决定导航视角。`src/ui.js` 通过 `data-time` / `data-landmark` 属性绑定 `index.html` 中的按钮，
点击后用缓动飞行切换机位（`main.js` 的 `flyTo`）。键盘 `1/2/3` 切时间、`Space` 切自动环绕、`R` 重置。

新增地标需要：`TOWER_POS` 加坐标、`LANDMARK_VIEWS` 加机位、`towers.js` 加建模函数、
`index.html` 加一个 `data-landmark` 按钮（按钮绑定是通用的）。

`window.__bund` 暴露了 `renderer / scene / camera / controls / composer / world / time / flyTo / flight`
以及 `setView(position, target)`，调试和性能检查时可在控制台直接使用。

### 影片模式与逐帧导出

`material/上海外滩v2.0/src/film.js` 定义 28 秒、60fps 的固定镜头时间线（4 个镜头），
相机、昼夜与字幕均由绝对时间 `t` 推导。`?film=1` 隐藏交互 UI 并实时播放；
`?capture=1` 关闭实时循环，由 `window.__capture.renderAt(t)` 以固定 1/60 秒步长推进；
`src/deterministic.js` 在捕获模式下用固定 seed 覆盖 `Math.random`。影片字幕在
`index.html` 的 `#film` 与 `src/style.css` 的 `.film-*` 中。

导出流程：在 v2.0 目录执行 `npm run dev -- --port 5188 --strictPort`，另开终端执行
`npm run export:film -- --frames deliverables/frames`、
`npm run encode:film -- --frames deliverables/frames --out deliverables/shanghai-bund-v2-2k60.mp4`、
`npm run stills:film -- --out deliverables/previews`。改动镜头时间、机位或文案后
必须重新导出，不能只替换视频文件。

成片配乐由 `scripts/compose-score.py` 用 numpy / scipy 程序化合成，无外部采样；
母带与封装命令见 `deliverables/REPORT.md`。`deliverables/shanghai-bund-v2-2k60.mp4`
是带 AAC 音轨的主交付，`...-silent.mp4` 是无声备份；网页 `?film=1` 仍为静音预览。

## 版本关系

v1.0 与 v2.0 完全独立，各自带 `package.json`、`vite.config.js` 和 `.gitignore`。
`river.js` 只存在于 v2.0；v2 的 `city.js`、`bund.js`、`boats.js` 等都已改为沿河道生成，
修改时不要假设 v1 的实现可以照搬。
v3.0 同样独立，且不复用 v2 的 `river.js`：v2 的河道是艺术化的 `CatmullRomCurve3` 曲线，
v3 的岸线来自 OSM 真实数据，两者的几何来源与坐标基准都不同。
`枫桥夜泊` 与三个外滩版本无关，独立演进。

## 上海外滩 v3.0（进行中，源码在功能分支）

方向是真实地理数据驱动的 1:1 场景：OSM 岸线 / 道路 / 建筑轮廓，3D-GloBFP 建筑高度，
Copernicus DEM 地形，WGS84 → 局部 ENU 投影，1 世界单位 = 1 米。需求见
`prompt/上海外滩v3.0.md`；spec 与 22 个任务的实施计划在 `feat/shanghai-bund-v3`
分支的 `docs/superpowers/` 下。

- **状态**：2026-11-05 完成 Task 1（脚手架、Playwright 冒烟、构建）后由用户暂停，
  Task 2–22 的 brief 已预生成在 `.superpowers/sdd/2026-11-05-shanghai-bund-v3/`。
- **master 工作区的 `material/上海外滩v3.0/` 没有源码**，只有被根 `.gitignore` 忽略的
  `dist/`、`node_modules/` 与 `test-results/`。不要从 `dist/` 反推实现，也不要把它
  当成已有项目继续开发。
- 恢复开发：`git switch feat/shanghai-bund-v3`，先读该目录的台账 `progress.md`。

## 枫桥夜泊（独立 Three.js 项目）

`material/枫桥夜泊/` 不是外滩版本，而是一个独立的 Vite + Three.js 项目：
40 秒、60 fps 的《枫桥夜泊》三维诗词短片与可漫游场景。它有自己的
`package.json`、`vite.config.js`、`.gitignore`、`README.md` 与导出脚本，
命令与外滩项目相同（`npm install` / `npm run dev` / `npm run build`）。

场景基准：河道沿 X 轴，南岸 z > 34 是枫桥、枫林、码头与客船；北岸 z < -34
是寒山寺山坡；月亮压在西北天际线附近。主要模块在 `src/world/`：`terrain.js`
（江岸/远山/码头）、`bridge.js`、`trees.js`、`boat.js`、`temple.js`、`fishing.js`、
`birds.js`、`mist.js`、`water.js`、`sky.js`。`src/config.js` 集中存放色彩、
水平基准、关键坐标和导航机位。

时间线在 `src/film.js`：0–7 s 月落江天、7–16 s 江枫渔火、16–26 s 寒山寺、
26–35 s 夜半钟声、35–40 s 回到客船并拉远。34.6–35.4 s 是黑场过渡，遮住钟楼到
客船的切镜；`FINALE_KEYS` 与 `KEYS` 是两段独立的相机曲线。

渲染注意：
- **不要把 `renderer.shadowMap.autoUpdate` 设为 false 而不在首帧前初始化阴影贴图。**
  本项目曾因首帧没有阴影贴图导致所有 `MeshStandardMaterial` 采样
  `sampler2DShadow` 失败、整批网格不绘制；现在保持 `autoUpdate = true`。
- 后处理链：`RenderPass → BokehPass → UnrealBloomPass → GradePass → OutputPass`。
  `?nobokeh=1` 可关闭景深；Bokeh 的聚焦距离随相机与注视点更新。
- 水面使用 `Reflector` + 自定义 shader；月亮碎影、渔火倒影和钟声涟漪都在
  `water.js` 的 GLSL 中。新增灯源时通过 `water.setLantern(index, position, color, power)`
  注册，最多 10 盏。
- 所有贴图由 `src/utils/textures.js` 的 Canvas 生成，不引入外部模型或图片。
  场景内的水声、风声、鸦鸣与寺钟由 `src/audio.js` 程序化合成；成片配乐由
  `scripts/compose-score.py`（numpy / scipy）或 `compose-score-guqin.py` /
  `compose-score-guzheng.py` 合成。另有一条使用 HeyGen 曲库 BGM 的成片版本
  （`compose-heygen-fx.py` 叠加画内音，源曲在 `.media/`），不属于程序化生成。

调试入口是 `window.__fengqiao`（`renderer / scene / camera / controls / composer /
world / film / audio / flyTo / setView / setDemo`）。影片导出流程：
`npm run dev -- --port 5188 --strictPort`，然后
`npm run export:film -- --url http://127.0.0.1:5188/ --frames deliverables/frames`、
`npm run encode:film -- ...`、`npm run stills:film -- ...`、`npm run score`；完整母带与
封装命令见 `material/枫桥夜泊/deliverables/REPORT.md`。
`deliverables/` 被根 `.gitignore` 忽略，成片、配乐与帧序列都不入库。

## 一树鎏金 · 秋日银杏树（独立 Three.js 项目）

`material/一树鎏金·秋日银杏树/` 是独立的 Vite + Three.js 项目：一棵程序化生成的成熟
银杏树、可自由漫游的展示页，以及 30 秒六镜头电影短片。提示词见
`prompt/一树鎏金·秋日银杏树.md`，细节与导出命令见该目录 `README.md`。

场景基准：树高约 13.8 m、冠幅约 11.6 m，树根位于地面原点，1 世界单位 = 1 米。
主干与四级分枝由自定义锥形管沿 `CatmullRomCurve3` 生成，合并为单个
`BufferGeometry`；47,871 片银杏叶用一个 `InstancedMesh` 绘制。树皮、叶片、地面、
落叶毯、环境贴图全部由 Canvas 与固定种子程序化生成。风动在顶点着色器中按
`aSway / aPhase` 驱动，飘落叶按绝对时间解析，保证逐帧可重放。

影片时间线是纯函数 `src/filmTimeline.js`：0–5 整体、5–11 环绕、11–16 仰视、
16–21 叶片微距、21–25 树干、25–30 收尾；机位、FOV、景深与片尾题字均由绝对时间推导。
后期链：`RenderPass → BokehPass → UnrealBloom → Grade → SMAA → OutputPass`。
调试入口 `window.__yinxing`；`?film=1` 实时播放，`?film=1&capture=1` 下暴露
`window.__capture.renderAt(t)`，配 `scripts/export-film.mjs` 逐帧导出 1080p60。

渲染注意：
- **`renderer.shadowMap.autoUpdate` 必须保持 `true`。** 手动关闭后首帧阴影贴图未初始化，
  所有受光材质会因采样格式不匹配而整批绘制失败（与《枫桥夜泊》同类问题）。
- 自定义锥形管的三角形绕序必须朝外；绕序反了会看到管体内壁，树干被错误照亮，
  树皮纹理与阴影都会失真。
- 树干特写依赖只在 `bark` 镜头启用的摄影机侧 SpotLight；其他镜头保持逆光氛围。

`deliverables/yishu-liujin-1080p60.mp4` 是主交付（1920×1080、60fps、30s、H.264 +
AAC 48 kHz 立体声），`deliverables/yishu-liujin-1080p60-silent.mp4` 是无声备份，
`deliverables/previews/` 是七张关键帧。`deliverables/` 整体被根 `.gitignore` 忽略。

配乐来自 HeyGen 曲库，源曲缓存在 `.media/audio/bgm/bgm_001.wav`（`.media/` 被忽略）。
曲目来源、track id、11–41 s 选段、−1.48 dB 线性母带与 AAC 封装记录见
`material/一树鎏金·秋日银杏树/docs/heygen-score.md`；重新生成用
`npm run score:heygen` 与 `npm run mux:score`。网页 `?film=1` 仍为静音预览，
配乐只存在于成片 MP4。全新的 HeyGen 曲目下载在当前网络会被 HyperFrames 的
非公网地址策略拦截，本次采用 `media-use --reuse` 复用全局 HeyGen 缓存。

## 诛仙 · 青云山七峰（独立 Three.js 项目）

`material/诛仙青云山七峰/` 是一个独立的 Vite + Three.js 项目：36 秒五镜头仙侠短片
与可漫游场景，提示词在 `prompt/诛仙青云山七峰.md`。

场景基准：谷地 420 m，七峰 1170–1790 m，云海 740–1080 m（山腰云带 1320 m）。
地形唯一真值是 `src/world/shape.js` 的 `heightAt(x, z)`；网格、植被、建筑、相机碰撞
全部查询它。修改峰形、云层高度或太阳关键帧后必须重新导出成片。

影片时间线是纯函数 `src/filmTimeline.js`：0–8 云海初开、8–15 通天玉阶、
15–22 竹影双峰、22–29 龙首垂瀑、29–36 落霞满袖；切点用 0.8 秒穿云白场。
渲染链：`RenderPass → 体积云 Pass（world/clouds.js）→ Bloom → Grade → OutputPass → SMAA`。
主渲染目标必须带 `DepthTexture` 且不能开 MSAA，否则云 Pass 读不到场景深度。

调试入口 `window.__qingyun`；`?film=1&capture=1` 下暴露 `window.__capture.renderAt(t)`。
导出命令见 `material/诛仙青云山七峰/README.md`。

## 授权

代码可直接用于学习与二次创作；Three.js 采用 MIT 许可。
