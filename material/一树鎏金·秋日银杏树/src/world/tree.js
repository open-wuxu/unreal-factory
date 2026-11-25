import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { COLORS, LEAF, SUN_DIRECTION, WIND, WORLD } from "../config.js";
import { getBarkTextures, getLeafTexture } from "../utils/textures.js";
import { fbm2D, seededRandom } from "../utils/noise.js";

/**
 * 程序化银杏树。
 *
 * 结构层级：
 *   level 0  主干 + 根部扩张
 *   level 1  一级主枝 / 顶部主枝
 *   level 2  二级分枝
 *   level 3  三级细枝（带叶）
 *   level 4  末端小枝（叶簇最密）
 *
 * 几何由自定义「锥形管」沿 CatmullRomCurve3 扫掠生成，合并为一个
 * BufferGeometry；叶片用 InstancedMesh 一次绘制。风动全部在顶点着色器里，
 * 主干与一级主枝的摆动权重接近 0，避免整棵树像果冻一样变形。
 */

const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const CROWN_CENTER = WORLD.crownCenter.clone();

const SWAY_BY_LEVEL = {
  1: [0.003, 0.016],
  2: [0.012, 0.05],
  3: [0.035, 0.11],
  4: [0.06, 0.15],
};

const TUBE_DETAIL = {
  1: { tubular: 14, radial: 9 },
  2: { tubular: 9, radial: 7 },
  3: { tubular: 7, radial: 5 },
  4: { tubular: 5, radial: 4 },
};

