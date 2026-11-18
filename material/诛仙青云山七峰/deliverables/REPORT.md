# 诛仙 · 青云山七峰 — 交付报告

日期：2026-11-18

## 交付物

| 文件 | 规格 |
| --- | --- |
| `deliverables/qingyun-seven-peaks-2k60.mp4` | 2560×1440 / 60 fps / 36.000 s / 2160 帧 / H.264 High / AAC 192 kbps / 67.0 Mbps / 287.4 MiB / −18.0 LUFS（TP −10.3 dBTP，LRA 3.2） |
| `deliverables/qingyun-seven-peaks-2k60-silent.mp4` | 同上，无音轨，286.5 MiB，供重新配乐 |
| `deliverables/qingyun-score.wav` | 48 kHz / 立体声 / 36.0 s / loudnorm 目标 −18 LUFS |
| `deliverables/previews/01–07-*.png` | 七张 2560×1440 关键镜头截图 |
| `deliverables/frames/` | 2160 帧 JPEG 序列 + manifest.json（gitignore，可重新生成） |

本次逐帧捕获耗时 **264 秒**（约 8.2 帧/秒；建筑合并后 draw call 从 3188 级降到 32 个批次），
编码为 libx264 CRF 16 / preset slow / BT.709 / yuv420p。帧序列可由 `manifest.json` 复核。

## 渲染与导出

1. `npm run dev -- --port 5199 --strictPort`
2. `npm run export:film -- --url http://127.0.0.1:5199/ --frames deliverables/frames`
   （`?film=1&capture=1`，固定 1/60 秒步长，固定随机种子）
3. `npm run encode:film -- --frames deliverables/frames --out deliverables/qingyun-seven-peaks-2k60-silent.mp4`
   （libx264，CRF 16，preset slow，yuv420p，BT.709）
4. `python3 scripts/compose-score.py` + `loudnorm I=-18 TP=-2 LRA=9`
5. ffmpeg 封装 AAC 音轨，视频流直接复制
6. `npm run stills:film` 导出关键画面

## 场景统计

| 项 | 数值 |
| --- | --- |
| 地形网格 | 4 级同心方环，约 33.6 万顶点 / 66.6 万三角面 |
| 七峰峰顶 | 1170–1790 m（谷地 420 m） |
| 云海 | 半分辨率 Ray Marching，48 步，谷地 740–1080 m + 山腰 1320 m（7%） |
| 竹子 | 大竹峰 12 800 竿、小竹峰 5 600 竿，含两层叶簇实例 |
| 松 / 秋树 / 草 | 994 / 600 / 3 199 |
| 建筑 | 共享参数化屋顶、台基、柱列、斗拱、栏杆、石阶、亭塔桥构件 |
| 阴影 | 单方向光 4096² PCF，`autoUpdate=false`，焦点跟随镜头（±1400 m），影片帧与焦点变化时显式刷新 |
| 后处理 | 体积云 → Bloom → Grade → OutputPass → SMAA |

本次实际渲染耗时 264 s、成片 287.4 MiB；`deliverables/frames/manifest.json` 记录了
帧数、分辨率与耗时。

## 验证记录

- `npm test`：高度函数、**地形环缝合与台地平整**、七峰建筑落位与**逐级台阶接地**、植被贴地、瀑布落差、影片时间线全部通过。
- `npm run test:interactions`：八个机位、R 重置、窗口 resize、**飞行途中防穿地**、阴影焦点跟随、`shadowMap.autoUpdate === false` 通过。
- `npm run test:determinism`：同一时刻 `t=12` / `t=24` 从不同 seek 历史重放，截图解码后的像素 MD5 完全一致。
- `npm run verify:scene -- --resize`：1600×900 → 1280×720 → 2560×1440，云 Pass 半分辨率目标随之缩放，阴影不自动重建，无 WebGL 上下文丢失。
- `npm run build`：通过（仅有 Three.js 单包体积警告）。
- 成片：`ffprobe` 确认 2560×1440 / 60 fps / 2160 帧 / 36.000 s / AAC 48 kHz 立体声；`loudnorm` 实测 −18.0 LUFS，真峰 −10.3 dBTP。

## 审查修复

最终独立审查提出的 3 个 Critical、7 个 Important 已全部修复并重新导出：

1. 方环地形的 T 型接缝（实测 6–19 m）→ 粗环内边界增加中点缝合三角形，接缝顶点直接取自 `heightAt`。
2. 石阶悬空（最高约 520 m）→ `surfaceAt` 改为按 `fromZ + z` 采样地形，逐级踏板贴地。
3. 台地因域扭曲不平、建筑/栏杆悬空 → 台地掩码改用未扭曲半径，所有建筑组按 `groundLocal` 落座。
4. 飞行动画中途穿地 → 飞行路径每帧夹到 `heightAt + 8`。
5. 演示模式不显示字幕/穿云/片名 → 新增 `body.is-demo` 影片层。
6. 缺少「观看影片」/「返回」入口 → 已补。
7. 重放不确定（水雾 delta 累积、环境贴图依赖 seek 历史）→ 水雾改为绝对时间；环境贴图按 2.2 s 量化桶生成。
8. 阴影每帧重建 → `shadowMap.autoUpdate=false`，并修正全局 `renderer.shadowMap.needsUpdate` 初始化（否则所有 StandardMaterial 不绘制）。
9. 建筑 3188 个独立 Mesh → 按材质合并为 32 个批次。
10. 环间法线/AO 接缝 → 地形法线统一由 `normalAt` 生成，AO 在近环外缘渐隐。

重新导出后，本次捕获耗时从 305 s 降到 264 s。

## 已知限制

- 山体在远景仍偏圆缓，缺少真实山岳的高频岩壁细节；近景依靠植被与建筑建立尺度。
- 云海为单次散射近似，逆光时高光较强，暗部结构偏软。
- 瀑布水带是半透明 ribbon，近看缺少水体厚度与泡沫细节。
- 建筑为参数化组合，未有真实木构的榫卯与彩画级别细节。
- 影片第 4 镜的瀑布位于画面右侧，云带较厚时会被部分遮挡。
- 石阶在远景中偏细，近景可辨认但不如近景建筑突出。

## 资源与许可

所有几何、贴图、环境贴图、云、水、植被与音频均由源码程序化生成，未使用外部模型、
图片或采样。Three.js 采用 MIT 许可。
