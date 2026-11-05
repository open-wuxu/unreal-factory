#!/usr/bin/env python3
"""把配乐画成一张深色 cue sheet，供交付预览。"""

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib import font_manager
from scipy.io import wavfile

WAV = Path("deliverables/shanghai-bund-v2-score.wav")
OUT = Path("deliverables/previews/score-cue-sheet.png")

INK = "#070a10"
PAPER = "#f4efe6"
GOLD = "#e8c48a"
MUTED = "#9c9487"

sr, samples = wavfile.read(WAV)
audio = samples.astype(np.float64) / 2**31
mono = audio.mean(axis=1)
duration = len(mono) / sr

# 50 ms 包络，足够画出结构又不至于把 134 万点全画出来
bin_size = int(0.05 * sr)
bins = len(mono) // bin_size
env = mono[: bins * bin_size].reshape(bins, bin_size)
low = env.min(axis=1)
high = env.max(axis=1)
mid = (low + high) / 2
time = (np.arange(bins) + 0.5) * 0.05

serif_path = "/System/Library/Fonts/Supplemental/Didot.ttc"
try:
    serif = font_manager.FontProperties(fname=serif_path)
    serif.get_name()
except Exception:
    serif = None

fig, ax = plt.subplots(figsize=(12, 4.0), dpi=150)
fig.patch.set_facecolor(INK)
ax.set_facecolor(INK)

ax.fill_between(time, low, high, color=GOLD, linewidth=0, alpha=0.78)
ax.plot(time, mid, color=PAPER, linewidth=0.5, alpha=0.55)
ax.axhline(0, color=PAPER, linewidth=0.35, alpha=0.18)

# 主要剪辑点
for when in (5.2, 11.0, 17.2, 19.1, 22.0, 24.2, 27.0):
    ax.axvline(when, color=PAPER, linewidth=0.55, alpha=0.30, linestyle=(0, (2, 3)))

# 数据条四个 tick
for when in (12.2, 12.62, 13.04, 13.46):
    ax.axvline(when, color=GOLD, linewidth=0.4, alpha=0.38, linestyle=(0, (1, 4)))

for start, end, label in [
    (0.0, 5.2, "01 · U-BEND"),
    (5.2, 11.0, "02 · THE BUND"),
    (11.0, 22.0, "03 · LUJIAZUI"),
    (22.0, 28.0, "04 · NIGHT / FINALE"),
]:
    ax.text((start + end) / 2, 0.392, label, color=GOLD, fontsize=7.0,
            fontproperties=serif, ha="center", va="top", alpha=0.95)

ax.set_xlim(0, duration)
ax.set_ylim(-0.42, 0.42)
ax.set_xticks([0, 5.2, 11, 17.2, 19.1, 22, 24.2, 28])
ax.set_xticklabels(["0", "5.2", "11", "17.2", "19.1", "22", "24.2", "28 s"],
                   color=MUTED, fontsize=7)
ax.set_yticks([])
for spine in ax.spines.values():
    spine.set_visible(False)
ax.tick_params(axis="x", colors=MUTED, length=0, pad=6)
ax.grid(axis="x", color=PAPER, alpha=0.06, linewidth=0.5)

title_font = serif if serif else None
fig.text(0.035, 0.955, "SHANGHAI · THE BUND", color=PAPER, fontsize=12.5,
         fontproperties=title_font, va="top")
fig.text(0.035, 0.908, "ORIGINAL SCORE  /  PROCEDURAL SYNTHESIS", color=GOLD,
         fontsize=7.2, fontproperties=title_font, va="top", alpha=0.95)
fig.text(0.975, 0.955, "28.0 s  ·  48 kHz stereo", color=MUTED, fontsize=7.2,
         fontproperties=title_font, va="top", ha="right")
fig.text(0.975, 0.908, "-15.8 LUFS  ·  TP -7.1 dBFS", color=MUTED, fontsize=6.6,
         fontproperties=title_font, va="top", ha="right")

fig.subplots_adjust(left=0.035, right=0.975, top=0.86, bottom=0.14)
OUT.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(OUT, facecolor=INK, dpi=150)
print("wrote", OUT)
