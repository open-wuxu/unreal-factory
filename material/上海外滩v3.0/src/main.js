import * as THREE from "three";

const canvas = document.querySelector("#scene");
const loading = document.querySelector("#loading");

const gl = canvas.getContext("webgl2", { antialias: true, alpha: false });

if (!gl) {
  loading.textContent = "当前浏览器不支持 WebGL2";
  throw new Error("WebGL2 is not available");
}

const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x070a10, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x070a10, 80, 220);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(16, 13, 20);
camera.lookAt(0, 3, 0);

scene.add(new THREE.AmbientLight(0xffffff, 1.4));

const sun = new THREE.DirectionalLight(0xffe2b0, 3.2);
sun.position.set(12, 20, 8);
scene.add(sun);

const fill = new THREE.DirectionalLight(0x6cc6ff, 1.6);
fill.position.set(-14, 9, -10);
scene.add(fill);

// 占位内容：彩色网格 + 立方体，保证冒烟截图非空。真实场景在后续任务中替换。
const grid = new THREE.GridHelper(80, 40, 0xffa64d, 0x2f6f9f);
grid.material.opacity = 0.65;
grid.material.transparent = true;
scene.add(grid);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(6, 6, 6),
  new THREE.MeshStandardMaterial({ color: 0x36c5f0, roughness: 0.32, metalness: 0.25 }),
);
cube.position.set(0, 3, 0);
scene.add(cube);

const accent = new THREE.Mesh(
  new THREE.TorusKnotGeometry(1.2, 0.4, 96, 16),
  new THREE.MeshStandardMaterial({ color: 0xffc46b, roughness: 0.25, metalness: 0.6 }),
);
accent.position.set(0, 8.5, 0);
scene.add(accent);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let ready = false;

function frame(time) {
  const t = time / 1000;
  cube.rotation.y = t * 0.45;
  cube.rotation.x = Math.sin(t * 0.3) * 0.15;
  accent.rotation.y = t * 0.8;
  accent.rotation.x = t * 0.35;

  renderer.render(scene, camera);

  if (!ready) {
    ready = true;
    loading.dataset.hidden = "true";
    window.__bund = { ready: true };
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
