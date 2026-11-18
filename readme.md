# unreal_factory

完全程序化生成、可交互的 Three.js 三维场景素材仓库。

`material/` 下每个目录都是一个**独立的前端项目**，自带 `package.json`、
`vite.config.js` 与 `.gitignore`，可以单独安装、运行与构建。场景中的几何、贴图、
环境贴图、天空、水面、粒子与画内声音均由代码或 Canvas 生成，不依赖外部模型或
图片素材；成片配乐的来源见各项目 README。

## 目录结构

```
unreal_factory/
├── material/
│   ├── 上海外滩v1.0/      # 直线河道版本（存档）
│   ├── 上海外滩v2.0/      # U 形江湾 + 陆家嘴半岛（外滩主版本）
│   ├── 上海外滩v3.0/      # 真实地理数据版（开发中，源码在功能分支）
│   └── 枫桥夜泊/          # 独立项目：40 秒三维诗词短片
├── prompt/                # 各项目的原始需求提示词
├── docs/superpowers/      # 设计与实施计划（specs / plans）
├── .gitignore
└── readme.md
```

## 项目一览

| 项目 | 性质 | 状态 | 说明 |
| --- | --- | --- | --- |
| [上海外滩 v1.0](./material/上海外滩v1.0/README.md) | 外滩场景 | 存档 | 沿 Z 轴直线河道的初版 |
| [上海外滩 v2.0](./material/上海外滩v2.0/README.md) | 外滩场景 | 当前主版本 | U 形江湾、陆家嘴半岛、28 秒影片 |
| 上海外滩 v3.0 | 外滩场景 | 开发中（已暂停） | OSM + GloBFP + DEM 的 1:1 真实地理版 |
| [枫桥夜泊](./material/枫桥夜泊/README.md) | 诗词短片 | 已完成 | 40 秒 2K60 成片与可漫游江南夜景 |

## 上海外滩 v1.0 / v2.0

v2.0 是外滩一系的主版本：黄浦江由一条 `CatmullRomCurve3` 中心线生成大尺度 U 形弯道，
陆家嘴位于弯道内侧的半岛上，两岸建筑、道路、步道、码头与船只都沿同一条河道展开。
v1.0 是保留的直线河道存档版本，两者完全独立。

| | v1.0 | v2.0 |
| --- | --- | --- |
| 河道 | 沿 Z 轴的直线河道 | `CatmullRomCurve3` 中心线生成的大尺度 U 形弯道 |
| 布局 | 两块直线岸线的大平面 | 陆家嘴半岛三面环水，城市沿河岸曲线展开 |
| 水面 | 矩形平面 | 沿河道生成的连续 ribbon 网格 |
| 动态 | 游船沿 Z 轴往返 | 游船 / 货轮分航线航行并自动转向 |
| 视角 | 平直滨江视角 | 高空斜俯视，完整展示 U 形江湾 |
| 影片 | — | 28 秒四镜头固定机位版本，可导出 2K60 MP4 |

详细差异与实现说明见各版本 README：

- [上海外滩 v1.0](./material/上海外滩v1.0/README.md)
- [上海外滩 v2.0](./material/上海外滩v2.0/README.md)

## 枫桥夜泊

与三个外滩版本无关的独立项目：40 秒、60 fps 的《枫桥夜泊》三维诗词短片，
同时是一个可自由漫游的江南深秋夜景。石拱枫桥、江岸枫林、停泊客船、渔船灯火、
雾中的寒山寺与夜半钟声全部由代码生成。

```bash
cd material/枫桥夜泊

npm install
npm run dev        # http://localhost:5173
```

页面默认进入自动演示，`?film=1` 只保留纯净影片页。成片、配乐与关键截图在
`deliverables/`（根 `.gitignore` 忽略，不入库），导出与母带流程见该项目的
`README.md` 与 `deliverables/REPORT.md`。

## 上海外滩 v3.0（进行中）

v3.0 用真实地理数据替换艺术化布景：黄浦江岸线、道路与建筑轮廓来自 OSM，
建筑高度来自 3D-GloBFP，地形来自 Copernicus DEM，经 WGS84 → 局部 ENU 投影后
以 1 世界单位 = 1 米建模。需求见 [`prompt/上海外滩v3.0.md`](./prompt/上海外滩v3.0.md)。

2026-11-05 完成 Task 1（脚手架、Playwright 冒烟、构建）后暂停。源码、spec 与
22 个任务的实施计划都在 `feat/shanghai-bund-v3` 分支上；master 工作区中的
`material/上海外滩v3.0/` 只有本地的 `dist/`、`node_modules/` 与 `test-results/`，
没有源码。

```bash
git switch feat/shanghai-bund-v3
```

## 提示词与设计文档

- `prompt/` — 每个项目的原始需求提示词，是判断场景方向与验收标准的依据：
  `上海外滩v1.0.md`、`上海外滩v2.0.md`、`上海外滩v3.0.md`、`枫桥夜泊.md`。
- `docs/superpowers/specs/` — 设计文档；`docs/superpowers/plans/` — 分任务实施计划。
  master 上的文档目前属于《诛仙·青云山七峰》，开发分支为 `feat/qingyun-seven-peaks`。

## 快速开始

环境要求：Node.js ≥ 20.19，支持 WebGL 2 的桌面浏览器。以下以 v2.0 为例，
枫桥夜泊的命令相同，只需替换目录名。

```bash
cd material/上海外滩v2.0

npm install
npm run dev
```

打开终端提示的地址（默认 <http://localhost:5173>）。

生产构建与本地预览：

```bash
npm run build
npm run preview
```

构建产物输出到 `dist/`，使用相对路径，可部署到任意静态服务器或子目录。

## 场景亮点

- **四座地标**：东方明珠、上海中心、环球金融中心、金茂大厦，均为参数化建模。
- **外滩建筑群**：16 栋历史建筑，含柱廊、山花、穹顶、绿色铜皮屋顶与海关钟楼。
- **黄浦江水面**：真实平面反射 + 自定义水面着色器，含菲涅尔、波光、夜间灯影与贴岸泡沫。
- **昼夜系统**：白天 / 黄昏 / 夜景三种状态，1.9 秒平滑过渡，天空、灯光、雾、
  曝光、泛光与窗灯统一插值。
- **城市动态**：车流、游船、货轮、桥梁缆索与码头灯光。
- **枫桥夜泊**：递归枫树、放样客船、飞檐屋面生成器、钟声涟漪与贴水夜雾。
- **性能优化**：`InstancedMesh`、共享材质、像素比上限 1.6。

## 开发约定

- 每个项目目录自成一体，依赖与构建脚本互不影响，命令不能从仓库根目录执行。
- `node_modules/`、`dist/`、`deliverables/` 等生成物不入库，由根目录 `.gitignore`
  与各项目自己的 `.gitignore` 统一忽略；测试产物（`test-results/`、
  `playwright-report/`）与下载的媒体素材（`.media/`）同样不入库。
- 本机 skills 配置（`.claude/`、`.agents/`、`skills-lock.json`）不入库，见根目录 `.gitignore`。

## 授权

代码可直接用于学习与二次创作。Three.js 采用 MIT 许可。
