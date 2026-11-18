/**
 * 程序化声音。
 *
 * 不加载任何音频文件：水声与风声由过滤后的白噪声合成，乌鸦叫
 * 用滑音锯齿波，寺钟用一组非整数泛音 + 卷积混响合成。默认静音，
 * 必须由用户点击开启（浏览器自动播放策略）。
 */

const CROW_CUES = [4.3, 12.5, 34.1];
const BELL_CUE = 28.6;

function makeNoiseBuffer(ctx, seconds = 3) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 1.4;
    }
  }
  return buffer;
}

function makeImpulse(ctx, seconds = 3.2) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.exp(-t / 0.72);
      data[i] = (Math.random() * 2 - 1) * env * 0.45;
    }
    // 早期反射
    for (const [delay, gain] of [
      [0.019, 0.5],
      [0.034, -0.35],
      [0.051, 0.24],
    ]) {
      const index = Math.floor(delay * ctx.sampleRate);
      if (index < length) data[index] += gain;
    }
  }
  return buffer;
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let ambience = null;
  let convolver = null;
  let reverbSend = null;
  let enabled = false;
  let lastTime = 0;
  let lastBellCycle = -1;

  function ensureContext() {
    if (ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    ctx = new AudioContext();

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, 3.4);
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.36;
    reverbSend.connect(convolver);
    convolver.connect(master);

    ambience = ctx.createGain();
    ambience.gain.value = 0;
    ambience.connect(master);

    startAmbience();
  }

  function startAmbience() {
    const noise = makeNoiseBuffer(ctx, 4);

    // 江水：低沉的滤波噪声 + 很慢的呼吸
    const waterSource = ctx.createBufferSource();
    waterSource.buffer = noise;
    waterSource.loop = true;
    const waterFilter = ctx.createBiquadFilter();
    waterFilter.type = "lowpass";
    waterFilter.frequency.value = 620;
    waterFilter.Q.value = 0.5;
    const waterGain = ctx.createGain();
    waterGain.gain.value = 0.045;
    waterSource.connect(waterFilter).connect(waterGain).connect(ambience);
    waterSource.start();

    const waterLfo = ctx.createOscillator();
    waterLfo.frequency.value = 0.061;
    const waterLfoGain = ctx.createGain();
    waterLfoGain.gain.value = 0.018;
    waterLfo.connect(waterLfoGain).connect(waterGain.gain);
    waterLfo.start();

    // 风声：高中频的窄带噪声
    const windSource = ctx.createBufferSource();
    windSource.buffer = noise;
    windSource.loop = true;
    windSource.playbackRate.value = 0.83;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.72;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.02;
    windSource.connect(windFilter).connect(windGain).connect(ambience);
    windSource.start();

    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.043;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 0.012;
    windLfo.connect(windLfoGain).connect(windGain.gain);
    windLfo.start();

    // 水面细碎的拍岸声
    const lapSource = ctx.createBufferSource();
    lapSource.buffer = noise;
    lapSource.loop = true;
    lapSource.playbackRate.value = 0.5;
    const lapFilter = ctx.createBiquadFilter();
    lapFilter.type = "bandpass";
    lapFilter.frequency.value = 1350;
    lapFilter.Q.value = 0.9;
    const lapGain = ctx.createGain();
    lapGain.gain.value = 0.008;
    lapSource.connect(lapFilter).connect(lapGain).connect(ambience);
    lapSource.start();

    const lapLfo = ctx.createOscillator();
    lapLfo.frequency.value = 0.13;
    const lapLfoGain = ctx.createGain();
    lapLfoGain.gain.value = 0.006;
    lapLfo.connect(lapLfoGain).connect(lapGain.gain);
    lapLfo.start();
  }

  function strikeBell() {
    if (!ctx) return;
    const now = ctx.currentTime + 0.04;

    const bus = ctx.createGain();
    bus.gain.value = 0.55;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(2100, now);
    lowpass.frequency.exponentialRampToValueAtTime(760, now + 5.5);
    bus.connect(lowpass);
    lowpass.connect(master);
    lowpass.connect(reverbSend);

    // 低沉、略带非整数泛音的大钟
    const base = 88;
    const partials = [
      [1.0, 0.95, 8.0],
      [2.02, 0.5, 6.4],
      [2.98, 0.34, 5.2],
      [4.11, 0.2, 3.8],
      [5.43, 0.12, 2.8],
      [7.09, 0.07, 2.0],
    ];

    for (const [ratio, amp, decay] of partials) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = base * ratio;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(amp * 0.16, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(gain).connect(bus);
      osc.start(now);
      osc.stop(now + decay + 0.2);

      // 轻微的拍频，让钟声有金属的呼吸感
      const beating = ctx.createOscillator();
      beating.type = "sine";
      beating.frequency.value = base * ratio + 0.6;
      const beatGain = ctx.createGain();
      beatGain.gain.setValueAtTime(0.0001, now);
      beatGain.gain.exponentialRampToValueAtTime(amp * 0.05, now + 0.02);
      beatGain.gain.exponentialRampToValueAtTime(0.0001, now + decay * 0.7);
      beating.connect(beatGain).connect(bus);
      beating.start(now);
      beating.stop(now + decay);
    }

    // 撞击瞬间的木杵与金属噪声
    const length = Math.floor(ctx.sampleRate * 0.22);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.035));
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1100;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    source.connect(filter).connect(gain).connect(bus);
    source.start(now);
  }

  function crowCaw(delay = 0) {
    if (!ctx) return;
    const now = ctx.currentTime + 0.03 + delay;

    for (let i = 0; i < 2; i++) {
      const start = now + i * 0.19;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(720, start);
      osc.frequency.exponentialRampToValueAtTime(380, start + 0.16);
      osc.frequency.exponentialRampToValueAtTime(520, start + 0.28);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 980;
      filter.Q.value = 1.8;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.02, start + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);

      osc.connect(filter).connect(gain).connect(master);
      gain.connect(reverbSend);
      osc.start(start);
      osc.stop(start + 0.34);
    }
  }

  function enable() {
    ensureContext();
    if (!ctx) return false;
    ctx.resume();
    enabled = true;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.72, now + 1.2);
    ambience.gain.cancelScheduledValues(now);
    ambience.gain.setValueAtTime(ambience.gain.value, now);
    ambience.gain.linearRampToValueAtTime(0.9, now + 1.6);
    return true;
  }

  function disable() {
    if (!ctx) return false;
    enabled = false;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.0001, now + 0.8);
    return false;
  }

  function toggle(next) {
    const want = typeof next === "boolean" ? next : !enabled;
    return want ? enable() : disable();
  }

  function update(time) {
    if (!enabled || !ctx) {
      lastTime = time;
      return;
    }

    // 跳转 / 重播时不补触发，避免一次响一片
    if (time < lastTime - 0.05 || time > lastTime + 1.5) {
      lastTime = time;
      return;
    }

    const cycle = Math.floor(time / 40);
    for (const cue of CROW_CUES) {
      if (lastTime <= cue && time > cue) crowCaw();
    }
    if (lastTime <= BELL_CUE && time > BELL_CUE && lastBellCycle !== cycle) {
      lastBellCycle = cycle;
      strikeBell();
    }

    lastTime = time;
  }

  return {
    enable,
    disable,
    toggle,
    update,
    strikeBell,
    crowCaw,
    get enabled() {
      return enabled;
    },
  };
}
