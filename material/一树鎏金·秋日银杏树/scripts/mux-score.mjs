#!/usr/bin/env node
/**
 * 将配乐封装进无声成片（视频流直接复制，不重新编码）。
 *
 * 用法：
 *   npm run mux:score
 *   # 等价于
 *   node scripts/mux-score.mjs \
 *     --video deliverables/yishu-liujin-1080p60-silent.mp4 \
 *     --audio deliverables/yishu-liujin-heygen-score.wav \
 *     --out deliverables/yishu-liujin-1080p60.mp4
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
const video = path.resolve(
  args.video ?? "deliverables/yishu-liujin-1080p60-silent.mp4",
);
const audio = path.resolve(
  args.audio ?? "deliverables/yishu-liujin-heygen-score.wav",
);
const out = path.resolve(
  args.out ?? "deliverables/yishu-liujin-1080p60.mp4",
);

if (!fs.existsSync(video)) throw new Error(`no video at ${video}`);
if (!fs.existsSync(audio)) throw new Error(`no audio at ${audio}`);
if (path.resolve(video) === path.resolve(out)) {
  throw new Error("--video and --out must differ; keep the silent cut as the mux source");
}
fs.mkdirSync(path.dirname(out), { recursive: true });

const ffmpegArgs = [
  "-y",
  "-hide_banner",
  "-nostats",
  "-i",
  video,
  "-i",
  audio,
  "-map",
  "0:v:0",
  "-map",
  "1:a:0",
  "-c:v",
  "copy",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-ar",
  "48000",
  "-ac",
  "2",
  "-shortest",
  "-movflags",
  "+faststart",
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
    "stream=index,codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels,bit_rate,start_time,duration",
    "-show_entries",
    "format=duration,size,bit_rate",
    "-of",
    "json",
    out,
  ],
  { encoding: "utf8" },
);
console.log(probe.stdout ?? "");
console.log(out, `${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MiB`);