function smoothstep01(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

/**
 * 沿曲线生成锥形管。每圈顶点额外携带 aSway / aPhase，
 * 供风动着色器按枝条级别弯曲。
 */
function buildTaperedTube({
  curve,
  tubularSegments,
  radialSegments,
  radiusStart,
  radiusEnd,
  phase,
  swayStart,
  swayEnd,
  uvScale = 0.9,
  uRepeat = 1.6,
  radialMod = null,
}) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const length = curve.getLength();
  const vertexCount = (tubularSegments + 1) * (radialSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const sway = new Float32Array(vertexCount);
  const phases = new Float32Array(vertexCount);
  const indices = [];

  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  let vertex = 0;

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, point);
    const frameNormal = frames.normals[i];
    const frameBinormal = frames.binormals[i];
    const radiusBase =
      radiusStart + (radiusEnd - radiusStart) * Math.pow(t, 0.9);
    const swayValue = swayStart + (swayEnd - swayStart) * Math.pow(t, 1.25);

    for (let j = 0; j <= radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      let radius = radiusBase;
      if (radialMod) radius *= radialMod(t, angle, point);
      radius *= 1 + 0.045 * Math.sin(angle * 3 + phase + t * 5.2);

      const px = point.x + (frameNormal.x * cos + frameBinormal.x * sin) * radius;
      const py = point.y + (frameNormal.y * cos + frameBinormal.y * sin) * radius;
      const pz = point.z + (frameNormal.z * cos + frameBinormal.z * sin) * radius;

      normal
        .copy(frameNormal)
        .multiplyScalar(cos)
        .addScaledVector(frameBinormal, sin)
        .normalize();

      positions[vertex * 3] = px;
      positions[vertex * 3 + 1] = py;
      positions[vertex * 3 + 2] = pz;
      normals[vertex * 3] = normal.x;
      normals[vertex * 3 + 1] = normal.y;
      normals[vertex * 3 + 2] = normal.z;
      uvs[vertex * 2] = (j / radialSegments) * uRepeat;
      uvs[vertex * 2 + 1] = (length * t) / uvScale;
      sway[vertex] = swayValue;
      phases[vertex] = phase;
      vertex++;
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + radialSegments + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("aSway", new THREE.BufferAttribute(sway, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setIndex(indices);
  return geometry;
}

/* ------------------------------------------------------------------ */
/* 着色器注入                                                          */
/* ------------------------------------------------------------------ */

function injectBranchSway(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uTime;
        uniform float uWind;
        attribute float aSway;
        attribute float aPhase;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec3 branchSway = vec3(
          sin(uTime * 0.82 + aPhase * 5.1 + position.y * 0.18),
          0.32 * sin(uTime * 1.21 + aPhase * 3.7),
          cos(uTime * 0.71 + aPhase * 6.3)
        );
        transformed += branchSway * aSway * uWind;`,
      );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => "ginkgo-branch-sway";
}

function injectLeafWind(shader, uniforms) {
  shader.uniforms.uTime = uniforms.uTime;
  shader.uniforms.uWind = uniforms.uWind;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
      uniform float uTime;
      uniform float uWind;`,
    )
    .replace(
      "#include <project_vertex>",
      `vec4 mvPosition = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        float leafPhase = dot(instanceMatrix[3].xyz, vec3(0.37, 0.11, 0.53));
        float flutter = 0.5 + 0.5 * sin(uTime * 1.7 + leafPhase * 6.2831);
        vec3 leafWind = vec3(
          sin(uTime * 1.05 + leafPhase * 4.7),
          0.35 * sin(uTime * 1.63 + leafPhase * 7.1),
          cos(uTime * 0.87 + leafPhase * 5.3)
        ) * (0.026 + 0.03 * flutter) * uWind;
        mvPosition.xyz += leafWind;
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`,
    );
}

function injectLeafTranslucency(material, uniforms, glowColor) {
  material.onBeforeCompile = (shader) => {
    injectLeafWind(shader, uniforms);
    shader.uniforms.uSunDirection = uniforms.uSunDirection;
    shader.uniforms.uLeafGlow = uniforms.uLeafGlow;
    shader.uniforms.uTranslucency = uniforms.uTranslucency;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uSunDirection;
        uniform vec3 uLeafGlow;
        uniform float uTranslucency;`,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        vec3 sunView = normalize((viewMatrix * vec4(uSunDirection, 0.0)).xyz);
        float towardSun = pow(max(dot(normalize(-vViewPosition), sunView), 0.0), 3.0);
        float thinness = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 1.4);
        totalEmissiveRadiance += uLeafGlow * towardSun * (0.38 + 0.62 * thinness) * uTranslucency;`,
      );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => "ginkgo-leaf-translucency";
  material.userData.glowColor = new THREE.Color(glowColor);
}

/* ------------------------------------------------------------------ */
/* 叶片几何                                                            */
/* ------------------------------------------------------------------ */

export function createLeafGeometry() {
  const geometry = new THREE.PlaneGeometry(1, 1, 3, 3);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    // 叶面向 +Z 微微卷曲，避免所有叶片像纸片一样平。
    const z = 0.13 * (x * x * 1.35 + (y + 0.12) * (y + 0.12) * 0.55);
    position.setZ(i, z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function pickPaletteColor(random) {
  const roll = random();
  let cursor = 0;
  let hex = LEAF.palette[0].color;
  for (const entry of LEAF.palette) {
    cursor += entry.weight;
    if (roll <= cursor) {
      hex = entry.color;
      break;
    }
  }
  return new THREE.Color(hex).multiplyScalar(0.88 + random() * 0.24);
}

/* ------------------------------------------------------------------ */
/* 主体                                                                */
/* ------------------------------------------------------------------ */

export function createTree(scene, { anisotropy = 8 } = {}) {
  const random = seededRandom(0x91c4a7);
  const group = new THREE.Group();
  group.name = "ginkgo-tree";

  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: WIND.strength },
    uSunDirection: { value: SUN_DIRECTION.clone() },
    uLeafGlow: { value: new THREE.Color(COLORS.leafGlow) },
    uTranslucency: { value: 0.64 },
  };

  const bark = getBarkTextures(anisotropy);
  const leafTexture = getLeafTexture(anisotropy);

  const segments = [];
  const leafAnchors = [];
  const leafCloud = [];

  /* 主干 ------------------------------------------------------------ */

  const trunkCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, -0.55, 0),
      new THREE.Vector3(0.04, 0.85, 0.02),
      new THREE.Vector3(-0.1, 2.25, 0.09),
      new THREE.Vector3(0.06, 3.85, -0.02),
      new THREE.Vector3(0.16, 5.25, 0.08),
      new THREE.Vector3(0.02, 6.5, 0.02),
      new THREE.Vector3(-0.1, 7.55, -0.05),
      new THREE.Vector3(-0.02, 8.55, 0.02),
    ],
    false,
    "centripetal",
  );

  const trunkLength = trunkCurve.getLength();

  function trunkRadiusAt(t) {
    const y = -0.55 + trunkLength * t;
    const taper = Math.pow(1 - t, 0.8);
    const base = 0.16 + (0.48 - 0.16) * taper;
    const flare = 0.15 * Math.exp(-Math.max(0, y) / 1.0);
    return base + flare;
  }

  function trunkRadialMod(t, angle, point) {
    const y = Math.max(0, point.y);
    const flare = Math.exp(-y / 1.3);
    const relief = fbm2D(
      y * 1.75 + 8.2,
      Math.cos(angle) * 2.8 + Math.sin(angle) * 3.4,
      23,
      3,
    );
    return (
      1 +
      0.17 * flare * (0.5 + 0.5 * Math.cos(angle * 5 + 0.55)) +
      0.03 * Math.sin(angle * 7 + t * 11) +
      (relief - 0.5) * 0.16
    );
  }

  segments.push({
    curve: trunkCurve,
    tubularSegments: 60,
    radialSegments: 20,
    radiusStart: trunkRadiusAt(0),
    radiusEnd: trunkRadiusAt(1),
    phase: 0.3,
    swayStart: 0,
    swayEnd: 0.003,
    uvScale: 1.15,
    uRepeat: 2,
    radialMod: trunkRadialMod,
    isTrunk: true,
  });

  // 底部根盘：从主干向外斜插进地面
  const rootCount = 7;
  for (let i = 0; i < rootCount; i++) {
    const angle = (i / rootCount) * Math.PI * 2 + random() * 0.4;
    const reach = 1.5 + random() * 1.15;
    const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const side = new THREE.Vector3(-outward.z, 0, outward.x);
    const points = [
      new THREE.Vector3(0, 0.62, 0).addScaledVector(outward, 0.06),
      new THREE.Vector3(0, 0.46, 0)
        .addScaledVector(outward, reach * 0.38)
        .addScaledVector(side, (random() - 0.5) * 0.16),
      new THREE.Vector3(0, 0.18, 0)
        .addScaledVector(outward, reach * 0.78)
        .addScaledVector(side, (random() - 0.5) * 0.22),
      new THREE.Vector3(0, -0.12, 0).addScaledVector(outward, reach),
    ];
    const rootCurve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    segments.push({
      curve: rootCurve,
      tubularSegments: 12,
      radialSegments: 8,
      radiusStart: 0.26 + random() * 0.07,
      radiusEnd: 0.025,
      phase: random() * Math.PI * 2,
      swayStart: 0,
      swayEnd: 0,
      uvScale: 0.8,
      uRepeat: 1,
    });
  }

  // 主干采样，便于按高度挂接主枝
  const trunkSamples = [];
  const sampleCount = 180;
  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    trunkSamples.push({
      t,
      y: trunkCurve.getPointAt(t).y,
      point: trunkCurve.getPointAt(t),
    });
  }

  function trunkPointAtY(y) {
    let best = trunkSamples[0];
    let bestDistance = Infinity;
    for (const entry of trunkSamples) {
      const distance = Math.abs(entry.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = entry;
      }
    }
    return best.point.clone();
  }

  /* 分枝 ------------------------------------------------------------ */

  const twigAnchors = [];

  function growBranch({
    start,
    direction,
    length,
    radius,
    level,
    depth,
    phase,
  }) {
    const sway = SWAY_BY_LEVEL[level] ?? SWAY_BY_LEVEL[4];
    const detail = TUBE_DETAIL[level] ?? TUBE_DETAIL[4];
    const points = [start.clone()];
    let point = start.clone();
    let dir = direction.clone().normalize();

    const side = new THREE.Vector3().crossVectors(dir, UP);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();

    const upBias = level === 1 ? 0.18 : level === 2 ? 0.1 : level === 3 ? 0.05 : 0.02;
    const steps = level <= 2 ? 5 : 4;

    for (let i = 1; i <= steps; i++) {
      dir = dir.clone().addScaledVector(UP, upBias / steps).normalize();
      dir = dir
        .clone()
        .addScaledVector(side, ((random() - 0.5) * 0.16) / steps)
        .normalize();

      const wobble = new THREE.Vector3(
        (random() - 0.5) * 0.045,
        (random() - 0.5) * 0.012,
        (random() - 0.5) * 0.045,
      );
      point = point
        .clone()
        .addScaledVector(dir, length / steps)
        .add(wobble);
      points.push(point.clone());
    }

    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const radiusEnd = radius * (depth >= 3 ? 0.3 : 0.58);
    segments.push({
      curve,
      tubularSegments: detail.tubular,
      radialSegments: detail.radial,
      radiusStart: radius,
      radiusEnd,
      phase,
      swayStart: sway[0],
      swayEnd: sway[1],
      uvScale: level === 1 ? 0.9 : 0.62,
      uRepeat: 1,
    });

    if (level >= 2) {
      leafAnchors.push({ curve, level, radius, phase, length });
      if (level === 4) twigAnchors.push(curve);
    }

    if (depth >= 3) return;

    const childCount =
      level === 1
        ? 4
        : level === 2
          ? 4
          : random() < 0.42
            ? 4
            : 3;

    for (let child = 0; child < childCount; child++) {
      const t = Math.min(
        0.975,
        0.36 + (0.58 * (child + 0.2 + random() * 0.6)) / childCount,
      );
      const childStart = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();

      const outward = childStart.clone().sub(CROWN_CENTER);
      outward.y *= 0.42;
      if (outward.lengthSq() < 1e-6) outward.set(random() - 0.5, 0.2, random() - 0.5);
      outward.normalize();

      // 让子枝围绕父枝在三维空间里散开，而不是排成一把扁平的梳子
      const divergenceAxis = new THREE.Vector3(
        random() * 2 - 1,
        random() * 2 - 1,
        random() * 2 - 1,
      );
      if (divergenceAxis.lengthSq() < 1e-5) divergenceAxis.set(0, 1, 0);
      divergenceAxis.normalize();

      const childDirection = tangent
        .clone()
        .applyAxisAngle(divergenceAxis, 0.42 + random() * 0.58)
        .addScaledVector(outward, 0.34 + random() * 0.18)
        .addScaledVector(UP, level === 1 ? 0.13 : 0.07)
        .add(
          new THREE.Vector3(
            (random() - 0.5) * 0.2,
            (random() - 0.5) * 0.1,
            (random() - 0.5) * 0.2,
          ),
        )
        .normalize();

      if (childDirection.y < -0.34) {
        childDirection.y = -0.34 + random() * 0.12;
        childDirection.normalize();
      }

      const childLength = length * (0.54 + random() * 0.14);
      const childRadius = radius * 0.56 * (0.9 + random() * 0.18);

      growBranch({
        start: childStart,
        direction: childDirection,
        length: childLength,
        radius: childRadius,
        level: level + 1,
        depth: depth + 1,
        phase: random() * Math.PI * 2,
      });
    }
  }

  // 顶部四根主枝，撑起树冠上半部
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.7;
    const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const startY = 7.0 + i * 0.34 + random() * 0.34;
    const start = trunkPointAtY(startY);
    const direction = outward
      .clone()
      .multiplyScalar(0.4 + random() * 0.16)
      .addScaledVector(UP, 1)
      .normalize();
    growBranch({
      start,
      direction,
      length: 3.2 + random() * 0.7,
      radius: 0.16 + random() * 0.03,
      level: 1,
      depth: 0,
      phase: random() * Math.PI * 2,
    });
  }

  // 主干上的十二根一级主枝，越靠下越舒展
  const primaryCount = 12;
  for (let i = 0; i < primaryCount; i++) {
    const y = 3.25 + (i / (primaryCount - 1)) * 4.2 + (random() - 0.5) * 0.44;
    const angle = i * 2.399963 + random() * 0.58;
    const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const norm = (y - 3.25) / 4.2;
    const elevation = 0.15 + norm * 0.5 + (random() - 0.5) * 0.22;
    const direction = outward
      .clone()
      .multiplyScalar(Math.cos(elevation))
      .addScaledVector(UP, Math.sin(elevation))
      .normalize();
    const start = trunkPointAtY(y);
    const length = 2.95 - norm * 0.35 + random() * 0.7;
    growBranch({
      start,
      direction,
      length,
      radius: 0.17 - norm * 0.022 + random() * 0.025,
      level: 1,
      depth: 0,
      phase: random() * Math.PI * 2,
    });
  }

  /* 叶片分布 -------------------------------------------------------- */

  const leafData = [];
  const rotation = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const normal = new THREE.Vector3();
  const sideVector = new THREE.Vector3();
  const outwardVector = new THREE.Vector3();
  const offsetDir = new THREE.Vector3();

  function scatterLeaves(anchor) {
    const { curve, level, phase } = anchor;
    const baseSamples =
      level === 4
        ? 15 + Math.floor(random() * 5)
        : level === 3
          ? 9 + Math.floor(random() * 4)
          : 4 + Math.floor(random() * 2);
    // 树冠上半部适度加密，压住顶部过尖的枝叶轮廓
    const midPoint = curve.getPointAt(0.5);
    const upperBoost = midPoint.y > 9.2 ? 1.32 : 1;
    const samples = Math.max(1, Math.round(baseSamples * upperBoost));
    const clusterSize = level === 4 ? (random() < 0.45 ? 3 : 2) : 2;
    const startT = level === 2 ? 0.42 : 0.1;

    for (let i = 0; i < samples; i++) {
      const t = startT + (1 - startT) * Math.pow(random(), 0.82);
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      sideVector.crossVectors(tangent, UP);
      if (sideVector.lengthSq() < 1e-6) sideVector.set(1, 0, 0);
      sideVector.normalize();

      outwardVector.copy(point).sub(CROWN_CENTER);
      outwardVector.y *= 0.36;
      if (outwardVector.lengthSq() < 1e-6) {
        outwardVector.set(random() - 0.5, 0.4, random() - 0.5);
      }
      outwardVector.normalize();

      for (let cluster = 0; cluster < clusterSize; cluster++) {
        // 叶簇在枝条周围呈球形铺开，保证从任何角度都能看到叶面
        const z = random() * 2 - 1;
        const theta = random() * Math.PI * 2;
        const radius = Math.sqrt(Math.max(0, 1 - z * z));
        offsetDir.set(Math.cos(theta) * radius, z, Math.sin(theta) * radius);

        normal
          .copy(outwardVector)
          .multiplyScalar(0.5)
          .addScaledVector(UP, 0.24 + random() * 0.2)
          .addScaledVector(sideVector, (random() - 0.5) * 0.5)
          .addScaledVector(offsetDir, 0.85)
          .addScaledVector(tangent, (random() - 0.5) * 0.28)
          .normalize();

        const position = point
          .clone()
          .addScaledVector(offsetDir, 0.025 + random() * 0.085)
          .addScaledVector(normal, 0.012 + random() * 0.018);

        rotation.setFromUnitVectors(Z_AXIS, normal);
        spin.setFromAxisAngle(normal, random() * Math.PI * 2);
        rotation.premultiply(spin);

        const scale =
          LEAF.size *
          (0.62 + random() * 0.62) *
          (level === 4 ? 1 : 1.04);
        const color = pickPaletteColor(random);

        leafData.push({
          position,
          quaternion: rotation.clone(),
          scale,
          color,
          phase: phase + random() * Math.PI * 2,
        });
      }
    }
  }

  for (const anchor of leafAnchors) scatterLeaves(anchor);

  /* 微距镜头专用叶簇：在树冠东南缘的真实小枝上加密一小簇，
     让特写有明确的焦点，也保证背景仍是树冠而不是空洞。 */
  const showcase = (() => {
    const desired = new THREE.Vector3(4.0, 9.2, 2.8);
    let bestCurve = null;
    let bestDistance = Infinity;
    let bestPoint = desired.clone();

    for (const curve of twigAnchors) {
      for (let i = 0; i <= 8; i++) {
        const point = curve.getPointAt(0.5 + (0.5 * i) / 8);
        const distance = point.distanceToSquared(desired);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCurve = curve;
          bestPoint = point.clone();
        }
      }
    }
    if (!bestCurve) return { center: bestPoint, added: 0 };

    const count = 120;
    for (let i = 0; i < count; i++) {      const t = 0.55 + random() * 0.45;
      const point = bestCurve.getPointAt(t);
      const tangent = bestCurve.getTangentAt(t).normalize();
      sideVector.crossVectors(tangent, UP);
      if (sideVector.lengthSq() < 1e-6) sideVector.set(1, 0, 0);
      sideVector.normalize();

      outwardVector.copy(point).sub(CROWN_CENTER);
      outwardVector.y *= 0.3;
      if (outwardVector.lengthSq() < 1e-6) outwardVector.set(random() - 0.5, 0.4, random() - 0.5);
      outwardVector.normalize();

      const z = random() * 2 - 1;
      const theta = random() * Math.PI * 2;
      const radius = Math.sqrt(Math.max(0, 1 - z * z));
      offsetDir.set(Math.cos(theta) * radius, z, Math.sin(theta) * radius);

      normal
        .copy(outwardVector)
        .multiplyScalar(0.55)
        .addScaledVector(UP, 0.22 + random() * 0.2)
        .addScaledVector(sideVector, (random() - 0.5) * 0.4)
        .addScaledVector(offsetDir, 0.9)
        .normalize();

      const position = point
        .clone()
        .addScaledVector(offsetDir, 0.035 + random() * 0.13)
        .addScaledVector(normal, 0.02 + random() * 0.02);

      rotation.setFromUnitVectors(Z_AXIS, normal);
      spin.setFromAxisAngle(normal, random() * Math.PI * 2);
      rotation.premultiply(spin);

      leafData.push({
        position,
        quaternion: rotation.clone(),
        scale: LEAF.size * (0.82 + random() * 0.5),
        color: pickPaletteColor(random),
        phase: random() * Math.PI * 2,
      });
    }

    const center = bestPoint;
    return { center, added: count, distance: Math.sqrt(bestDistance) };
  })();

  /* 构建网格 -------------------------------------------------------- */

  const barkMaterial = new THREE.MeshStandardMaterial({
    map: bark.map,
    bumpMap: bark.bumpMap,
    bumpScale: 0.9,
    roughnessMap: bark.roughnessMap,
    roughness: 1.0,
    metalness: 0,
    color: 0x9f8464,
    envMapIntensity: 0.18,
  });
  injectBranchSway(barkMaterial, uniforms);

  const branchGeometries = segments.map((segment) =>
    buildTaperedTube({
      curve: segment.curve,
      tubularSegments: segment.tubularSegments,
      radialSegments: segment.radialSegments,
      radiusStart: segment.radiusStart,
      radiusEnd: segment.radiusEnd,
      phase: segment.phase,
      swayStart: segment.swayStart,
      swayEnd: segment.swayEnd,
      uvScale: segment.uvScale,
      uRepeat: segment.uRepeat,
      radialMod: segment.radialMod ?? null,
    }),
  );

  const mergedBranches = BufferGeometryUtils.mergeGeometries(branchGeometries, false);
  if (!mergedBranches) throw new Error("银杏树枝几何合并失败");
  for (const geometry of branchGeometries) geometry.dispose();
  mergedBranches.computeBoundingSphere();

  const branches = new THREE.Mesh(mergedBranches, barkMaterial);
  branches.name = "ginkgo-branches";
  branches.castShadow = true;
  branches.receiveShadow = true;

  const branchDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
  });
  branchDepthMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uTime;
        uniform float uWind;
        attribute float aSway;
        attribute float aPhase;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec3 branchSway = vec3(
          sin(uTime * 0.82 + aPhase * 5.1 + position.y * 0.18),
          0.32 * sin(uTime * 1.21 + aPhase * 3.7),
          cos(uTime * 0.71 + aPhase * 6.3)
        );
        transformed += branchSway * aSway * uWind;`,
      );
  };
  branchDepthMaterial.customProgramCacheKey = () => "ginkgo-branch-depth";
  branches.customDepthMaterial = branchDepthMaterial;

  const leafGeometry = createLeafGeometry();
  const leafMaterial = new THREE.MeshStandardMaterial({
    map: leafTexture,
    alphaTest: LEAF.alphaTest,
    side: THREE.DoubleSide,
    roughness: 0.66,
    metalness: 0,
    color: 0xffffff,
    envMapIntensity: 0.55,
    vertexColors: false,
  });
  injectLeafTranslucency(leafMaterial, uniforms, COLORS.leafGlow);

  const leafCount = leafData.length;
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafCount);
  leaves.name = "ginkgo-leaves";
  leaves.castShadow = true;
  leaves.receiveShadow = true;

  const leafDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: leafTexture,
    alphaTest: LEAF.alphaTest,
    side: THREE.DoubleSide,
  });
  leafDepthMaterial.onBeforeCompile = (shader) => {
    injectLeafWind(shader, uniforms);
  };
  leafDepthMaterial.customProgramCacheKey = () => "ginkgo-leaf-depth";
  leaves.customDepthMaterial = leafDepthMaterial;

  const dummy = new THREE.Object3D();
  const crownBounds = new THREE.Box3();
  const crownSamples = [];
  for (let i = 0; i < leafCount; i++) {
    const leaf = leafData[i];
    dummy.position.copy(leaf.position);
    dummy.quaternion.copy(leaf.quaternion);
    dummy.scale.setScalar(leaf.scale);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    leaves.setColorAt(i, leaf.color);
    crownBounds.expandByPoint(leaf.position);
    if (i % 137 === 0) crownSamples.push(leaf.position.clone());
  }
  leaves.instanceMatrix.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  leaves.computeBoundingSphere();

  group.add(branches, leaves);
  scene.add(group);

  const heroLeaf = {
    position: showcase.center.clone(),
    distance: showcase.distance ?? 0,
  };

  function nearestLeafTo(target) {
    let bestDistance = Infinity;
    let bestPosition = target.clone();
    for (const leaf of leafData) {
      const distance = leaf.position.distanceToSquared(target);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPosition = leaf.position;
      }
    }
    return { position: bestPosition.clone(), distance: Math.sqrt(bestDistance) };
  }

  /* 更新 ------------------------------------------------------------ */

  function update(delta, elapsed) {
    void delta;
    const gust = 1 + WIND.gust * Math.sin(elapsed * 0.43) * Math.sin(elapsed * 0.17 + 1.7);
    uniforms.uTime.value = elapsed;
    uniforms.uWind.value = WIND.strength * gust;
  }

  function setWindStrength(value) {
    WIND.strength = value;
  }

  return {
    group,
    branches,
    leaves,
    uniforms,
    leafCount,
    branchCount: segments.length,
    twigCount: twigAnchors.length,
    crownSamples,
    crownBounds,
    heroLeaf,
    showcase,
    nearestLeafTo,
    trunkCurve,
    update,
    setWindStrength,
    setTranslucency(value) {
      uniforms.uTranslucency.value = value;
    },
    dispose() {
      scene.remove(group);
      mergedBranches.dispose();
      leafGeometry.dispose();
      barkMaterial.dispose();
      leafMaterial.dispose();
      branchDepthMaterial.dispose();
      leafDepthMaterial.dispose();
      leaves.dispose();
    },
  };
}
