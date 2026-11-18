/**
 * 捕获模式：用固定种子覆盖 Math.random，保证逐帧导出的结果一致。
 * 只在 URL 带 ?capture=1 时生效。
 */
import { seededRandom } from "./utils/noise.js";

const params = new URLSearchParams(window.location.search);
if (params.has("capture")) {
  let seed = 0x5eed1234;
  const random = seededRandom(seed);
  Math.random = random;
}
