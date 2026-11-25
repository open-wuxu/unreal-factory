#!/usr/bin/env node
/**
 * 从 HeyGen 曲库曲目中剪出 30 秒配乐并做线性母带。
 *
 * 源曲：.media/audio/bgm/bgm_001.wav
 *   HeyGen track id 89d7b95ce80f49ee9d1ecd27f23f5629
 *   （低回古琴与箫、风声织体，45 s）
 *
 * 用法：
 *   npm run score:heygen
 *   # 等价于
 *   node scripts/cut-score.mjs --start 11 --duration 30 --out deliverables/yishu-liujin-heygen-score.wav
 *
 * 选段 11.0–41.0 s：16–21 s 微距进入安静段，21–30 s 展开并在片尾自然衰减。
 * 采用 −1.48 dB 线性增益把真峰压到 −2 dBTP，不做动态压缩。
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

function readArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[name] = true;
    else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

const args = readArgs(process.argv.slice(2));
const source = path.resolve(args.source ?? ".media/audio/bgm/bgm_001.wav");
const out = path.resolve(args.out ?? "deliverables/yishu-liujin-heygen-score.wav");
const start = Number(args.start ?? 11.0);
const duration = Number(args.duration ?? 30.0);
const fadeIn = Number(args["fade-in"] ?? 1.2);
const fadeOut = Number(args["fade-out"] ?? 1.8);
const gain = String(args.gain ?? "-1.48dB");

if (!fs.existsSync(source)) {
  throw new Error(
    `no source audio at ${source}\n` +
      `先通过 HyperFrames 导入 HeyGen 曲目：\n` +
      `  npx hyperframes media-use resolve --type bgm --reuse 4f6a0f5965e48040 --project .`,
  );
}
fs.mkdirSync(path.dirname(out), { recursive: true });

const fadeOutStart = Math.max(0, duration - fadeOut);
const filter = [
  `afade=t=in:st=0:d=${fadeIn}`,
  `afade=t=out:st=${fadeOutStart}:d=${fadeOut}`,
  `volume=${gain}`,
  "aresample=48000",
].join(",");

const ffmpegArgs = [
  "-y",
  "-hide_banner",
  "-nostats",
  "-ss",
  String(start),
  "-t",
  String(duration),
  "-i",
  source,
  "-af",
  filter,
  "-ac",
  "2",
  "-c:a",
  "pcm_s16le",
  out,
];

console.log("ffmpeg", ffmpegArgs.join(" "));
const result = spawnSync("ffmpeg", ffmpegArgs, { stdio: "inherit" });
if (result.status !== 0) throw new Error(`ffmpeg exited with ${result.status}`);

const probe = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size",
    "-show_entries",
    "stream=codec_name,sample_rate,channels,bits_per_sample",
    "-of",
    "json",
    out,
  ],
  { encoding: "utf8" },
);
const info = JSON.parse(probe.stdout || "{}");
const actual = Number(info.format?.duration ?? 0);
if (Math.abs(actual - duration) > 0.01) {
  throw new Error(`unexpected score duration ${actual}s (wanted ${duration}s)`);
}
console.log(JSON.stringify(info, null, 2));
console.log(out, `${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MiB`);
