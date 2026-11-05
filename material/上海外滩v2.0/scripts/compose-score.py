#!/usr/bin/env python3
"""
《上海外滩》28 秒原创配乐。

不采样、不使用外部音乐素材：用 numpy / scipy 合成 pad、钟琴、低音、
脉冲与转场音效，卷积混响后输出 48 kHz 立体声 WAV。

Cue 与影片严格对齐：
  0.0    D 小调 drone 进入
  0.9    开场标题钟琴
  5.2    外滩切镜：低频脉冲 + Bb 和弦
  11.0   陆家嘴切镜：抬升
  12.2 / 12.62 / 13.04 / 13.46   四座地标数据依次亮起
  17.2–19.1  黄昏 → 夜景 riser
  19.1   夜景落点：F 大调 + 低频 impact
  22.0   外滩夜色切镜
  26.0   终曲 Fmaj9
  27.0–28.0  随画面淡出
"""

import numpy as np
from pathlib import Path
from scipy import signal
from scipy.io import wavfile
from scipy.signal import fftconvolve

SR = 48000
DURATION = 28.0
N = int(SR * DURATION)
RNG = np.random.default_rng(20261105)

MIX = np.zeros((N, 2), dtype=np.float64)

PITCH = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
         "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
         "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def hz(name):
    """科学音高记号 → 频率，A4 = 440 Hz。"""
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


def fade_edges(env, attack=0.01, release=0.03):
    env = np.array(env, dtype=np.float64, copy=True)
    n = len(env)
    a = max(1, int(attack * SR))
    r = max(1, int(release * SR))
    env[:a] *= np.linspace(0.0, 1.0, a)
    env[-r:] *= np.linspace(1.0, 0.0, r)
    return env


def pad(freq, start, duration, amp, pan=0.0, width=0.55,
        attack=1.2, release=1.4, brightness=1.0):
    """缓慢展开的合唱 pad；左右声道用轻微失谐制造宽度。"""
    n = int(duration * SR)
    if n <= 0:
        return
    tt = np.arange(n) / SR
    a = np.clip(tt / max(attack, 0.001), 0.0, 1.0)
    r = np.clip((duration - tt) / max(release, 0.001), 0.0, 1.0)
    env = np.minimum(a, r) ** 1.4
    lfo = 1.0 + 0.05 * np.sin(2 * np.pi * 0.075 * tt + RNG.uniform(0, 2 * np.pi))
    left = np.zeros(n)
    right = np.zeros(n)
    partials = [(1, 1.0), (2, 0.46), (3, 0.22), (4, 0.11), (5, 0.055)]
    for k, weight in partials:
        if k >= 3:
            weight *= brightness
        for side, detune in ((0, -0.0018), (1, 0.0018)):
            phase = RNG.uniform(0, 2 * np.pi)
            tone = np.sin(2 * np.pi * freq * k * (1 + detune) * tt + phase)
            if side == 0:
                left += weight * tone * (1.0 - width * 0.22)
            else:
                right += weight * tone * (1.0 + width * 0.22)
    angle = (pan + 1.0) * np.pi / 4.0
    gain = amp * env * lfo
    add_stereo(left * gain * np.cos(angle), right * gain * np.sin(angle), start)


def bell(freq, start, amp, pan=0.0, decay=2.2, bright=1.0):
    """钟琴 / 钢琴混合音色：非整数泛音，指数衰减。"""
    n = int(decay * 1.6 * SR)
    if n <= 0:
        return
    tt = np.arange(n) / SR
    attack = np.minimum(1.0, tt / 0.004)
    sig = np.zeros(n)
    partials = [(1.0, 1.0, 1.0), (2.01, 0.48, 0.62), (3.03, 0.23, 0.44),
                (4.07, 0.11, 0.32), (5.11, 0.05, 0.24)]
    for ratio, weight, decay_scale in partials:
        if ratio > 3:
            weight *= bright
        phase = RNG.uniform(0, 2 * np.pi)
        sig += weight * np.sin(2 * np.pi * freq * ratio * tt + phase) * \
            np.exp(-tt / (decay * decay_scale))
    sig *= attack * np.exp(-tt / (decay * 0.6)) * amp
    add_mono(sig, start, pan)


