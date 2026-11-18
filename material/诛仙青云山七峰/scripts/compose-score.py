#!/usr/bin/env python3
"""
《诛仙 · 青云山七峰》36 秒程序化配乐。

全部声音由 numpy / scipy 合成，无外部采样：
- 箫 / 笛：正弦谐波 + 气声噪声 + 颤音
- 古琴：衰减泛音拨弦
- 云海铺底：低频失谐正弦与缓慢滤波器
- 瀑布：带通噪声（22–29 s）
- 编钟：非谐泛音衰减（34 s）
- 空间：合成脉冲响应卷积混响

用法：
    python3 scripts/compose-score.py
输出：
    deliverables/qingyun-score-raw.wav
"""

from __future__ import annotations

import os

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DURATION = 36.0
N = int(SR * DURATION)
rng = np.random.default_rng(20261118)

D2 = 73.42
A2 = 110.0
D3 = 146.83
D4 = 293.66
E4 = 329.63
FS4 = 369.99
A4 = 440.0
B4 = 493.88
D5 = 587.33
E5 = 659.25
FS5 = 739.99
A5 = 880.0


def envelope(n: int, attack: float, release: float, sustain: float = 1.0) -> np.ndarray:
    a = min(n, max(1, int(attack * SR)))
    r = min(n, max(1, int(release * SR)))
    env = np.ones(n)
    env[:a] = np.linspace(0.0, 1.0, a) ** 1.5
    env[-r:] *= np.linspace(1.0, 0.0, r) ** 1.2
    env *= sustain
    return env


def lowpass(data: np.ndarray, cutoff: float, order: int = 3) -> np.ndarray:
    sos = signal.butter(order, cutoff, btype="low", fs=SR, output="sos")
    return signal.sosfilt(sos, data)


def highpass(data: np.ndarray, cutoff: float, order: int = 3) -> np.ndarray:
    sos = signal.butter(order, cutoff, btype="high", fs=SR, output="sos")
    return signal.sosfilt(sos, data)


def bandpass(data: np.ndarray, low: float, high: float, order: int = 3) -> np.ndarray:
    sos = signal.butter(order, [low, high], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, data)


def add_stereo(buffer: np.ndarray, mono: np.ndarray, start: float, pan: float = 0.0, gain: float = 1.0) -> None:
    i = int(start * SR)
    n = min(len(mono), N - i)
    if n <= 0:
        return
    left = gain * (0.5 - pan * 0.5)
    right = gain * (0.5 + pan * 0.5)
    buffer[i : i + n, 0] += mono[:n] * left
    buffer[i : i + n, 1] += mono[:n] * right


def xiao(freq: float, duration: float, amp: float = 0.25, breath: float = 0.2) -> np.ndarray:
    n = int(duration * SR)
    t = np.arange(n) / SR
    vibrato = 1.0 + 0.004 * np.sin(2 * np.pi * 5.1 * t + rng.uniform(0, 6))
    phase = 2 * np.pi * freq * np.cumsum(vibrato) / SR

    tone = (
        np.sin(phase)
        + 0.28 * np.sin(phase * 2 + 0.1)
        + 0.13 * np.sin(phase * 3 + 0.3)
        + 0.06 * np.sin(phase * 4 + 0.6)
    )
    air = bandpass(rng.normal(0, 1, n), freq * 0.9, freq * 2.6)
    air = air / (np.max(np.abs(air)) + 1e-9) * breath
    body = tone * (1.0 - breath * 0.35) + air
    return body * envelope(n, 0.28, 0.7, amp)


def guqin(freq: float, duration: float, amp: float = 0.3) -> np.ndarray:
    n = int(duration * SR)
    t = np.arange(n) / SR
    body = np.zeros(n)
    for k in range(1, 9):
        detune = 1.0 + (k - 1) * 0.0007
        decay = 1.0 + k * 0.55
        body += (
            np.sin(2 * np.pi * freq * k * detune * t + k * 0.7)
            / (k ** 1.35)
            * np.exp(-t * decay)
        )
    pluck = highpass(rng.normal(0, 1, n), 1200) * np.exp(-t * 90) * 0.05
    return (body + pluck) * envelope(n, 0.006, 0.4, amp)


def pad(freqs: list[float], duration: float, amp: float = 0.12, cutoff: float = 900.0) -> np.ndarray:
    n = int(duration * SR)
    t = np.arange(n) / SR
    data = np.zeros(n)
    for freq in freqs:
        for detune in (-0.003, 0.0, 0.003):
            data += np.sin(2 * np.pi * freq * (1 + detune) * t + rng.uniform(0, 6)) / len(freqs) / 3
    data = lowpass(data, cutoff, 2)
    return data * envelope(n, 3.0, 3.0, amp)


def bell(freq: float, amp: float = 0.4) -> np.ndarray:
    duration = 5.0
    n = int(duration * SR)
    t = np.arange(n) / SR
    ratios = [1.0, 2.76, 5.4, 8.93, 13.34]
    decays = [1.6, 2.2, 3.1, 4.2, 5.2]
    data = np.zeros(n)
    for ratio, decay in zip(ratios, decays):
        data += np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t * decay) / len(ratios)
    return data * amp * envelope(n, 0.004, 0.2)


def drum(amp: float = 0.5, duration: float = 1.4) -> np.ndarray:
    n = int(duration * SR)
    t = np.arange(n) / SR
    pitch = 62 - 18 * np.minimum(1.0, t / 0.12)
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    body = np.sin(phase) * np.exp(-t * 3.2)
    skin = lowpass(rng.normal(0, 1, n), 320) * np.exp(-t * 10) * 0.35
    return (body + skin) * amp


