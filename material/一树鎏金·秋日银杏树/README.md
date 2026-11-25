# 一树鎏金 · 秋日银杏树

一棵完全程序化生成的成熟银杏树，以及围绕它的六镜头 30 秒 Three.js 电影短片。

- 场景：`http://localhost:5173/`（自动演示 + 自由浏览）
- 影片：`http://localhost:5173/?film=1`（静音预览）
- 成片（带配乐）：[`deliverables/yishu-liujin-1080p60.mp4`](deliverables/yishu-liujin-1080p60.mp4)（1920×1080 / 60fps / 30s / H.264 + AAC）
- 无声备份：[`deliverables/yishu-liujin-1080p60-silent.mp4`](deliverables/yishu-liujin-1080p60-silent.mp4)
- 配乐母带：[`deliverables/yishu-liujin-heygen-score.wav`](deliverables/yishu-liujin-heygen-score.wav)
- 关键帧：[`deliverables/previews/`](deliverables/previews/)

## 快速开始

```bash
cd material/一树鎏金·秋日银杏树
npm install
npm run dev          # http://localhost:5173
npm run build        # 产物输出到 dist/，base 为 "./"
npm run preview
```

环境：Node.js ≥ 20.19、支持 WebGL 2 的桌面浏览器。项目以 `three@0.186.0` 为唯一运行时依赖。

## 交互

| 操作 | 功能 |
| --- | --- |
| 拖拽 / 滚轮 / 右键拖拽 | 旋转 / 缩放 / 平移 |
| `1`–`5` | 整体 / 仰视 / 树冠 / 叶片 / 树干 |
| `Space` | 暂停或继续自动演示；自由浏览时回到演示 |
| `R` | 回到整体视角 |
| `A` | 自动 360° 环绕 |
| 底部时间轴 | 拖动到影片任意时刻 |
| 重播 / 重置 | 从头播放 / 回到整体机位 |
| 飘落银杏 | 开关飘落叶片 |
| 片尾题字 | 开关片尾「一树鎏金 · 秋意正浓」 |

首次进入为自动演示模式；鼠标触碰画面或用机位按钮即可接管摄影机。相机被约束在树干与树冠核心之外，且不会穿过地面。

## 30 秒影片

时间线在 `src/filmTimeline.js` 中由纯函数定义，任意时刻的机位、FOV、景深与字幕都可直接求解。

| 时间 | 镜头 | 内容 |
| --- | --- | --- |
| 0–5 s | 整体亮相 | 低机位缓慢推进，逆光完整树形 |
| 5–11 s | 360° 环绕 | 参数化圆轨，树始终位于画面中央 |
| 11–16 s | 低角度仰视 | 沿主干上移，仰看层叠树冠与透光 |
| 16–21 s | 叶片微距 | 东南侧树冠缘的加密叶簇，浅景深 |
| 21–25 s | 树干与枝条 | 北侧补光下的树皮、分叉与主枝连接 |
| 25–30 s | 完整收尾 | 拉远回到完整树形，片尾题字淡入 |

切点用 0.22 秒的暖金色光晕遮罩；片头 0.95 秒从黑场淡入。`?film=1&capture=1` 下停止实时循环，由 `window.__capture.renderAt(t)` 以固定 1/60 秒步长逐帧推进，`src/deterministic.js` 用固定种子覆盖 `Math.random`。

## 配乐（HeyGen）

成片配乐来自 **HeyGen 曲库**：低回的古琴与箫、带风声织体。
完整来源、track id、选段与母带数据见 [`docs/heygen-score.md`](docs/heygen-score.md)。

- 源曲 45 s，取 **11.0–41.0 s** 作为 30 s 配乐；16–21 s 微距处进入安静段，25–30 s 展开并在片尾自然衰减。
- 1.2 s 淡入、28.2 s 起 1.8 s 淡出；−1.48 dB 线性增益，不做动态压缩。
- 母带 48 kHz 立体声 PCM s16le；封装为 AAC 192 kbps。
- 成片实测 **−19.1 LUFS / −2.1 dBTP**。
- 网页 `?film=1` 仍为静音预览；带配乐版本在 `deliverables/` 的 MP4 中。

曲目缓存在 `.media/audio/bgm/bgm_001.wav`，`.media/` 被 `.gitignore` 忽略，不随仓库分发。

## 程序化建模

### 树干与枝条

- 主干由自定义「锥形管」沿 `CatmullRomCurve3` 扫掠生成：每圈半径、法线、UV、风动权重与相位都写入顶点属性。
- 根部 7 条放射状根、基部 5 瓣隆起与噪声起伏共同形成根盘；主干半径从约 0.6 m 收至 0.16 m。
- 分枝层级：主干 → 一级主枝（12 根）→ 二级 → 三级 → 末端小枝（4 级），另加 4 根顶部主枝。共 1,223 段、879 根末端小枝。
- 子枝围绕父枝做轴角旋转散开，并向外、向上偏置，避免形成扁平的「羽毛」结构。
- 所有枝干几何合并为一个 `BufferGeometry`，一次绘制；树皮使用程序化 Canvas 生成的 albedo / bump / roughness 三张 1024² 贴图。

### 叶片与树冠

