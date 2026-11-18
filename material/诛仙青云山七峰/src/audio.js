/**
 * 程序化环境声：风、云海低频、瀑布与远处编钟。
 * 默认关闭；首次开启时创建 AudioContext（浏览器自动播放策略）。
 */

const FILM_WATERFALL_START = 22;
const FILM_WATERFALL_END = 29;
const BELL_TIME = 34;

function createNoiseBuffer(context, seconds = 2) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  let seed = 0x51ed;
  for (let i = 0; i < length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const white = (seed / 4294967296) * 2 - 1;
    last = last * 0.94 + white * 0.06;
    data[i] = last * 3.2;
  }
  return buffer;
}

export function createAudio() {
  let context = null;
  let master = null;
  let windGain = null;
  let windFilter = null;
  let waterfallGain = null;
  let enabled = false;
  let lastBellCycle = -1;

  function ensureContext() {
    if (context) return context;
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const noise = createNoiseBuffer(context, 2.4);

    const windSource = context.createBufferSource();
    windSource.buffer = noise;
    windSource.loop = true;
    windFilter = context.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 520;
    windGain = context.createGain();
    windGain.gain.value = 0.24;
    windSource.connect(windFilter).connect(windGain).connect(master);
    windSource.start();

    const rumble = context.createBufferSource();
    rumble.buffer = noise;
    rumble.loop = true;
    const rumbleFilter = context.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.value = 90;
    const rumbleGain = context.createGain();
    rumbleGain.gain.value = 0.35;
    rumble.connect(rumbleFilter).connect(rumbleGain).connect(master);
    rumble.start();

    const waterSource = context.createBufferSource();
    waterSource.buffer = noise;
    waterSource.loop = true;
    const waterFilter = context.createBiquadFilter();
    waterFilter.type = "bandpass";
    waterFilter.frequency.value = 1300;
    waterFilter.Q.value = 0.7;
    waterfallGain = context.createGain();
    waterfallGain.gain.value = 0;
    waterSource.connect(waterFilter).connect(waterfallGain).connect(master);
    waterSource.start();

    return context;
  }

  function ringBell() {
    if (!context) return;
    const now = context.currentTime;
    const partials = [
      [196, 0.5, 5.5],
      [392, 0.22, 4],
      [588, 0.12, 3],
      [784, 0.06, 2],
    ];
    for (const [frequency, level, decay] of partials) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level * 0.35, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      oscillator.connect(gain).connect(master);
      oscillator.start(now);
      oscillator.stop(now + decay + 0.1);
    }
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (enabled) {
      ensureContext();
      context?.resume();
    }
    if (master && context) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(
        enabled ? 0.32 : 0,
        context.currentTime,
        0.4,
      );
    }
    return enabled;
  }

  function toggle(force) {
    return setEnabled(force === undefined ? !enabled : force);
  }

  function update(time) {
    if (!context || !enabled) return;
    const now = context.currentTime;

    // 瀑布只在与镜头 4 对应的时段出现。
    const inWaterfall =
      time >= FILM_WATERFALL_START && time <= FILM_WATERFALL_END;
    if (waterfallGain) {
      waterfallGain.gain.setTargetAtTime(
        inWaterfall ? 0.22 : 0,
        now,
        0.5,
      );
    }

    if (windFilter) {
      windFilter.frequency.setTargetAtTime(
        420 + Math.sin(time * 0.4) * 160,
        now,
        0.8,
      );
    }

    // 每轮影片只在片尾撞一次钟；时间回到开头后重新布防。
    if (time < BELL_TIME - 0.5) {
      lastBellCycle = -1;
    } else if (
      time >= BELL_TIME &&
      time < BELL_TIME + 1.2 &&
      lastBellCycle !== 1
    ) {
      lastBellCycle = 1;
      ringBell();
    }
  }

  return {
    toggle,
    setEnabled,
    update,
    get enabled() {
      return enabled;
    },
  };
}
