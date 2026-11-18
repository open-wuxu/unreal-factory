import * as THREE from "three";
import { MAPLES, WORLD } from "../config.js";
import { createLeafTexture, seededRandom } from "../utils/textures.js";
import { barkMaterial } from "./materials.js";

/**
 * 江岸枫树。
 *
 * 树干与枝条用递归程序化生成，同一棵树的全部枝干合并为一个
 * BufferGeometry；树冠由实例化的低多边形叶簇 + 带枫叶剪影的
 * 叶片卡片组成。风、落叶、水面漂浮都围绕同一套实例数据展开。
 */

const FOLIAGE_PER_TREE = 130;
const CARDS_PER_TREE = 230;
const FALLING_COUNT = 120;

function makeSwayPatch(uniforms, strength, phaseScale) {
  return (shader) => {
    shader.uniforms.uWindTime = uniforms.uWindTime;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `
        #include <common>
        uniform float uWindTime;
        uniform float uWindStrength;
        `,
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 swayWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        #else
          vec4 swayWorld = modelMatrix * vec4(transformed, 1.0);
        #endif
        float swayPhase = uWindTime * 0.55 + swayWorld.x * 0.09 + swayWorld.z * 0.07;
        float swayAmount = uWindStrength * ${strength.toFixed(3)};
        transformed.x += sin(swayPhase) * swayAmount;
        transformed.z += cos(swayPhase * 0.83 + 1.7) * swayAmount * 0.7;
        `,
      );
  };
}

function createBarkWithSway(uniforms) {
  const material = barkMaterial();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = uniforms.uWindTime;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `
        #include <common>
        uniform float uWindTime;
        uniform float uWindStrength;
        `,
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
        #include <begin_vertex>
        float bendHeight = max(transformed.y - 1.2, 0.0);
        float bend = uWindStrength * 0.0022 * bendHeight * bendHeight * 0.06;
        transformed.x += sin(uWindTime * 0.42 + modelMatrix[3][0] * 0.1) * bend;
        transformed.z += cos(uWindTime * 0.37 + modelMatrix[3][2] * 0.1) * bend * 0.8;
        `,
      );
  };
  return material;
}

/**
 * 递归生成一棵树的枝干几何。
 * 顶点直接写进树的空间（树的根为原点），以便合并。
 */
function growTree(seed) {
  const rand = seededRandom(seed);
  const segments = [];
  const tips = [];

  const randPerp = (dir) => {
    const up = Math.abs(dir.y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const a = new THREE.Vector3().crossVectors(dir, up).normalize();
    const b = new THREE.Vector3().crossVectors(dir, a).normalize();
    const angle = rand() * Math.PI * 2;
    return a.multiplyScalar(Math.cos(angle)).addScaledVector(b, Math.sin(angle)).normalize();
  };

  function branch(start, dir, length, radius, depth) {
    const end = start.clone().addScaledVector(dir, length);
    segments.push({ start: start.clone(), end: end.clone(), radius });

    if (depth <= 0) {
      tips.push(end.clone());
      return;
    }

    const count = depth >= 3 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const perp = randPerp(dir);
      const spread = 0.34 + rand() * 0.42 + (count === 3 ? 0.08 : 0);
      const nextDir = dir.clone()
        .applyAxisAngle(perp, spread)
        .applyAxisAngle(dir, (i / count) * Math.PI * 2 + rand() * 0.7)
        .normalize();
      // 让枝条整体略微向上，避免下垂成伞状
      nextDir.y = Math.min(0.92, nextDir.y + 0.22);
      nextDir.normalize();
      branch(
        end,
        nextDir,
        length * (0.62 + rand() * 0.1),
        radius * (0.58 + rand() * 0.08),
        depth - 1,
      );
    }
  }

  branch(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3((rand() - 0.5) * 0.16, 1, (rand() - 0.5) * 0.16).normalize(),
    4.6,
    0.46,
    4,
  );

  return { segments, tips, rand };
}

