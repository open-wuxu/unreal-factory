# 成片配乐来源

成片 `deliverables/qingyun-seven-peaks-720p60.mp4` 的配乐使用 HeyGen 曲库曲目，
不随仓库分发音频文件；源曲以本地缓存形式保存于
`.media/audio/bgm/bgm_001.wav`（已被 `.gitignore` 忽略）。

| 字段 | 值 |
| --- | --- |
| provider | `heygen.audio.sounds` |
| track id | `4e3d63277b074f4ca246938d6322bea7` |
| 曲目描述 | epic Chinese fantasy, guzheng and erhu intro, taiko building, orchestral climax at 0:51, ends on one final note |
| 检索方式 | `npx hyperframes media-use resolve --type bgm --intent "..."`，按相关度取首条 |
| 授权方式 | HeyGen OAuth（`heygen` CLI 已登录账号） |
| 时长 / 格式 | 50 s / 44.1 kHz 立体声 PCM |

## 剪辑点

片长 36 s，取源曲 **9.56 s – 45.56 s**：

- 9.56 s 是乐句的干净起点（检出的强起音，前一拍有 0.4 s 留白），避免从乐句中间切入；
- 15.5 s 起太鼓与管弦进入并持续加强，在成片中约 6 s 后展开，对应镜二、镜三的推进；
- 42–45 s 是末音与自然衰减，落在片尾 1.5 s 画面淡出处，不需要硬切。

首尾淡入淡出：0.5 s 淡入，34.3 s 起 1.7 s 淡出，与片尾字幕淡出对齐。

## 母带与封装

```bash
# 1. 剪辑 + 淡入淡出 + 线性响度母带（先跑一遍 loudnorm 取测量值，此处已填入）
ffmpeg -y -ss 9.56 -t 36 -i .media/audio/bgm/bgm_001.wav \
  -af "afade=t=in:st=0:d=0.5,afade=t=out:st=34.3:d=1.7,loudnorm=I=-18:TP=-2:LRA=9:measured_I=-13.76:measured_TP=0.0:measured_LRA=9.60:measured_thresh=-24.57:offset=-0.22:linear=true,aresample=48000" \
  -ac 2 -c:a pcm_s16le deliverables/qingyun-heygen-score.wav

# 2. 封装 AAC 音轨（视频流复制，不重新编码）
npm run mux:score
# 等价于：
# ffmpeg -y -i deliverables/qingyun-seven-peaks-720p60-silent.mp4 \
#   -i deliverables/qingyun-heygen-score.wav \
#   -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
#   -shortest -movflags +faststart deliverables/qingyun-seven-peaks-720p60.mp4
```

实测成片响度 **−17.9 LUFS / 真峰 −1.9 dBTP**（目标 −18 LUFS / −2 dBTP），
源曲真峰为 0 dBFS，故采用线性增益而非动态 loudnorm，避免音乐被压缩起伏。

场景内的风声、云海低频、瀑布与钟声仍由 `src/audio.js` 与
`scripts/compose-score.py` 程序化生成；`npm run score` 可作为无外部音频时的回退方案。
