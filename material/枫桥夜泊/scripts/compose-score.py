#!/usr/bin/env python3
"""
《枫桥夜泊》40 秒配乐 · 第五版「夜泊琵琶」。

D 商五声音阶（D E G A C）。以琵琶文曲的写法重新谱曲：
轮指、扫弦、推拉音、泛音，配以箫的应答、寺钟与水风鸦鸣。
不使用功能和声、不使用持续 pad、不使用任何外部采样。

乐器：
  琵琶    Karplus-Strong 弦模型；短促的木质起音、推拉音、轮指、扫弦、泛音
  箫      气声正弦，慢起慢收，带滑音与颤音
  寺钟    以 D 为基频的协和钟声，长衰减、低通
  水声 / 风声 / 鸦鸣

Cue 与影片严格对齐：
  0.0   水声、风声铺底
  0.8   琵琶空弦 A2 / D3 进入
  2.2   琵琶主题：D4 E4 G4 A4（推拉）G4 D4
  4.4   第一声乌鸦
  7.0   扫弦转入江枫渔火段落，琵琶琶音与轮指
  8.6   箫声进入，与琵琶一唱一和
 12.6   第二声乌鸦
 16.0   扫弦转入寒山寺段落，琵琶成为主旋律
 17.2   琵琶长句，推拉音与泛音
 26.0   轮指与低音推进，缓慢走向钟楼
 28.6   撞钟（全曲最高点，但音色温暖）
 30.0   钟声余韵与留白
 34.2   第三声乌鸦
 35.0   黑场：琵琶重述开篇动机
 38.5–40.0  随画面淡出
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


def env_ad(n, attack, release, curve=1.2):
    tt = np.arange(n) / SR
    duration = n / SR
    a = np.clip(tt / max(attack, 0.001), 0.0, 1.0)
    r = np.clip((duration - tt) / max(release, 0.001), 0.0, 1.0)
    return np.minimum(a, r) ** curve


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


# ---------------------------------------------------------------------------
# 琵琶：Karplus-Strong + 推拉音
# ---------------------------------------------------------------------------

def ks_string(freq, duration, brightness=0.6, damping=0.996, body=0.03,
              tone=5200, seed=0):
    """生成一根拨弦的原始波形，返回归一化后的数组。"""
    n = int(duration * SR)
    if n <= 8:
        return np.zeros(0)
    period = max(3, int(round(SR / freq)))
    rng = np.random.default_rng(seed)

    exc = rng.normal(0.0, 1.0, period)
    alpha = float(np.clip(1.0 - brightness, 0.04, 0.96))
    exc = signal.lfilter([1.0 - alpha], [1.0, -alpha], exc)
    # 触弦噪声在第一个周期内收住，保留颗粒，不拖出尖细的刮擦
    exc *= np.exp(-np.arange(period) / max(period * 0.28, 10.0))
    exc[0] += 0.12 * rng.normal()

    y = np.zeros(n)
    y[:period] = exc
    d = damping
    for s in range(period, n, period):
        e = min(s + period, n)
        left = y[s - period:e - period]
        if s - period - 1 < 0:
            right = np.concatenate(([0.0], y[0:e - period - 1]))
        else:
            right = y[s - period - 1:e - period - 1]
        y[s:e] = d * 0.5 * (left + right)

    # 整数延迟带来的音高偏差用重采样修正
    actual = SR / period
    if abs(actual - freq) / freq > 0.0008:
        m = int(n * actual / freq)
        m = max(8, min(m, n * 2))
        idx = np.linspace(0, n - 1, m)
        y = np.interp(idx, np.arange(n), y)
        if len(y) < n:
            y = np.pad(y, (0, n - len(y)))
        else:
            y = y[:n]

    if tone < SR / 2:
        y = lowpass(y, tone)

    if body > 0.0:
        tt = np.arange(n) / SR
        ring = np.sin(2 * np.pi * freq * tt + rng.uniform(0, 2 * np.pi))
        y += body * ring * np.exp(-tt / max(duration * 0.4, 0.3))

    peak = float(np.max(np.abs(y)))
    if peak <= 1e-9:
        return np.zeros(0)
    y = y / peak

    attack = min(int(0.005 * SR), n // 4)
    if attack > 4:
        y[:attack] *= np.linspace(0.0, 1.0, attack) ** 0.7

    release = min(int(0.18 * SR), n // 3)
    if release > 4:
        y[-release:] *= np.linspace(1.0, 0.0, release) ** 1.4
    return y


def pipa(note, start, amp, pan=0.0, duration=2.4, bend=0.0,
         brightness=0.6, damping=0.996, tone=5200, body=0.03):
    """琵琶单音。

    bend 为推拉音的半音数：先保持，再推高，最后回到原音高。
    """
    freq = hz(note)
    y = ks_string(freq, duration, brightness=brightness, damping=damping,
                  body=body, tone=tone,
                  seed=int(start * 1000) + int(freq))
    n = len(y)
    if n == 0:
        return

    if abs(bend) > 1e-6:
        tt = np.arange(n) / SR
        x = tt / duration
        # 0–12% 保持，12–34% 推上去，34–54% 保持，54–86% 回来
        shape = np.clip((x - 0.12) / 0.22, 0.0, 1.0) * \
            np.clip((0.86 - x) / 0.32, 0.0, 1.0)
        ratio = 2.0 ** (bend * shape / 12.0)
        pos = np.cumsum(ratio)
        valid = pos < n - 1
        warped = np.interp(pos[valid], np.arange(n), y)
        y = np.pad(warped, (0, max(0, n - len(warped))))

    add_mono(y * amp, start, pan)


def pipa_tremolo(note, start, duration, amp, amp_end=None, pan=0.0,
                 speed=11.0):
    """轮指：快速而均匀的反复拨弦，是琵琶文曲的长音。"""
    freq = hz(note)
    t = start
    i = 0
    total = max(duration, 1e-6)
    while t < start + duration:
        x = (t - start) / total
        target = amp if amp_end is None else amp + (amp_end - amp) * x
        level = target * (0.82 + 0.18 * RNG.random())
        detune = 1.0 + RNG.normal(0.0, 0.0008)
        pipa_raw = ks_string(freq * detune, 0.42, brightness=0.62,
                             damping=0.9958, body=0.02, tone=5200,
                             seed=70000 + int(t * 1000) + i)
        add_mono(pipa_raw * level, t, pan)
        t += (1.0 / speed) * (0.94 + 0.12 * RNG.random())
        i += 1


def pipa_strum(start, notes, amp=0.014, pan=0.0, step=0.022, up=False):
    """扫弦：几根弦依次扫过，声音仍然克制。"""
    sequence = list(reversed(notes)) if up else notes
    for i, note in enumerate(sequence):
        level = amp * (1.0 - 0.1 * i)
        pipa(note, start + i * step, level, pan, duration=2.0,
             brightness=0.64, damping=0.9958, tone=5200)


def pipa_run(start, notes, step=0.045, amp=0.014, pan_from=0.0, pan_to=0.0):
    count = max(len(notes) - 1, 1)
    for i, note in enumerate(notes):
        x = i / count
        pan = pan_from + (pan_to - pan_from) * x
        level = amp * (0.55 + 0.45 * np.sin(np.pi * x) ** 0.6)
        pipa(note, start + i * step, level, pan, duration=1.5,
             brightness=0.66, damping=0.996, tone=5400)


def pipa_harmonic(note, start, amp, pan=0.0, duration=3.0):
    """琵琶泛音：清亮、悠长，但不过分尖利。"""
    freq = hz(note)
    n = int(duration * SR)
    tt = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * tt) + \
        0.1 * np.sin(2 * np.pi * freq * 2 * tt) * np.exp(-tt / 0.5)
    sig *= np.exp(-tt / (duration * 0.48)) * np.minimum(1.0, tt / 0.006)
    sig = lowpass(sig, 5200)
    peak = float(np.max(np.abs(sig)))
    if peak > 1e-9:
        sig = sig / peak
    add_mono(sig * amp, start, pan)


# ---------------------------------------------------------------------------
# 箫
# ---------------------------------------------------------------------------

def xiao(freq, start, duration, amp, pan=0.0, slide_from=None, breath=1.0):
    n = int(duration * SR)
    if n <= 0:
        return
    tt = np.arange(n) / SR
    env = env_ad(n, 0.3, 0.5, 1.1)

    if slide_from is not None:
        f = freq + (slide_from - freq) * np.exp(-tt / 0.12)
    else:
        f = np.full(n, freq)

    phase0 = RNG.uniform(0, 2 * np.pi)
    vib = 1.0 + 0.0055 * np.sin(2 * np.pi * 4.4 * tt + phase0) * \
        np.clip((tt - 0.3) / 0.6, 0.0, 1.0)
    phase = 2 * np.pi * np.cumsum(f * vib) / SR

    tone = np.sin(phase) + 0.10 * np.sin(2 * phase) + 0.02 * np.sin(3 * phase)
    air = bandpass(RNG.normal(0, 1, n), 700, 2600) * 0.07 * breath
    chiff = bandpass(RNG.normal(0, 1, n), 900, 3000) * \
        np.exp(-tt / 0.055) * 0.06
    sig = lowpass(tone * 0.86 + air + chiff, 5000) * env * amp
    add_mono(sig, start, pan)


# ---------------------------------------------------------------------------
# 环境与钟声
# ---------------------------------------------------------------------------

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
# 配器
# ---------------------------------------------------------------------------
#
# D 商五声：D E G A C。琵琶的空弦 A2、D3、E3、A3 全部落在调内。

# 环境铺底：江水与夜风
air_layer(0.0, 40.0, 0.0046, -0.7, 180, 900)
air_layer(0.0, 40.0, 0.0038, 0.66, 160, 850)
air_layer(0.0, 40.0, 0.0032, 0.0, 40, 150)

# ---- 0–7 s 月落乌啼霜满天：琵琶散板 ----
pipa("A2", 0.8, 0.030, -0.04, duration=4.8, brightness=0.5,
     damping=0.9972, tone=4200)
pipa("D3", 1.2, 0.026, 0.06, duration=4.2, brightness=0.52,
     damping=0.9970, tone=4400)
pipa("A3", 1.6, 0.017, -0.02, duration=3.4)

# 主题：D4 E4 G4 A4（推拉）G4 D4
for start, note, amp, pan, bend, duration in [
    (2.2, "D4", 0.026, -0.08, 0.0, 2.8),
    (3.0, "E4", 0.024, 0.06, 0.0, 2.6),
    (3.9, "G4", 0.022, -0.10, 0.0, 2.4),
    (5.0, "A4", 0.021, 0.08, 1.0, 2.8),
    (5.9, "G4", 0.019, -0.03, 0.6, 2.4),
    (6.6, "D4", 0.018, 0.04, 0.0, 2.2),
]:
    pipa(note, start, amp, pan, duration=duration, bend=bend)

pipa_harmonic("D5", 4.2, 0.007, 0.12, duration=2.8)
crow(4.4, 0.028, -0.35)
crow(4.62, 0.022, -0.30)

# ---- 7–16 s 江枫渔火对愁眠：琵琶琶音、轮指与箫 ----
pipa_strum(7.0, ["D3", "A3", "D4"], amp=0.016, pan=-0.06)

for start, notes, pan in [
    (7.9, ["D3", "A3", "D4"], -0.16),
    (8.9, ["C4", "A3", "G3"], 0.15),
    (9.9, ["D3", "G3", "A3"], -0.10),
    (10.9, ["E4", "D4", "A3"], 0.12),
    (13.3, ["G3", "A3", "C4"], -0.12),
    (14.5, ["D3", "E3", "G3"], 0.10),
    (15.5, ["A3", "D4"], -0.04),
]:
    for i, note in enumerate(notes):
        pipa(note, start + i * 0.16, 0.017, pan, duration=2.2)

pipa_tremolo("A3", 11.4, 1.5, 0.009, amp_end=0.013, pan=0.04, speed=11.0)

# 箫：柔和的主旋律，与琵琶错开呼吸
for start, note, duration, amp, pan, slide in [
    (8.6, "A3", 2.2, 0.023, -0.08, "G3"),
    (10.6, "C4", 1.8, 0.022, 0.09, "A3"),
    (12.0, "D4", 2.2, 0.021, -0.05, "C4"),
    (13.9, "E4", 1.9, 0.020, 0.07, "D4"),
    (15.5, "D4", 1.7, 0.018, -0.03, "E4"),
]:
    xiao(hz(note), start, duration, amp, pan,
         slide_from=hz(slide) if slide else None)

crow(12.6, 0.026, 0.42)
crow(12.82, 0.020, 0.38)

# ---- 16–26 s 姑苏城外寒山寺：琵琶长句 ----
pipa_strum(16.0, ["D3", "A3", "D4", "E4"], amp=0.017, pan=-0.04)
pipa("A2", 16.0, 0.026, 0.0, duration=7.6, brightness=0.5,
     damping=0.9975, tone=4000)
pipa("D3", 16.2, 0.021, 0.02, duration=7.0, brightness=0.52,
     damping=0.9972, tone=4200)

temple_bell(16.5, amp=0.030, base=hz("D2"), length=7.5)

# 琵琶主句：D E G（推拉）A G E
for start, note, duration, amp, pan, bend in [
    (17.2, "D4", 2.2, 0.024, -0.08, 0.0),
    (19.0, "E4", 2.0, 0.023, -0.04, 0.0),
    (20.6, "G4", 2.0, 0.022, 0.05, 2.0),
    (22.4, "A4", 2.2, 0.021, -0.02, 0.0),
    (24.4, "G4", 1.2, 0.019, -0.05, 0.0),
    (25.2, "E4", 1.4, 0.018, 0.03, 0.0),
]:
    pipa(note, start, amp, pan, duration=duration, bend=bend)

# 箫在句尾应答，音量更轻
for start, note, duration, amp, pan in [
    (18.4, "A3", 1.2, 0.018, 0.10),
    (20.0, "C4", 1.2, 0.017, -0.08),
    (22.0, "D4", 1.4, 0.016, 0.08),
    (24.0, "E4", 1.2, 0.015, -0.06),
    (25.8, "D4", 1.2, 0.014, 0.04),
]:
    xiao(hz(note), start, duration, amp, pan, slide_from=hz(note) * 0.94)

pipa_harmonic("D5", 18.8, 0.006, 0.16, duration=2.8)
pipa_harmonic("A4", 22.0, 0.005, -0.14, duration=2.8)
pipa_strum(20.8, ["D3", "G3", "A3"], amp=0.011, pan=0.08)
pipa_strum(24.8, ["D3", "A3", "D4"], amp=0.011, pan=-0.08)

# ---- 26–35 s 夜半钟声到客船 ----
pipa_tremolo("A4", 26.0, 2.4, 0.010, amp_end=0.020,
             pan=-0.06, speed=11.5)
for start, note, amp in [
    (26.0, "D3", 0.018),
    (26.9, "A2", 0.016),
    (27.7, "D3", 0.014),
]:
    pipa(note, start, amp, 0.0, duration=3.2, brightness=0.52,
         damping=0.9972, tone=4200)

xiao(hz("D4"), 26.2, 2.4, 0.023, 0.02, slide_from=hz("A3"))
xiao(hz("E4"), 27.8, 0.9, 0.015, 0.04, slide_from=hz("D4"))
pipa_run(28.2, ["D4", "E4", "G4", "A4", "C5", "D5"], step=0.045,
         amp=0.015, pan_from=-0.16, pan_to=0.16)

temple_bell(28.6, amp=0.20, base=hz("D2"), length=12.0)

# 钟声之后的留白
pipa_harmonic("D5", 30.4, 0.008, 0.10, duration=4.0)
pipa_harmonic("A4", 31.4, 0.006, -0.12, duration=3.8)
pipa("D4", 31.8, 0.008, 0.06, duration=2.6, bend=1.0)

xiao(hz("A3"), 32.7, 1.6, 0.016, -0.06, slide_from=hz("G3"))

crow(34.2, 0.024, -0.2)

# ---- 35–40 s 回到客船：琵琶重述 ----
pipa_strum(35.0, ["D3", "A3", "D4"], amp=0.012, pan=0.05, up=True)
pipa("A2", 35.0, 0.022, 0.0, duration=4.6, brightness=0.5,
     damping=0.9972, tone=4000)

for start, note, amp, pan, bend in [
    (35.3, "D3", 0.018, -0.05, 0.0),
    (36.1, "E3", 0.017, 0.05, 0.0),
    (37.0, "G3", 0.016, -0.04, 0.0),
    (37.9, "A3", 0.015, 0.04, 0.6),
    (38.8, "D3", 0.013, 0.0, 0.0),
]:
    pipa(note, start, amp, pan, duration=2.8, bend=bend)

pipa_harmonic("D5", 39.1, 0.006, 0.0, duration=2.2)

# ---------------------------------------------------------------------------
# 混音
# ---------------------------------------------------------------------------

MIX = signal.sosfilt(
    signal.butter(2, 32 / (SR / 2), btype="highpass", output="sos"), MIX, axis=0)


def spectrum_eq(data, points):
    """零相位频域均衡：points 为 (频率, dB) 折线。"""
    n = data.shape[0]
    freqs = np.fft.rfftfreq(n, 1.0 / SR)
    gains = np.interp(
        np.log10(np.maximum(freqs, 1.0)),
        np.log10(np.array([p[0] for p in points])),
        np.array([p[1] for p in points]),
    )
    spec = np.fft.rfft(data, axis=0)
    spec *= (10.0 ** (gains / 20.0))[:, None]
    return np.fft.irfft(spec, n=n, axis=0)


# 温暖、柔和的母带：收掉次低频与尖锐的高频，中频只轻轻抬起
MIX = spectrum_eq(MIX, [
    (24, -20.0), (40, -10.0), (60, -3.0), (100, -0.5), (200, 0.0),
    (500, 0.3), (1200, 0.9), (2500, 1.1), (5000, 0.2), (8000, -1.8),
    (12000, -3.5), (20000, -12.0),
])

# 卷积混响：3.0 s，偏暖的尾音
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

# 动态弧线：始终柔和，撞钟处只做轻微抬起
t = np.arange(N) / SR
ARC_T = np.array([0.0, 1.0, 7.0, 16.0, 26.0, 28.6, 30.0, 34.0,
                  36.0, 39.0, 40.0])
ARC_G = np.array([0.46, 0.52, 0.62, 0.70, 0.82, 0.95, 0.70, 0.62,
                  0.58, 0.48, 0.0])
MIX *= np.interp(t, ARC_T, ARC_G)[:, None]

MIX = np.tanh(MIX * 1.01) / 1.01
MIX -= MIX.mean(axis=0, keepdims=True)

fade_in = np.clip(t / 1.0, 0, 1) ** 1.4
fade_out = np.clip((40.0 - t) / 1.6, 0, 1) ** 1.35
MIX *= fade_in[:, None] * fade_out[:, None]

peak = float(np.max(np.abs(MIX)))
MIX *= 0.70 / max(peak, 1e-9)

out = Path("deliverables/fengqiao-yebo-score-raw.wav")
out.parent.mkdir(parents=True, exist_ok=True)
wavfile.write(out, SR, MIX.astype(np.float32))
print(f"wrote {out}  peak={peak:.3f}  duration={N / SR:.3f}s")
