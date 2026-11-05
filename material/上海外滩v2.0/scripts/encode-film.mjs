#!/usr/bin/env node
/**
 * 将导出帧编码为 2K / 60fps H.264 MP4。
 *
 * 用法：
 *   node scripts/encode-film.mjs --frames deliverables/frames \
 *     --out deliverables/shanghai-bund-v2-2k60.mp4
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
    if (!next || next.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

const args = readArgs(process.argv.slice(2));
const framesDir = path.resolve(args.frames ?? "deliverables/frames");
const out = path.resolve(
  args.out ?? "deliverables/shanghai-bund-v2-2k60.mp4",
);
const fps = Number(args.fps ?? 60);
const crf = String(args.crf ?? 17);
const preset = args.preset ?? "medium";

const files = fs
  .readdirSync(framesDir)
  .filter((file) => /^f_\d{5}\.jpg$/.test(file))
  .sort();
if (!files.length) throw new Error(`no frames in ${framesDir}`);

const manifestPath = path.join(framesDir, "manifest.json");
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : {};
const frameCount = files.length;
const expected = Number(manifest.frames ?? frameCount);
if (frameCount !== expected) {
  console.warn(`warning: ${frameCount} frames on disk, manifest says ${expected}`);
}

fs.mkdirSync(path.dirname(out), { recursive: true });

const filter =
  "scale=in_range=full:out_range=tv:flags=lanczos,format=yuv420p";

const ffmpegArgs = [
  "-y",
  "-hide_banner",
  "-framerate",
  String(fps),
  "-start_number",
  "0",
  "-i",
  path.join(framesDir, "f_%05d.jpg"),
  "-frames:v",
  String(frameCount),
  "-vf",
  filter,
  "-c:v",
  "libx264",
  "-preset",
  preset,
  "-crf",
  crf,
  "-profile:v",
  "high",
  "-level:v",
  "5.1",
  "-pix_fmt",
  "yuv420p",
  // x264 的 VUI 需要显式写入，否则部分播放器会把 bt709 标记读成 unknown。
  "-bsf:v",
  "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0",
  "-colorspace",
  "bt709",
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
  "-color_range",
  "tv",
  "-movflags",
  "+faststart",
  "-r",
  String(fps),
  out,
];

console.log("ffmpeg", ffmpegArgs.join(" "));
const result = spawnSync("ffmpeg", ffmpegArgs, { stdio: "inherit" });
if (result.status !== 0) {
  throw new Error(`ffmpeg exited with ${result.status}`);
}

const probe = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name,profile,width,height,r_frame_rate,avg_frame_rate,nb_frames,pix_fmt,color_space,color_transfer,color_primaries,color_range,bit_rate",
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