- 47,871 片银杏叶全部由一个 `InstancedMesh` 绘制，每片携带实例矩阵与实例颜色。
- 叶片贴图由 Canvas 绘制：扇形轮廓、顶部缺口、波浪边缘、放射状叶脉、叶柄与琥珀色渐变。
- 叶簇围绕枝条在三维空间球形铺开；上层树冠额外加密 1.32 倍，弱化过尖的顶部轮廓。
- 颜色在金黄、浅黄、琥珀、橙黄与少量黄绿之间加权取样，并带随机明度。
- 树冠东南缘有一小簇额外加密的真实小枝叶片，专门作为微距镜头的焦点。

### 风动与飘落

- 枝干顶点着色器按 `aSway / aPhase` 弯曲：主干约 0，末端小枝约 0.15 m。
- 叶片着色器按实例位置生成相位，产生轻微的颤动与位移；阴影视差通过自定义深度材质同步。
- 34 片飘落叶由绝对时间解析：各自的下落时长、横向漂移、翻转与落地位置均固定，可精确重放。

### 透光与材质

- 叶片使用 `MeshStandardMaterial` + `alphaTest`，并在片元着色器中加入基于视线与太阳夹角的暖金色透射项，只在逆光角度提亮。
- 树皮为高粗糙度 PBR 材质，叠加几何起伏、凹凸贴图与近景摄影机补光。
- 材质、贴图、环境贴图均程序化生成，不依赖外部模型或图片。

## 渲染

- ACES Filmic tone mapping，曝光 0.95，像素比上限 1.6。
- 主光为约 19° 仰角的暖色低阳，位于树冠后方偏左；另有半球光、地面反弹光、正面柔光与边缘光。
- 阴影：单主光 + 2048² PCF，`shadowMap.autoUpdate` 必须为 `true`（手动关闭会导致首帧阴影贴图未初始化，整批受光网格不绘制）。
- 后期链：`RenderPass → BokehPass（各镜头焦点与孔径独立）→ UnrealBloom → Grade（暖色分离、暗角、颗粒）→ SMAA → OutputPass`。
- 天空为渐变 ShaderMaterial（太阳圆盘 + 地平线薄雾），另外叠加低透明度加法光柱 Sprite。

## 导出

```bash
# 终端 1
npm run dev -- --port 5188 --strictPort

# 终端 2：逐帧渲染 1800 张 1920×1080 JPEG
npm run export:film -- --frames deliverables/frames --width 1920 --height 1080

# 编码无声 H.264 MP4（CRF 16 / preset slow / BT.709 / faststart）
npm run encode:film -- --frames deliverables/frames \
  --out deliverables/yishu-liujin-1080p60-silent.mp4

# 剪辑 HeyGen 配乐（30 s / 48 kHz / 立体声）并封装 AAC
npm run score:heygen
npm run mux:score

# 关键帧 PNG
npm run stills:film -- --out deliverables/previews
```

实测：1920×1080 逐帧渲染约 12 fps，1800 帧约 157 秒；无声成片 54.7 MiB，
带配乐成片 55.4 MiB（1920×1080 / 60fps / 30.000 s / H.264 + AAC 192 kbps）。

## 校验

```bash
npm run verify:scene        # 浏览器渲染、Shader / WebGL、叶片与枝条统计、关键帧
npm run test:interactions   # 自动演示、机位、景深、环绕、飘叶、重置、film/capture 模式
npm run build
```

`verify:scene` 会输出 `deliverables/checks/report.json` 和六张检查帧。

## 目录

```
src/
  config.js            世界尺寸、色彩、太阳、机位与相机安全区
  main.js              渲染器、后期链、交互、自由浏览与主循环
  film.js              影片播放器（绝对时间驱动）
  filmTimeline.js      六镜头时间线、FOV、景深、转场与题字曲线
  deterministic.js     捕获模式的固定随机种子
  ui.js                HUD 绑定
  style.css            页面与影片覆盖层样式
  utils/
    noise.js           固定种子随机与 value noise
    textures.js        树皮、叶片、地面、草、落叶毯、光晕、环境贴图
  world/
    index.js           场景装配
    tree.js            主干/分枝/叶片/风动/透光/树皮
    ground.js          地面、草簇、落叶毯与散落叶
    falling.js         解析式飘落叶
    sky.js             天空、太阳、环境光与阴影
    lightShafts.js     树冠背后的柔光光柱
scripts/
  export-film.mjs      逐帧导出
  encode-film.mjs      FFmpeg 编码与规格核验
  capture-stills.mjs   关键帧
  cut-score.mjs        HeyGen 配乐剪辑与线性母带
  mux-score.mjs        封装 AAC 音轨
  verify-scene.mjs     渲染与资源冒烟检查
  test-interactions.mjs 交互冒烟检查
docs/
  heygen-score.md      配乐来源、选段、母带与封装记录
```

## 备注

- 所有随机过程使用固定种子（树 0x91c4a7、地面 0x3ac81d、飘叶 0x6f2d11 等），刷新、拖动时间轴与逐帧导出结果一致。
- 视觉资源（几何、贴图、环境贴图）全部程序化生成；配乐是唯一的第三方媒体，来自 HeyGen 曲库，来源与授权流程见 `docs/heygen-score.md`。
- 锥形管索引绕序必须让正面朝外；绕序反了会看到管体内壁，树干会被错误地照成灰白，并且树皮纹理与阴影都会失真。
- `deliverables/`、`.media/` 与 `node_modules/` 被仓库根 `.gitignore` 忽略；成片、帧序列、预览与配乐源文件不入库。
