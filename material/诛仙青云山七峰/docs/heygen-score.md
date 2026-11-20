# 成片配乐来源

成片 `deliverables/qingyun-seven-peaks-2k60.mp4` 的配乐使用 HeyGen 曲库曲目，
不随仓库分发音频文件；源曲以本地缓存形式保存于 `.media/audio/bgm/heygen-bgm-001.wav`。

| 字段 | 值 |
| --- | --- |
| provider | `heygen.audio.sounds` |
| track id | `89d7b95ce80f49ee9d1ecd27f23f5629` |
| 原始查询 | traditional Chinese guqin and guzheng, melancholic night, moonlit river, temple bell, sparse cinematic underscore, slow, 40 seconds |
| 授权方式 | HeyGen OAuth（与《枫桥夜泊》共用已下载曲目） |
| 时长 / 格式 | 45 s / 44.1 kHz 立体声 PCM |
| 本地复用路径 | `material/枫桥夜泊/.media/audio/bgm/bgm_001.wav` |

## 母带与封装

```bash
# 裁到 36 s，加入淡入淡出，响度母带
ffmpeg -y -i .media/audio/bgm/heygen-bgm-001.wav -t 36 \
  -af "afade=t=in:st=0:d=0.6,afade=t=out:st=34.4:d=1.6,loudnorm=I=-18:TP=-2:LRA=9" \
  -ar 48000 -ac 2 deliverables/qingyun-heygen-score.wav

# 封装 AAC 音轨（视频流复制）
ffmpeg -y -i deliverables/qingyun-seven-peaks-2k60-silent.mp4 \
  -i deliverables/qingyun-heygen-score.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -shortest -movflags +faststart deliverables/qingyun-seven-peaks-2k60.mp4
```

实测成片响度 −18.8 LUFS / 真峰 −2.0 dBTP；低于 −18 目标 0.8 dB，
原因是源曲真峰较高、在 TP ≤ −2 约束下无法继续提升。

场景内的风声、云海低频、瀑布与钟声仍由 `src/audio.js` 与
`scripts/compose-score.py` 程序化生成；`npm run score` 可作为无外部音频时的回退方案。
