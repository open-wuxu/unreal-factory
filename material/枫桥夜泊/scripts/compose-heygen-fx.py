#!/usr/bin/env python3
"""
《枫桥夜泊》HeyGen 配乐版 · 音效层（水风 / 鸦鸣 / 寺钟）。

HeyGen 曲库提供的 45 秒古琴/箫曲已包含风声与雨声织体，因此这里只渲染
原合成配乐中的“画内音”：江水与夜风铺底、三声乌鸦、两次寺钟。
输出的 FX 层与 HeyGen 音乐在 ffmpeg 中混合，再统一响度。

用法：
    python3 scripts/compose-heygen-fx.py
输出：
    deliverables/fengqiao-yebo-heygen-fx.wav
"""

from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.signal import fftconvolve

SR = 48000
DURATION = 40.0
N = int(SR * DURATION)
RNG = np.random.default_rng(20261110)

MIX = np.zeros((N, 2), dtype=np.float64)

PITCH = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
    "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
}


def hz(name):
    pitch = name[:-1]
    octave = int(name[-1])
    midi = 12 * (octave + 1) + PITCH[pitch]
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def add_stereo(left, right, start):
    index = int(round(start * SR))
    if index >= N:
        return
    if index < 0:
        left = left[-index:]
        right = right[-index:]
        index = 0
    length = min(len(left), N - index)
    if length <= 0:
        return
    MIX[index:index + length, 0] += left[:length]
    MIX[index:index + length, 1] += right[:length]


def add_mono(sig, start, pan=0.0):
    angle = (pan + 1.0) * np.pi / 4.0
    add_stereo(sig * np.cos(angle), sig * np.sin(angle), start)


def bandpass(data, low, high, order=2):
    sos = signal.butter(
        order,
        [low / (SR / 2), high / (SR / 2)],
        btype="band",
        output="sos",
    )
    return signal.sosfilt(sos, data)


def lowpass(data, cutoff, order=2):
    sos = signal.butter(order, cutoff / (SR / 2), btype="lowpass", output="sos")
    return signal.sosfilt(sos, data)


def temple_bell(start, amp=0.18, base=hz("D2"), length=11.0):
    """温暖、协和的寺钟；基频落在 D 上，避免与持续音打架。"""
    now = int(start * SR)
    if now >= N:
        return
    n = min(int(length * SR), N - now)
    tt = np.arange(n) / SR
    partials = [
        (1.0, 0.90, 10.0),
        (2.0, 0.36, 7.6),
        (3.01, 0.20, 5.8),
        (4.07, 0.10, 4.2),
        (5.43, 0.05, 3.0),
        (6.79, 0.025, 2.2),
    ]
    sig = np.zeros(n)
    for ratio, weight, decay in partials:
        phase = RNG.uniform(0, 2 * np.pi)
        sig += weight * np.sin(2 * np.pi * base * ratio * tt + phase) * \
            np.exp(-tt / decay)
    strike = bandpass(RNG.normal(0, 1, n), 500, 2800) * \
        np.exp(-tt / 0.022) * 0.05
    sig = (sig * 0.55 + strike) * np.minimum(1.0, tt / 0.004) * amp
    sig = lowpass(sig, 1800)
    right = np.roll(sig, 23) * 0.96
    add_stereo(sig, right, start)


def crow(start, amp=0.03, pan=0.0):
    n = int(0.34 * SR)
    if n <= 0:
        return
    tt = np.arange(n) / SR
    freq = 680 - 280 * np.clip(tt / 0.17, 0, 1) + 80 * np.clip(
        (tt - 0.17) / 0.12, 0, 1)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    tone = signal.sawtooth(phase)
    tone = bandpass(tone, 450, 1900)
    env = np.minimum(1.0, tt / 0.025) * np.exp(-tt / 0.11)
    env *= np.minimum(1.0, (0.34 - tt) / 0.09)
    add_mono(lowpass(tone * env, 2400) * amp, start, pan)


def air_layer(start, duration, amp, pan, low, high):
    n = int(duration * SR)
    if n <= 0:
        return
    filtered = bandpass(RNG.normal(0, 1, n), low, high)
    tt = np.arange(n) / SR
    env = np.minimum(1.0, tt / 3.0) * np.minimum(1.0, (duration - tt) / 3.0)
    lfo = 0.55 + 0.45 * np.sin(2 * np.pi * 0.055 * tt + RNG.uniform(0, 6.28))
    add_mono(filtered * env * lfo * amp, start, pan)


# ---------------------------------------------------------------------------
# 画内音时间线（与影片严格对齐）
# ---------------------------------------------------------------------------

# 江水与夜风：极轻的连续底噪，补足曲目低频以下的空气感
air_layer(0.0, 40.0, 0.0046, -0.7, 180, 900)
air_layer(0.0, 40.0, 0.0038, 0.66, 160, 850)
air_layer(0.0, 40.0, 0.0032, 0.0, 40, 150)

# 乌鸦掠过
crow(4.4, 0.028, -0.35)
crow(4.62, 0.022, -0.30)
crow(12.6, 0.026, 0.42)
crow(12.82, 0.020, 0.38)
crow(34.2, 0.024, -0.2)

# 寒山寺自雾中显现时的远钟
temple_bell(16.5, amp=0.030, base=hz("D2"), length=7.5)

# 28.6 s 撞钟：全片最高点
temple_bell(28.6, amp=0.20, base=hz("D2"), length=12.0)

# ---------------------------------------------------------------------------
# 混音：只保留温暖尾音，不做母带压缩（交给 ffmpeg 与音乐合并后统一处理）
# ---------------------------------------------------------------------------

MIX = signal.sosfilt(
    signal.butter(2, 32 / (SR / 2), btype="highpass", output="sos"), MIX, axis=0)

IR_LEN = int(3.0 * SR)
ir_t = np.arange(IR_LEN) / SR
impulse = RNG.normal(0, 1, (IR_LEN, 2))
impulse *= np.exp(-ir_t / 0.9)[:, None]
for delay, gain in ((0.019, 0.5), (0.037, -0.28), (0.061, 0.2), (0.083, 0.11)):
    index = int(delay * SR)
    impulse[index, 0] += gain
    impulse[index + 37, 1] += gain * 0.9
impulse = lowpass(impulse, 4200)
impulse /= np.max(np.abs(impulse)) * 1.8

wet = np.zeros_like(MIX)
wet[:, 0] = fftconvolve(MIX[:, 0], impulse[:, 0], mode="full")[:N]
wet[:, 1] = fftconvolve(MIX[:, 1], impulse[:, 1], mode="full")[:N]
MIX = MIX * 0.86 + wet * 0.22

t = np.arange(N) / SR
fade_in = np.clip(t / 1.0, 0, 1) ** 1.4
fade_out = np.clip((40.0 - t) / 1.6, 0, 1) ** 1.35
MIX *= fade_in[:, None] * fade_out[:, None]

peak = float(np.max(np.abs(MIX)))
MIX *= 0.70 / max(peak, 1e-9)

out = Path("deliverables/fengqiao-yebo-heygen-fx.wav")
out.parent.mkdir(parents=True, exist_ok=True)
wavfile.write(out, SR, MIX.astype(np.float32))
print(f"wrote {out}  peak={peak:.3f}  duration={N / SR:.3f}s")