def woodblock(amp: float = 0.25) -> np.ndarray:
    duration = 0.18
    n = int(duration * SR)
    t = np.arange(n) / SR
    data = (
        np.sin(2 * np.pi * 1150 * t) * np.exp(-t * 55)
        + 0.4 * np.sin(2 * np.pi * 1720 * t) * np.exp(-t * 75)
    )
    return data * amp


def noise_layer(duration: float, low: float, high: float, amp: float) -> np.ndarray:
    n = int(duration * SR)
    data = bandpass(rng.normal(0, 1, n), low, high)
    data = data / (np.max(np.abs(data)) + 1e-9)
    return data * amp


def reverb(buffer: np.ndarray, wet: float = 0.32) -> np.ndarray:
    length = int(2.8 * SR)
    t = np.arange(length) / SR
    impulse = rng.normal(0, 1, length) * np.exp(-t * 2.4)
    impulse = lowpass(impulse, 4200)
    impulse[: int(0.02 * SR)] *= np.linspace(0.0, 1.0, int(0.02 * SR))
    impulse /= np.max(np.abs(impulse))
    out = np.zeros_like(buffer)
    for channel in range(2):
        wet_signal = signal.fftconvolve(buffer[:, channel], impulse, mode="full")[:N]
        out[:, channel] = buffer[:, channel] * (1 - wet) + wet_signal * wet * 0.5
    return out


def main() -> None:
    mix = np.zeros((N, 2), dtype=np.float64)

    # 0–36 s：云海低频铺底，随段落缓慢升高。
    add_stereo(mix, pad([D2, A2], 36.0, 0.14, 380), 0.0)
    add_stereo(mix, pad([D3, FS4], 24.0, 0.08, 700), 10.0)
    add_stereo(mix, pad([D3, A4, D5], 14.0, 0.09, 1100), 22.0)

    # 风声：持续低噪，前 8 秒最明显。
    wind = noise_layer(36.0, 180, 900, 0.028)
    wind *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.06 * np.arange(N) / SR)
    add_stereo(mix, wind, 0.0)

    # 云海钟声：开场与片尾。
    add_stereo(mix, bell(D3 * 0.5, 0.28), 0.4, pan=-0.2)
    add_stereo(mix, bell(D3, 0.34), 33.8, pan=0.15)

    # 箫的主题：四句，逐段上扬。
    phrases = [
        [(D4, 2.2, 2.5), (FS4, 3.3, 1.7), (A4, 5.0, 2.6)],
        [(A4, 9.2, 1.6), (B4, 10.8, 1.9), (A4, 12.7, 1.6), (FS4, 14.2, 1.4)],
        [(D5, 16.4, 2.0), (B4, 18.4, 1.4), (A4, 19.8, 2.4)],
        [(FS5, 23.2, 1.8), (E5, 25.0, 1.5), (D5, 26.5, 2.6)],
        [(A4, 30.0, 2.2), (B4, 32.2, 1.8), (D5, 34.0, 2.4)],
    ]
    for pan, phrase in zip((-0.25, 0.1, -0.15, 0.25, 0.0), phrases):
        for freq, start, duration in phrase:
            add_stereo(mix, xiao(freq, duration, 0.22, 0.18), start, pan=pan)

    # 古琴：每段变换琶音。
    arpeggios = [
        (9.6, [D4, A4, FS5, D5], -0.3),
        (17.0, [A4, D5, FS5, A5], 0.3),
        (24.0, [D4, FS4, A4, D5], -0.1),
        (30.4, [FS4, A4, D5, FS5], 0.2),
    ]
    for start, notes, pan in arpeggios:
        for index, freq in enumerate(notes):
            add_stereo(mix, guqin(freq, 3.2, 0.32), start + index * 0.22, pan=pan, gain=0.8)

    # 段落转场的低鼓与木鱼。
    for start in (7.7, 14.7, 21.7, 28.7):
        add_stereo(mix, drum(0.34), start, pan=0.0)
    for start in (16.6, 18.2, 19.6, 20.9):
        add_stereo(mix, woodblock(0.12), start, pan=0.25)

    # 瀑布：22–29 s 的带通噪声。
    waterfall = noise_layer(7.0, 500, 2600, 0.16)
    waterfall *= np.concatenate(
        [
            np.linspace(0, 1, int(0.8 * SR)),
            np.ones(int(5.4 * SR)),
            np.linspace(1, 0, int(0.8 * SR)),
        ]
    )[: len(waterfall)]
    add_stereo(mix, waterfall, 22.0, pan=0.1)

    # 片尾渐强与收束。
    swell = pad([D3, A4, D4, FS4], 7.0, 0.12, 1400)
    swell *= np.linspace(0.4, 1.0, len(swell)) ** 1.4
    add_stereo(mix, swell, 29.0, gain=0.9)

    mix = reverb(mix, 0.34)
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    peak = np.max(np.abs(mix))
    if peak > 0:
        mix *= 0.85 / peak

    os.makedirs("deliverables", exist_ok=True)
    out = "deliverables/qingyun-score-raw.wav"
    wavfile.write(out, SR, (mix * 32767).astype(np.int16))
    print("wrote", out, f"{os.path.getsize(out) / 1024 / 1024:.1f} MiB")


if __name__ == "__main__":
    main()
