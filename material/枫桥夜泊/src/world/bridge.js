import * as THREE from "three";
import { LAYOUT, WORLD } from "../config.js";
import { seededRandom } from "../utils/textures.js";
import { mergeMeshes, stoneMaterial } from "./materials.js";

/**
 * 枫桥。
 *
 * 单孔石拱桥：主拱圈用自定义 BufferGeometry 沿弧线生成拱腹与两侧
 * 券脸；桥面由逐块旋转、微错位的石板拼成；栏杆、望柱、桥台全部
 * 使用石材，并以固定 seed 制造不规则的砌筑感。
 */

const PEAK = Math.max(LAYOUT.bridge.rise, 7.2);
const END_Y = WORLD.landLevel + 0.35;
const HALF_SPAN = 37;
const DECK_WIDTH = LAYOUT.bridge.width;

function deckHeightAt(u) {
  // u = 0 南岸，1 北岸
  return END_Y + (PEAK - END_Y) * Math.pow(Math.sin(Math.PI * u), 0.72);
}

function createArchGeometry() {
  const span = 17.2;
  const rise = 5.35;
  const baseY = WORLD.waterLevel + 0.45;
  const thickness = 1.5;
  const width = DECK_WIDTH - 0.6;
  const segments = 64;

  const radius = (span * span + rise * rise) / (2 * rise);
  const centerY = baseY + rise - radius;
  const theta0 = Math.asin(span / radius);

  const positions = [];
  const uvs = [];
  const indices = [];

  // 每个截面：内侧/外侧 × 左/右
  for (let i = 0; i <= segments; i++) {
    const theta = -theta0 + (2 * theta0 * i) / segments;
    const z = Math.sin(theta) * radius;
    const y = centerY + Math.cos(theta) * radius;
    const yOuter = centerY + Math.cos(theta) * (radius + thickness);

    // inner left, inner right, outer left, outer right
    positions.push(-width / 2, y, z);
    positions.push(width / 2, y, z);
    positions.push(-width / 2, yOuter, z);
    positions.push(width / 2, yOuter, z);

    const u = (i / segments) * 7;
    uvs.push(u, 0, u, 1, u, 0, u, 1);
  }

  const stride = 4;
  for (let i = 0; i < segments; i++) {
    const a = i * stride;
    const b = (i + 1) * stride;

    // 拱腹（从桥下仰视）
    indices.push(a, a + 1, b, a + 1, b + 1, b);
    // 南侧券脸
    indices.push(a + 2, a, b + 2, a, b, b + 2);
    // 北侧券脸（x = +width/2）
    indices.push(a + 1, a + 3, b + 1, a + 3, b + 3, b + 1);
    // 拱背（藏在桥面下）
    indices.push(a + 3, a + 2, b + 3, a + 2, b + 2, b + 3);
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

function createDeck() {
  const slabs = [];
  const rand = seededRandom(211);
  const count = 44;
  const length = (HALF_SPAN * 2) / count;

  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count;
    const z = -HALF_SPAN + u * HALF_SPAN * 2;
    const y = deckHeightAt(u);
    const du = 0.001;
    const slope =
      (deckHeightAt(Math.min(1, u + du)) - deckHeightAt(Math.max(0, u - du))) /
      (2 * du * HALF_SPAN * 2);
    const angle = Math.atan(slope);

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(
        DECK_WIDTH + (rand() - 0.5) * 0.22,
        0.42,
        length * 1.04,
      ),
    );
    slab.position.set(
      LAYOUT.bridge.x + (rand() - 0.5) * 0.12,
      y - 0.21 + (rand() - 0.5) * 0.025,
      z,
    );
    slab.rotation.x = -angle;
    slab.rotation.y = (rand() - 0.5) * 0.006;
    slabs.push(slab);

    // 桥面石板之间的深色缝隙
    if (i < count - 1) {
      const gap = new THREE.Mesh(
        new THREE.BoxGeometry(DECK_WIDTH + 0.1, 0.02, 0.09),
      );
      gap.position.set(LAYOUT.bridge.x, y - 0.005, z + length * 0.5);
      gap.rotation.x = -angle;
      slabs.push(gap);
    }
  }

  return slabs;
}