function buildBarkGeometry(tree) {
  const geometries = [];
  for (const segment of tree.segments) {
    const direction = new THREE.Vector3().subVectors(segment.end, segment.start);
    const length = direction.length();
    if (length < 0.001) continue;
    const geometry = new THREE.CylinderGeometry(
      segment.radius * 0.64,
      segment.radius,
      length,
      6,
      1,
      true,
    );
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
    const midpoint = segment.start.clone().addScaledVector(direction, 0.5);
    matrix.compose(midpoint, quaternion, new THREE.Vector3(1, 1, 1));
    geometry.applyMatrix4(matrix);
    geometries.push(geometry);
  }

  // 简单的合并（避免额外 import，保持本文件自洽）
  const merged = new THREE.BufferGeometry();
  let vertexCount = 0;
  let indexCount = 0;
  for (const geometry of geometries) {
    vertexCount += geometry.attributes.position.count;
    indexCount += geometry.index ? geometry.index.count : 0;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(indexCount);
  let vertexOffset = 0;
  let indexOffset = 0;
  for (const geometry of geometries) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    positions.set(position.array, vertexOffset * 3);
    normals.set(normal.array, vertexOffset * 3);
    uvs.set(uv.array, vertexOffset * 2);
    const index = geometry.index;
    for (let i = 0; i < index.count; i++) {
      indices[indexOffset + i] = index.getX(i) + vertexOffset;
    }
    vertexOffset += position.count;
    indexOffset += index.count;
    geometry.dispose();
  }
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  return merged;
}

function makeCanopyPosition(tip, rand, spread) {
  return new THREE.Vector3(
    tip.x + (rand() - 0.5) * spread,
    tip.y + (rand() - 0.3) * spread * 0.7,
    tip.z + (rand() - 0.5) * spread,
  );
}