def soft_kick(start, amp=0.04, low=44.0):
    n = int(0.7 * SR)
    tt = np.arange(n) / SR
    freq = low + 55.0 * np.exp(-tt / 0.045)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    env = np.minimum(1.0, tt / 0.004) * np.exp(-tt / 0.18)
    body = np.sin(phase) * env
    click = RNG.normal(0, 1, n) * np.exp(-tt / 0.006) * 0.08
    add_mono((body + click) * amp, start, 0.0)


def air_layer(start, duration, amp, pan, low, high):
    n = int(duration * SR)
    if n <= 0:
        return
    noise = RNG.normal(0, 1, n)
    sos = signal.butter(2, [low / (SR / 2), high / (SR / 2)],
                        btype="band", output="sos")
    filtered = signal.sosfilt(sos, noise)
    tt = np.arange(n) / SR
    env = np.minimum(1.0, tt / 1.2) * np.minimum(1.0, (duration - tt) / 1.2)
    lfo = 0.55 + 0.45 * np.sin(2 * np.pi * 0.065 * tt + RNG.uniform(0, 6.28))
    add_mono(filtered * env * lfo * amp, start, pan)


def whoosh(start, duration, amp, pan_from, pan_to, low=280, high=3200):
    n = int(duration * SR)
    noise = RNG.normal(0, 1, n)
    sos = signal.butter(2, [low / (SR / 2), high / (SR / 2)],
                        btype="band", output="sos")
    filtered = signal.sosfilt(sos, noise)
    tt = np.arange(n) / SR
    x = tt / duration
    env = np.sin(np.pi * x) ** 2
    pan = pan_from + (pan_to - pan_from) * x
    gl = np.cos((pan + 1) * np.pi / 4)
    gr = np.sin((pan + 1) * np.pi / 4)
    add_stereo(filtered * env * amp * gl, filtered * env * amp * gr, start)


def riser(start, duration, amp):
    n = int(duration * SR)
    noise = RNG.normal(0, 1, n)
    sos = signal.butter(2, [250 / (SR / 2), 7000 / (SR / 2)],
                        btype="band", output="sos")
    filtered = signal.sosfilt(sos, noise)
    tt = np.arange(n) / SR
    x = np.clip(tt / duration, 0, 1)
    env = x ** 2.3 * np.minimum(1.0, (duration - tt) / 0.02)
    freq = 130.0 * (4.0 ** x)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    tone = 0.35 * np.sin(phase)
    sig = (filtered * 0.9 + tone) * env * amp
    pan = -0.25 + 0.5 * x
    gl = np.cos((pan + 1) * np.pi / 4)
    gr = np.sin((pan + 1) * np.pi / 4)
    add_stereo(sig * gl, sig * gr, start)


def impact(start, amp=0.09):
    n = int(1.6 * SR)
    tt = np.arange(n) / SR
    freq = 33 + 34 * np.exp(-tt / 0.07)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    env = np.minimum(1.0, tt / 0.004) * np.exp(-tt / 0.55)
    body = np.sin(phase) * env
    noise = RNG.normal(0, 1, n)
    noise = signal.sosfilt(signal.butter(2, 160 / (SR / 2),
                                         btype="lowpass", output="sos"), noise)
    thump = noise * np.exp(-tt / 0.12) * 0.35
    add_mono((body + thump) * amp, start, 0.0)


def tick(start, freq, amp, pan):
    bell(freq, start, amp, pan, decay=0.55, bright=1.4)


# ---------------------------------------------------------------------------
# 和声骨架（D 小调 → F 大调）
# ---------------------------------------------------------------------------

