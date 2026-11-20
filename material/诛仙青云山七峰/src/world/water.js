import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { createSprayTexture } from "../utils/textures.js";
import { seededRandom } from "../utils/noise.js";
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
  const sprayTexture = createSprayTexture();
  const sprays = [];

  function addWaterfall({ start, end, width, sprayCount, pondRadius, kind }) {
    const mid1 = start.clone().lerp(end, 0.3);
    mid1.y -= Math.min(140, (start.y - end.y) * 0.35);
    const mid2 = start.clone().lerp(end, 0.72);
    mid2.y += Math.min(90, (start.y - end.y) * 0.22);

    const curve = new THREE.CatmullRomCurve3([start, mid1, mid2, end]);
    const mesh = new THREE.Mesh(
      ribbonGeometry(curve.getPoints(56), width),
      waterfallMaterial,
    );
    mesh.frustumCulled = false;
    group.add(mesh);

    const sprayPositions = new Float32Array(sprayCount * 3);
    const sprayRandom = seededRandom(7741 + sprayCount);
    for (let i = 0; i < sprayCount; i++) {
      const angle = sprayRandom() * Math.PI * 2;
      const radius = sprayRandom() * width * 1.4;
      sprayPositions[i * 3] = end.x + Math.cos(angle) * radius;
      sprayPositions[i * 3 + 1] = end.y + sprayRandom() * width * 1.1;
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
        size: width * 0.83,
        map: sprayTexture,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    group.add(spray);
    sprays.push(spray);

    if (typeof window !== "undefined" && pondRadius > 0) {
      const pond = new Reflector(new THREE.CircleGeometry(pondRadius, 32), {
        textureWidth: 512,
        textureHeight: 512,
        color: 0x3d5560,
        clipBias: 0.003,
      });
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(
        end.x + pondRadius * 0.63,
        end.y - 1.5,
        end.z + pondRadius * 0.63,
      );
      group.add(pond);

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(pondRadius + 0.5, 1.2, 8, 28),
        new THREE.MeshStandardMaterial({ color: 0x7a776d, roughness: 0.9 }),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(
        end.x + pondRadius * 0.63,
        end.y - 0.8,
        end.z + pondRadius * 0.63,
      );
      rim.castShadow = true;
      rim.receiveShadow = true;
      group.add(rim);
    }

    waterfalls.push({ start, end, mesh, kind });
  }

  /* 风回峰瀑布 ------------------------------------------------------ */
  addWaterfall({
    start: new THREE.Vector3(-3180, heightAt(-3180, 320) + 3, 320),
    end: new THREE.Vector3(-2700, heightAt(-2700, 940) + 2, 940),
    width: 36,
    sprayCount: 260,
    pondRadius: 19,
    kind: "main",
  });

  /* 大竹峰北坡支瀑 -------------------------------------------------- */
  addWaterfall({
    start: new THREE.Vector3(-2600, heightAt(-2600, -1960) + 1, -1960),
    end: new THREE.Vector3(-2600, heightAt(-2600, -2140) + 1, -2140),
    width: 9.6,
    sprayCount: 120,
    pondRadius: 7,
    kind: "tributary",
  });

  /* 山泉 ------------------------------------------------------------ */
  const streamDefinitions = [
    [-2550, -1550, -2400, -1350],
    [1750, 2950, 1950, 3200],
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

  let clock = 0;

  function update(delta, state) {
    if (state && state.time !== undefined) {
      clock = state.time;
    } else {
      clock += delta;
    }
    timeUniform.value = clock;
    for (const spray of sprays) spray.rotation.y = clock * 0.05;
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