export function createMaples() {
  const group = new THREE.Group();
  group.name = "Maples";

  const windUniforms = {
    uWindTime: { value: 0 },
    uWindStrength: { value: 1 },
  };

  const bark = createBarkWithSway(windUniforms);
  const leafTexture = createLeafTexture();

  const foliageMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x1c0505,
    emissiveIntensity: 0.75,
    roughness: 0.92,
    metalness: 0.02,
    envMapIntensity: 0.35,
  });
  foliageMaterial.onBeforeCompile = makeSwayPatch(windUniforms, 0.075, 1.0);

  const cardMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: leafTexture,
    emissive: 0x1a0404,
    emissiveIntensity: 0.55,
    alphaTest: 0.38,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: 0.3,
  });
  cardMaterial.onBeforeCompile = makeSwayPatch(windUniforms, 0.11, 1.0);

  const clumpGeometry = new THREE.IcosahedronGeometry(1, 1);
  const cardGeometry = new THREE.PlaneGeometry(0.62, 0.62);

  const clumpInstances = [];
  const cardInstances = [];
  const treeData = [];

  MAPLES.forEach(([x, z, heightScale], treeIndex) => {
    const seed = 500 + treeIndex * 37;
    const tree = growTree(seed);
    const rand = tree.rand;

    const scale = heightScale;
    const barkGeometry = buildBarkGeometry(tree);
    barkGeometry.scale(scale, scale, scale);
    const barkMesh = new THREE.Mesh(barkGeometry, bark);
    barkMesh.position.set(x, WORLD.landLevel, z);
    barkMesh.castShadow = true;
    barkMesh.receiveShadow = true;
    group.add(barkMesh);

    const canopyCenter = new THREE.Vector3(0, 9.2 * scale, 0);
    const tips = tree.tips.map((tip) => tip.clone().multiplyScalar(scale));

    // 叶簇：一部分聚集在枝梢，一部分填充树冠内部
    for (let i = 0; i < FOLIAGE_PER_TREE; i++) {
      const tip = tips[Math.floor(rand() * tips.length)];
      const spread = 2.0 + rand() * 2.0;
      const position = makeCanopyPosition(tip, rand, spread).multiplyScalar(0.92);
      position.y = Math.min(position.y, 14.5 * scale);
      const r = 0.85 + rand() * 1.45;
      const color = new THREE.Color().setHSL(
        0.005 + rand() * 0.035,
        0.56 + rand() * 0.22,
        0.24 + rand() * 0.13,
      );
      clumpInstances.push({
        tree: treeIndex,
        position: position.add(new THREE.Vector3(x, WORLD.landLevel, z)),
        rotation: new THREE.Euler(rand() * 6.28, rand() * 6.28, rand() * 6.28),
        scale: new THREE.Vector3(r, r * (0.7 + rand() * 0.45), r),
        color,
      });
    }

    // 叶片卡片：加厚轮廓，让树冠边缘有细碎的叶形
    for (let i = 0; i < CARDS_PER_TREE; i++) {
      const tip = tips[Math.floor(rand() * tips.length)];
      const position = makeCanopyPosition(tip, rand, 4.6 + rand() * 1.4)
        .add(new THREE.Vector3(x, WORLD.landLevel, z));
      const color = new THREE.Color().setHSL(
        0.0 + rand() * 0.05,
        0.58 + rand() * 0.22,
        0.26 + rand() * 0.14,
      );
      cardInstances.push({
        tree: treeIndex,
        position,
        rotation: new THREE.Euler(
          (rand() - 0.5) * 1.5,
          rand() * 6.28,
          (rand() - 0.5) * 1.2,
        ),
        scale: 0.75 + rand() * 0.7,
        color,
      });
    }

    treeData.push({ x, z, scale, tips });
  });

  const dummy = new THREE.Object3D();

  const foliage = new THREE.InstancedMesh(
    clumpGeometry,
    foliageMaterial,
    clumpInstances.length,
  );
  clumpInstances.forEach((instance, index) => {
    dummy.position.copy(instance.position);
    dummy.rotation.copy(instance.rotation);
    dummy.scale.copy(instance.scale);
    dummy.updateMatrix();
    foliage.setMatrixAt(index, dummy.matrix);
    foliage.setColorAt(index, instance.color);
  });
  foliage.instanceMatrix.needsUpdate = true;
  foliage.instanceColor.needsUpdate = true;
  foliage.castShadow = true;
  foliage.receiveShadow = true;
  foliage.frustumCulled = false;
  group.add(foliage);

  const cards = new THREE.InstancedMesh(
    cardGeometry,
    cardMaterial,
    cardInstances.length,
  );
  cardInstances.forEach((instance, index) => {
    dummy.position.copy(instance.position);
    dummy.rotation.copy(instance.rotation);
    dummy.scale.setScalar(instance.scale);
    dummy.updateMatrix();
    cards.setMatrixAt(index, dummy.matrix);
    cards.setColorAt(index, instance.color);
  });
  cards.instanceMatrix.needsUpdate = true;
  cards.instanceColor.needsUpdate = true;
  cards.frustumCulled = false;
  group.add(cards);

  /* ---------------- 飘落的枫叶 ---------------- */

  const fallingGeometry = new THREE.PlaneGeometry(0.5, 0.5);
  const fallingMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: leafTexture,
    emissive: 0x160303,
    emissiveIntensity: 0.45,
    alphaTest: 0.38,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0.0,
  });
  const falling = new THREE.InstancedMesh(
    fallingGeometry,
    fallingMaterial,
    FALLING_COUNT,
  );
  falling.frustumCulled = false;
  falling.castShadow = false;
  group.add(falling);

  const rand = seededRandom(803);
  const state = [];
  for (let i = 0; i < FALLING_COUNT; i++) {
    state.push({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      spin: new THREE.Vector3(),
      scale: 0.7 + rand() * 0.6,
      phase: rand() * Math.PI * 2,
      floating: false,
      floatTime: 0,
      color: new THREE.Color().setHSL(
        0.0 + rand() * 0.05,
        0.58 + rand() * 0.22,
        0.26 + rand() * 0.14,
      ),
    });
    falling.setColorAt(i, state[i].color);
  }
  falling.instanceColor.needsUpdate = true;

  function resetLeaf(leaf, immediate = false) {
    const tree = treeData[Math.floor(rand() * treeData.length)];
    const tip = tree.tips[Math.floor(rand() * tree.tips.length)];
    leaf.position.set(
      tree.x + tip.x + (rand() - 0.5) * 2.2,
      WORLD.landLevel + tip.y + (rand() - 0.4) * 1.4,
      tree.z + tip.z + (rand() - 0.5) * 2.2,
    );
    leaf.velocity.set((rand() - 0.5) * 0.4, -0.25 - rand() * 0.35, (rand() - 0.5) * 0.4);
    leaf.rotation.set(rand() * 6.28, rand() * 6.28, rand() * 6.28);
    leaf.spin.set((rand() - 0.5) * 1.6, (rand() - 0.5) * 1.2, (rand() - 0.5) * 1.8);
    leaf.floating = false;
    leaf.floatTime = 0;
    if (immediate) {
      leaf.position.y = WORLD.landLevel + rand() * 10;
    }
  }

  state.forEach((leaf, index) => {
    resetLeaf(leaf, true);
    // 初始帧让叶片分布在不同高度，避免开场同时落下
    leaf.position.y -= rand() * 8;
    dummy.position.copy(leaf.position);
    dummy.rotation.copy(leaf.rotation);
    dummy.scale.setScalar(leaf.scale);
    dummy.updateMatrix();
    falling.setMatrixAt(index, dummy.matrix);
  });
  falling.instanceMatrix.needsUpdate = true;

  function update(delta, elapsed) {
    windUniforms.uWindTime.value = elapsed;
    windUniforms.uWindStrength.value = 0.85 + Math.sin(elapsed * 0.17) * 0.22;

    for (let i = 0; i < state.length; i++) {
      const leaf = state[i];
      const dt = Math.min(delta, 0.05);

      if (leaf.floating) {
        leaf.floatTime += dt;
        leaf.position.x += Math.sin(elapsed * 0.5 + leaf.phase) * 0.12 * dt;
        leaf.position.z += Math.cos(elapsed * 0.37 + leaf.phase) * 0.09 * dt;
        leaf.rotation.z += dt * 0.08;
        if (leaf.floatTime > 8 + (i % 5)) {
          resetLeaf(leaf);
        }
      } else {
        // 空气阻力 + 风 + 旋转
        leaf.velocity.y += -0.5 * dt;
        leaf.velocity.x += Math.sin(elapsed * 0.9 + leaf.phase) * 0.35 * dt;
        leaf.velocity.z += Math.cos(elapsed * 0.73 + leaf.phase * 1.3) * 0.28 * dt;
        leaf.velocity.multiplyScalar(1 - 0.7 * dt);
        leaf.velocity.y = Math.max(leaf.velocity.y, -1.3);
        leaf.position.addScaledVector(leaf.velocity, dt);
        leaf.rotation.x += leaf.spin.x * dt;
        leaf.rotation.y += leaf.spin.y * dt;
        leaf.rotation.z += leaf.spin.z * dt;

        if (leaf.position.y <= WORLD.waterLevel + 0.015) {
          leaf.position.y = WORLD.waterLevel + 0.015;
          leaf.velocity.set(0, 0, 0);
          leaf.floating = true;
          leaf.floatTime = 0;
          leaf.rotation.x = -Math.PI / 2 + (rand() - 0.5) * 0.15;
          leaf.rotation.z = rand() * 6.28;
        }
      }

      dummy.position.copy(leaf.position);
      dummy.rotation.copy(leaf.rotation);
      dummy.scale.setScalar(leaf.scale);
      dummy.updateMatrix();
      falling.setMatrixAt(i, dummy.matrix);
    }
    falling.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    foliage,
    cards,
    falling,
    treeData,
    windUniforms,
    update,
  };
}
