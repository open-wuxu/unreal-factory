import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { createSprayTexture } from "../utils/textures.js";
import { heightAt } from "./shape.js";

/**
 * 水体：风回峰瀑布、大竹峰与小竹峰山泉、瀑布下的水潭。
 * 水带用沿路径放样的 ribbon + 滚动噪声 shader，全部由绝对时间驱动。
 */

const WATER_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WATER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uFoam;
  uniform float uSpeed;
  uniform float uOpacity;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += noise(p) * amplitude;
      p = p * 2.03 + vec2(3.1, 7.7);
      amplitude *= 0.5;
    }
    return sum;
  }

  void main() {
    float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
    float streak = fbm(vec2(vUv.x * 9.0, vUv.y * 4.5 - uTime * uSpeed));
    float foam = smoothstep(0.42, 0.74, streak);
    float falloff = smoothstep(0.0, 0.08, vUv.y);
    vec3 color = mix(uDeep, uFoam, foam * 0.85 + 0.12);
    float alpha = edge * falloff * (0.32 + 0.58 * foam) * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

function waterMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WATER_VERTEX,
    fragmentShader: WATER_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function ribbonGeometry(points, width) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();

  for (let i = 0; i < points.length; i++) {
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    tangent.copy(next).sub(previous);
    side.set(-tangent.z, 0, tangent.x);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize().multiplyScalar(width / 2);
    void up;

    positions.push(
      points[i].x + side.x,
      points[i].y,
      points[i].z + side.z,
      points[i].x - side.x,
      points[i].y,
      points[i].z - side.z,
    );
    const v = i / (points.length - 1);
    uvs.push(0, v, 1, v);
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, c, b, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function sampleStream(x0, z0, x1, z1, segments, lift = 0.45) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    points.push(new THREE.Vector3(x, heightAt(x, z) + lift, z));
  }
  return points;
}

export function createWater(scene) {
  const group = new THREE.Group();
  group.name = "water";
  const timeUniform = { value: 0 };
  const waterfalls = [];
  const streams = [];

  const waterfallUniforms = {
    uTime: timeUniform,
    uDeep: { value: new THREE.Color(0x7d9aab) },
    uFoam: { value: new THREE.Color(0xe8f2f5) },
    uSpeed: { value: 1.5 },
    uOpacity: { value: 0.92 },
  };
  const streamUniforms = {
    uTime: timeUniform,
    uDeep: { value: new THREE.Color(0x3f5f6b) },
    uFoam: { value: new THREE.Color(0xa8c4c9) },
    uSpeed: { value: 0.18 },
    uOpacity: { value: 0.62 },
  };
  const waterfallMaterial = waterMaterial(waterfallUniforms);
  const streamMaterial = waterMaterial(streamUniforms);

  /* 风回峰瀑布 ------------------------------------------------------ */
  const start = new THREE.Vector3(
    -3140,
    heightAt(-3140, 360) + 3,
    360,
  );
  const end = new THREE.Vector3(-3005, heightAt(-3005, 555) + 2, 555);

  const curve = new THREE.CatmullRomCurve3([
    start,
    new THREE.Vector3(start.x + 34, start.y - 120, start.z + 62),
    new THREE.Vector3(end.x + 18, end.y + 80, end.z + 22),
    end,
  ]);
  const curvePoints = curve.getPoints(56);
  const waterfall = new THREE.Mesh(
    ribbonGeometry(curvePoints, 24),
    waterfallMaterial,
  );
  waterfall.frustumCulled = false;
  group.add(waterfall);

  const sprayTexture = createSprayTexture();
  const sprayCount = 260;
  const sprayPositions = new Float32Array(sprayCount * 3);
  for (let i = 0; i < sprayCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 34;
    sprayPositions[i * 3] = end.x + Math.cos(angle) * radius;
    sprayPositions[i * 3 + 1] = end.y + Math.random() * 26;
    sprayPositions[i * 3 + 2] = end.z + Math.sin(angle) * radius;
  }
  const sprayGeometry = new THREE.BufferGeometry();
  sprayGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(sprayPositions, 3),
  );
  const spray = new THREE.Points(
    sprayGeometry,
    new THREE.PointsMaterial({
      color: 0xdce9ee,
      size: 20,
      map: sprayTexture,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(spray);

  if (typeof window !== "undefined") {
    const pond = new Reflector(new THREE.CircleGeometry(19, 32), {
      textureWidth: 512,
      textureHeight: 512,
      color: 0x3d5560,
      clipBias: 0.003,
    });
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(end.x + 12, end.y - 1.5, end.z + 12);
    group.add(pond);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(19.5, 1.2, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0x7a776d, roughness: 0.9 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(end.x + 12, end.y - 0.8, end.z + 12);
    rim.castShadow = true;
    rim.receiveShadow = true;
    group.add(rim);
  }

  waterfalls.push({ start, end, mesh: waterfall });

  /* 山泉 ------------------------------------------------------------ */
  const streamDefinitions = [
    [-1990, 2620, -1855, 2960],
    [1710, 2915, 1880, 3170],
  ];
  for (const [x0, z0, x1, z1] of streamDefinitions) {
    const points = sampleStream(x0, z0, x1, z1, 18);
    const stream = new THREE.Mesh(
      ribbonGeometry(points, 3.2),
      streamMaterial,
    );
    stream.frustumCulled = false;
    group.add(stream);
    streams.push({ points, mesh: stream });
  }

  scene.add(group);

  function update(delta, state) {
    if (state && state.time !== undefined) {
      timeUniform.value = state.time;
    } else {
      timeUniform.value += delta;
    }
    spray.rotation.y += delta * 0.05;
  }

  return {
    group,
    waterfalls,
    streams,
    update,
    setEnabled(value) {
      group.visible = Boolean(value);
    },
  };
}
