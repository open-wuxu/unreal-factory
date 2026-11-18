/**
 * 捕获模式下的确定性随机数。
 *
 * 场景里的叶簇、落叶、雾片、乌鸦等都有创建期随机。逐帧导出时
 * 必须保证每次运行得到完全相同的画面，因此在 ?capture=1 下用固定
 * seed 覆盖 Math.random；正常浏览不受影响。
 */

const capture = new URLSearchParams(window.location.search).has("capture");

if (capture) {
  let seed = 0x9e3779b9;
  Math.random = function deterministicRandom() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