function createParapets() {
  const posts = [];
  const rails = [];
  const rand = seededRandom(223);
  const steps = 40;

  for (const side of [-1, 1]) {
    const x = LAYOUT.bridge.x + side * (DECK_WIDTH / 2 - 0.28);
    let previous = null;

    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const z = -HALF_SPAN + u * HALF_SPAN * 2;
      const y = deckHeightAt(u);

      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 1.0 + rand() * 0.08, 0.34),
      );
      post.position.set(x + (rand() - 0.5) * 0.05, y + 0.5, z);
      posts.push(post);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.42));
      cap.position.set(x, y + 1.08, z);
      posts.push(cap);

      const current = { z, y };
      if (previous) {
        const midZ = (previous.z + current.z) / 2;
        const midY = (previous.y + current.y) / 2;
        const dz = current.z - previous.z;
        const dy = current.y - previous.y;
        const len = Math.hypot(dz, dy);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.17, len + 0.1));
        rail.position.set(x, midY + 0.78, midZ);
        rail.rotation.x = -Math.atan2(dy, dz);
        rails.push(rail);
      }
      previous = current;
    }
  }

  return { posts, rails };
}

function createAbutments() {
  const group = new THREE.Group();
  const material = stoneMaterial(0xa89f8e, { map: "stone", repeat: [2, 1] });

  for (const side of [-1, 1]) {
    const z = side * (HALF_SPAN - 2.4);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_WIDTH + 4.2, 3.6, 9),
      material,
    );
    base.position.set(LAYOUT.bridge.x, WORLD.waterLevel + 1.1, z);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_WIDTH + 7.6, 2.4, 5.4),
      material,
    );
    wing.position.set(LAYOUT.bridge.x, WORLD.waterLevel + 0.5, z + side * 5.6);
    wing.receiveShadow = true;
    group.add(wing);
  }

  return group;
}

export function createBridge() {
  const group = new THREE.Group();
  group.name = "MapleBridge";

  const archMaterial = stoneMaterial(0xb8ae9c, {
    map: "stone",
    repeat: [3, 1],
  });
  const arch = new THREE.Mesh(createArchGeometry(), archMaterial);
  arch.position.x = LAYOUT.bridge.x;
  arch.castShadow = true;
  arch.receiveShadow = true;
  group.add(arch);

  group.add(createAbutments());

  const deckMaterial = stoneMaterial(0xb0a795, {
    map: "stone",
    repeat: [1.2, 1.2],
  });
  group.add(mergeMeshes(createDeck(), deckMaterial));

  const parapetMaterial = stoneMaterial(0xbdb3a1, {
    map: "stoneFine",
    repeat: [1, 1],
  });
  const { posts, rails } = createParapets();
  group.add(mergeMeshes(posts, parapetMaterial, { castShadow: true }));
  group.add(mergeMeshes(rails, parapetMaterial, { castShadow: true }));

  // 桥头被月光照亮的石阶
  const stepMaterial = stoneMaterial(0xaea595, {
    map: "stoneFine",
    repeat: [2, 0.4],
  });
  const steps = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(DECK_WIDTH + 2.4, 0.2, 0.9));
      step.position.set(
        LAYOUT.bridge.x,
        END_Y - 0.1 - i * 0.19,
        side * (HALF_SPAN - 0.4 + i * 0.86),
      );
      steps.push(step);
    }
  }
  group.add(mergeMeshes(steps, stepMaterial));

  // 桥上的小石灯：唯一一点暖色，给空间一个尺度参照
  const lanternStone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.42, 1.1, 6),
    stoneMaterial(0x766f63, { map: "stoneFine" }),
  );
  lanternStone.position.set(
    LAYOUT.bridge.x - DECK_WIDTH / 2 + 0.7,
    deckHeightAt(0.38) + 0.55,
    -HALF_SPAN + 0.38 * HALF_SPAN * 2,
  );
  group.add(lanternStone);

  const lanternGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb06a }),
  );
  lanternGlow.position.copy(lanternStone.position).add(new THREE.Vector3(0, 0.7, 0));
  group.add(lanternGlow);

  return {
    group,
    arch,
    lanternPosition: lanternGlow.position.clone(),
    deckHeightAt,
    layout: LAYOUT.bridge,
  };
}