CHORDS = [
    (0.0, 5.2, ["D2", "A2", "D3", "F3", "A3", "E4"], 0.029),
    (5.2, 7.4, ["Bb1", "F2", "Bb2", "D3", "F3", "A3"], 0.026),
    (7.4, 9.4, ["G1", "D2", "G2", "Bb2", "D3", "F3"], 0.026),
    (9.4, 11.0, ["A1", "D2", "A2", "D3", "F3", "A3"], 0.028),
    (11.0, 13.0, ["Bb1", "F2", "Bb2", "D3", "F3", "A3"], 0.028),
    (13.0, 15.0, ["F1", "C2", "F2", "A2", "C3", "F3", "A3"], 0.026),
    (15.0, 17.2, ["C2", "G2", "C3", "E3", "G3", "Bb3", "C4"], 0.026),
    (17.2, 19.05, ["C2", "G2", "C3", "E3", "G3", "Bb3"], 0.027),
    (19.1, 22.0, ["F1", "C2", "F2", "A2", "C3", "E3", "A3", "C4"], 0.026),
    (22.0, 24.0, ["Bb1", "F2", "Bb2", "D3", "F3", "A3"], 0.027),
    (24.0, 26.0, ["A1", "E2", "A2", "C3", "F3", "A3", "C4"], 0.026),
    (26.0, 28.0, ["F1", "C2", "F2", "A2", "C3", "E3", "G3", "A3", "C4"], 0.024),
]

for start, end, notes, amp in CHORDS:
    for index, note in enumerate(notes):
        frequency = hz(note)
        low = frequency < 90
        pan = (-0.28, 0.28)[index % 2] if not low else 0.0
        pad(
            frequency,
            start - 0.12,
            (end - start) + 0.55,
            0.75 * amp * (0.62 if low else 1.0),
            pan=pan,
            width=0.12 if low else 0.62,
            attack=1.0 if start == 0 else 0.45,
            release=0.9,
            brightness=0.9,
        )

# 大提琴式的单声部线条
for start, note, duration, amp in [
    (1.0, "D3", 3.0, 0.020), (5.6, "F3", 2.4, 0.019),
    (8.2, "D3", 2.2, 0.018), (11.6, "F3", 2.4, 0.019),
    (14.2, "A3", 2.2, 0.018), (19.6, "A3", 2.6, 0.019),
    (23.0, "C4", 2.2, 0.018), (25.8, "F3", 2.2, 0.017),
]:
    pad(hz(note), start, duration, amp, pan=-0.18, width=0.3,
        attack=0.55, release=0.7, brightness=0.75)

# 钟琴主题：黄昏是 D 小调，夜景转到 F 大调
for start, note, amp, pan, decay in [
    (1.2, "D5", 0.060, -0.15, 2.6), (2.8, "A4", 0.050, 0.20, 2.3),
    (4.2, "F4", 0.045, -0.10, 2.6),
    (5.7, "D4", 0.050, -0.22, 2.1), (6.9, "F4", 0.045, 0.12, 2.3),
    (8.1, "A4", 0.045, -0.05, 2.3), (9.3, "C5", 0.040, 0.22, 2.1),
    (11.6, "F4", 0.050, -0.15, 2.3), (12.9, "A4", 0.045, 0.10, 2.4),
    (14.2, "C5", 0.040, -0.08, 2.6), (15.5, "E5", 0.038, 0.16, 2.1),
    (16.6, "G5", 0.034, -0.12, 2.0),
    (19.5, "F4", 0.055, -0.10, 3.1), (20.5, "A4", 0.050, 0.15, 2.9),
    (21.5, "C5", 0.044, -0.16, 3.1),
    (22.5, "F4", 0.050, -0.16, 2.9), (23.6, "A4", 0.045, 0.10, 2.9),
    (24.7, "C5", 0.040, -0.10, 3.1), (25.7, "E5", 0.035, 0.15, 2.9),
    (26.5, "F5", 0.030, -0.10, 3.2),
]:
    bell(hz(note), start, amp * 1.7, pan, decay=decay)

