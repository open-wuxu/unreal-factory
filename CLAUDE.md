# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目性质

仓库名 `unreal_factory` **不是 Unreal Engine 项目**，与 Unreal Engine 没有任何关系。
这里是一组完全程序化生成、可交互的 Three.js 城市景观素材，`material/` 下每个版本都是
独立的 Vite 前端项目，根目录没有 `package.json`。

- `material/上海外滩v2.0/` — 当前主版本（U 形江湾 + 陆家嘴半岛），新工作默认在这里进行。
- `material/上海外滩v1.0/` — 直线河道的存档版本，仅作参考；除非明确要求，不要同步修改。
- 代码中出现的 `UnrealBloomPass` 是 three.js 自带的后处理通道，同样与 Unreal Engine 无关。

## 常用命令

每个版本目录独立安装、独立运行，命令不能从仓库根目录执行：

```bash
cd material/上海外滩v2.0

npm install
npm run dev       # Vite 开发服务器，默认 http://localhost:5173
npm run build     # 产物输出到 dist/，base 为 "./"，可部署到任意子目录
npm run preview   # 本地预览构建产物
```

v1.0 的命令相同，只需替换目录名。

- 环境要求：Node.js ≥ 20.19（Vite 7），支持 WebGL 2 的桌面浏览器。
- 没有测试、lint 或类型检查脚本。验证改动的方式是 `npm run build` 通过，
  再在浏览器里实际查看场景（`npm run dev`）。

## 架构

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

## 版本关系

v1.0 与 v2.0 完全独立，各自带 `package.json`、`vite.config.js` 和 `.gitignore`。
`river.js` 只存在于 v2.0；v2 的 `city.js`、`bund.js`、`boats.js` 等都已改为沿河道生成，
修改时不要假设 v1 的实现可以照搬。

## 授权

代码可直接用于学习与二次创作；Three.js 采用 MIT 许可。
