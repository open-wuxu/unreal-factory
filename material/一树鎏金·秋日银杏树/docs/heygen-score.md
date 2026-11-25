# 成片配乐来源与母带

成片 `deliverables/yishu-liujin-1080p60.mp4` 使用 **HeyGen 曲库**中的古琴/箫曲目，
以 AAC 48 kHz 立体声封装；无声备份为
`deliverables/yishu-liujin-1080p60-silent.mp4`。网页 `?film=1` 仍为静音预览。

## 曲目

| 字段 | 值 |
| --- | --- |
| provider | `heygen.audio.sounds` |
| track id | `89d7b95ce80f49ee9d1ecd27f23f5629` |
| 原始描述 | low sparse guqin and xiao, wind and rain textures, slow and lonely, with drums swelling at the climax |
| 原始检索意图 | traditional Chinese guqin and guzheng, melancholic night, moonlit river, temple bell, sparse cinematic underscore, slow, 40 seconds |
| 时长 / 格式 | 45 s / 44.1 kHz 立体声 PCM |
| 授权方式 | HeyGen OAuth（HyperFrames 免费使用路径） |
| 本地缓存 | `.media/audio/bgm/bgm_001.wav`（被 `.gitignore` 忽略，不随仓库分发） |

### 为什么复用

先按“暖金秋日、银杏、古筝与弦乐”的意图检索新曲，HeyGen 返回的音源域名在
当前网络解析到非公网地址，被 HyperFrames 的下载安全策略拦截
（`Media download blocked: host resolves to a non-public address`）。
没有绕过该策略；改为使用 media-use 的官方复用路径，导入全局 HeyGen 缓存中
音色最接近的曲目：

```bash
npx hyperframes media-use resolve --type bgm \
  --intent "warm golden autumn ginkgo tree, contemplative Chinese guqin and xiao, gentle wind, slow cinematic build" \
  --reuse 4f6a0f5965e48040 --project .
```

该曲是低回的古琴与箫、带风声织体，气质安静克制，适合“一树鎏金”的秋日展示；
原曲的夜雨/寺钟意图不会以文字或画面形式出现在成片中。

## 剪辑点

片长 30 s，取源曲 **11.0 s – 41.0 s**：

| 成片时间 | 源曲时间 | 画面 | 音乐 |
| --- | --- | --- | --- |
| 0–5 s | 11–16 s | 整体亮相 | 主句铺陈，随黑场淡入 |
| 5–11 s | 16–22 s | 360° 环绕 | 乐句呼吸，风声织体 |
| 11–16 s | 22–27 s | 低角度仰视 | 渐收，进入安静段 |
| 16–21 s | 27–32 s | 叶片微距 | 低回稀疏，留出叶脉细节 |
| 21–25 s | 32–36 s | 树干与枝条 | 缓慢展开 |
| 25–30 s | 36–41 s | 完整收尾 | 推至高点后自然衰减，接片尾题字 |

首尾：1.2 s 淡入，28.2 s 起 1.8 s 淡出，与片头黑场和片尾题字对齐。

## 母带

- 选段测量：−17.67 LUFS / −0.52 dBTP。
- 不做动态压缩；施加 **−1.48 dB 线性增益**，把真峰压到 −2 dBTP。
- 输出 48 kHz / 立体声 / PCM s16le。
- 封装后实测：**−19.1 LUFS / −2.1 dBTP**（AAC 192 kbps）。比 −18 LUFS 略保守，
  以保留古琴拨弦的动态和自然衰减。

```bash
# 1. 剪辑 + 淡入淡出 + 线性母带
npm run score:heygen
# 等价于：
# ffmpeg -y -ss 11.0 -t 30.0 -i .media/audio/bgm/bgm_001.wav \
#   -af "afade=t=in:st=0:d=1.2,afade=t=out:st=28.2:d=1.8,volume=-1.48dB,aresample=48000" \
#   -ac 2 -c:a pcm_s16le deliverables/yishu-liujin-heygen-score.wav

# 2. 封装 AAC 音轨（视频流复制，不重新编码）
npm run mux:score
# 等价于：
# ffmpeg -y -i deliverables/yishu-liujin-1080p60-silent.mp4 \
#   -i deliverables/yishu-liujin-heygen-score.wav \
#   -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
#   -shortest -movflags +faststart deliverables/yishu-liujin-1080p60.mp4
```

如果之后重新导出无声画面，请保留新的 `...-silent.mp4`，再运行一次
`npm run score:heygen && npm run mux:score`，不要直接覆盖配乐母带。