# 低频脉冲：外滩段与终曲段
for start in np.arange(5.2, 17.0, 1.2):
    soft_kick(float(start), amp=0.042)
for start in (22.0, 23.6, 25.2):
    soft_kick(start, amp=0.045, low=40.0)

# 数据条四行依次亮起（12.2 / 12.62 / 13.04 / 13.46）
for start, frequency, pan in [
    (12.20, 880.0, -0.32), (12.62, 1046.5, -0.12),
    (13.04, 1174.7, 0.10), (13.46, 1396.9, 0.28),
]:
    tick(start, frequency, 0.075, pan)

# 环境空气与水面
air_layer(0.0, 28.0, 0.008, -0.72, 220, 1300)
air_layer(0.0, 28.0, 0.007, 0.68, 180, 1100)
air_layer(0.0, 28.0, 0.005, 0.0, 55, 180)

# 切镜与转场
whoosh(4.85, 0.62, 0.035, -0.45, 0.45, 240, 2600)
whoosh(10.62, 0.56, 0.028, 0.35, -0.35, 260, 3000)
riser(17.2, 1.9, 0.045)
impact(19.1, amp=0.085)
whoosh(21.65, 0.62, 0.032, -0.3, 0.3, 200, 2200)
impact(22.0, amp=0.050)

# 主 EQ：去掉超低频与直流
sos = signal.butter(2, 30 / (SR / 2), btype="highpass", output="sos")
MIX = signal.sosfilt(sos, MIX, axis=0)

# 卷积混响：2.8 s 立体声 IR，左右去相关
IR_LEN = int(2.8 * SR)
ir_t = np.arange(IR_LEN) / SR
impulse = RNG.normal(0, 1, (IR_LEN, 2))
impulse *= np.exp(-ir_t / 0.85)[:, None]
for delay, gain in ((0.021, 0.55), (0.037, -0.38), (0.053, 0.28), (0.071, 0.16)):
    index = int(delay * SR)
    impulse[index, 0] += gain
    impulse[index + 37, 1] += gain * 0.9
ir_sos = signal.butter(2, 6200 / (SR / 2), btype="lowpass", output="sos")
impulse = signal.sosfilt(ir_sos, impulse, axis=0)
impulse /= np.max(np.abs(impulse)) * 1.7
wet = np.zeros_like(MIX)
wet[:, 0] = fftconvolve(MIX[:, 0], impulse[:, 0], mode="full")[:N]
wet[:, 1] = fftconvolve(MIX[:, 1], impulse[:, 1], mode="full")[:N]
MIX = MIX * 0.78 + wet * 0.30

# 动态弧线：开场留白，进入夜景时抬升，终曲收回
t = np.arange(N) / SR
ARC_T = np.array([0.0, 0.9, 5.2, 11.0, 17.2, 19.1, 22.0, 24.2, 26.0, 27.0, 28.0])
ARC_G = np.array([0.48, 0.58, 0.70, 0.82, 0.90, 1.00, 0.90, 0.82, 0.72, 0.55, 0.0])
MIX *= np.interp(t, ARC_T, ARC_G)[:, None]

# 轻微的胶合饱和与去直流
MIX = np.tanh(MIX * 1.05) / 1.05
MIX -= MIX.mean(axis=0, keepdims=True)

# 片头淡入、片尾淡出
fade_in = np.clip(t / 0.9, 0, 1) ** 1.5
fade_out = np.clip((28.0 - t) / 1.0, 0, 1) ** 1.4
MIX *= fade_in[:, None] * fade_out[:, None]

# 留 3 dB 余量，交给 ffmpeg loudnorm / limiter 统一响度
peak = float(np.max(np.abs(MIX)))
MIX *= 0.70 / max(peak, 1e-9)

out = Path("deliverables/shanghai-bund-v2-score-raw.wav")
out.parent.mkdir(parents=True, exist_ok=True)
wavfile.write(out, SR, MIX.astype(np.float32))
print(f"wrote {out}  peak={peak:.3f}  duration={N / SR:.3f}s")
