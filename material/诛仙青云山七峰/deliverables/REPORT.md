# 诛仙 · 青云山七峰 — 交付报告

日期：2026-11-18

## 交付物

| 文件 | 规格 |
| --- | --- |
| `deliverables/qingyun-seven-peaks-2k60.mp4` | 2560×1440 / 60 fps / 36.000 s / 2160 帧 / H.264 High / AAC 192 kbps / 65.5 Mbps / 281 MiB / −18.0 LUFS（TP −10.3 dBTP，LRA 3.2） |
| `deliverables/qingyun-seven-peaks-2k60-silent.mp4` | 同上，无音轨，280.3 MiB，供重新配乐 |
| `deliverables/qingyun-score.wav` | 48 kHz / 立体声 / 36.0 s / loudnorm 目标 −18 LUFS |
| `deliverables/previews/01–07-*.png` | 七张 2560×1440 关键镜头截图 |
| `deliverables/frames/` | 2160 帧 JPEG 序列 + manifest.json（gitignore，可重新生成） |

本次逐帧捕获耗时 **305 秒**（6.55 帧/秒），编码为 libx264 CRF 16 / preset slow /
BT.709 / yuv420p。帧序列可由 `manifest.json` 复核。

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
| 松 / 秋树 / 草 | 986 / 600 / 3 199 |
| 建筑 | 共享参数化屋顶、台基、柱列、斗拱、栏杆、石阶、亭塔桥构件 |
| 阴影 | 单方向光 4096² PCF，焦点跟随镜头，±1400 m |
| 后处理 | 体积云 → Bloom → Grade → OutputPass → SMAA |

实际渲染耗时与文件体积以本次导出日志为准；`deliverables/frames/manifest.json`
记录了帧数、分辨率与耗时。

## 验证记录

- `npm test`：高度函数、七峰建筑落位、植被贴地、瀑布落差、影片时间线全部通过。
- `npm run test:interactions`：八个机位、R 重置、窗口 resize、相机防穿地、阴影焦点跟随通过。
- `npm run verify:scene -- --resize`：1600×900 → 1280×720 → 2560×1440，云 Pass 正常，无 WebGL 上下文丢失。
- `npm run build`：通过（仅有 Three.js 单包体积警告）。
- 成片：`ffprobe` 确认 2560×1440 / 60 fps / 36.0 s / 音轨存在。

## 已知限制

- 山体在远景仍偏圆缓，缺少真实山岳的高频岩壁细节；近景依靠植被与建筑建立尺度。
- 云海为单次散射近似，逆光时高光较强，暗部结构偏软。
- 瀑布水带是半透明 ribbon，近看缺少水体厚度与泡沫细节。
- 建筑为参数化组合，未有真实木构的榫卯与彩画级别细节。
- 影片第 4 镜在云带较厚时瀑布可能被部分遮挡。

## 资源与许可

所有几何、贴图、环境贴图、云、水、植被与音频均由源码程序化生成，未使用外部模型、
图片或采样。Three.js 采用 MIT 许可。
