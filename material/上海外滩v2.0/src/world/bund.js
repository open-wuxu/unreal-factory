import * as THREE from "three";
import { river } from "./river.js";
import { WORLD } from "../config.js";
import { scaleUVs } from "../utils/textures.js";
import {
  emissiveMaterial,
  facadeMaterial,
  metalMaterial,
  stoneMaterial,
} from "./materials.js";

/**
 * 外滩历史建筑群。
 *
 * 建筑沿黄浦江左侧（浦西一侧）岸线连续排布，正面朝向江面，
 * 因此每一栋都按河道切线旋转，形成一条贴合河岸的弧形天际线，
 * 而不是孤立摆放的模型。
 */

const L = WORLD.landLevel;

/** 立面泛光渐变：底部暖金，向上淡出。 */
function createWashTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 256, 0, 0);
  gradient.addColorStop(0, "rgba(255,198,122,0.9)");
  gradient.addColorStop(0.3, "rgba(255,188,104,0.36)");
  gradient.addColorStop(0.72, "rgba(255,172,82,0.08)");
  gradient.addColorStop(1, "rgba(255,172,82,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ */
/* 屋顶构件（局部坐标，+Z 为临江立面）                                 */
/* ------------------------------------------------------------------ */

function addDome(group, { y, radius, copper = true }) {
  const material = copper
    ? new THREE.MeshStandardMaterial({
        color: 0x5f8271,
        metalness: 0.55,
        roughness: 0.55,
      })
    : stoneMaterial(0xbdb4a4, 0.8);

  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius, radius * 0.55, 20),
    material,
  );
  drum.position.set(0, y + radius * 0.27, 0);
  drum.castShadow = true;
  group.add(drum);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    material,
  );
  dome.position.set(0, y + radius * 0.55, 0);
  dome.castShadow = true;
  group.add(dome);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.7, radius * 0.55, 8),
    metalMaterial(0x2f2f33, 0.5, 0.8),
  );
  cap.position.set(0, y + radius * 1.35, 0);
  group.add(cap);
}

function addPyramidRoof(group, { y, radius, height }) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x4f7767,
    metalness: 0.5,
    roughness: 0.55,
  });
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 4),
    material,
  );
  roof.position.set(0, y + height / 2, 0);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  const tip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.5, height * 0.5, 6),
    metalMaterial(0x9b8348, 0.4, 0.9),
  );
  tip.position.set(0, y + height + height * 0.2, 0);
  group.add(tip);
}

function addClockTower(group, { z, roofY, width = 13, height = 22 }) {
  const towerMaterial = facadeMaterial("stonePale", {
    tint: 0xf1e6d0,
    roughness: 0.72,
    metalness: 0.06,
  });
  const towerGeometry = new THREE.BoxGeometry(width, height, width);
  scaleUVs(towerGeometry, 1.4, 1.4);
  const tower = new THREE.Mesh(towerGeometry, towerMaterial);
  tower.position.set(0, roofY + height / 2, z);
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(width + 2, 1.6, width + 2),
    stoneMaterial(0xd8cdb8, 0.78),
  );
  cap.position.set(0, roofY + height + 0.8, z);
  group.add(cap);

  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(width * 0.42, width * 0.46, 5, 16),
    stoneMaterial(0xd8cdb8, 0.78),
  );
  drum.position.set(0, roofY + height + 4, z);
  drum.castShadow = true;
  group.add(drum);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(width * 0.44, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x507264,
      metalness: 0.55,
      roughness: 0.5,
    }),
  );
  dome.position.set(0, roofY + height + 6.5, z);
  group.add(dome);

  // 钟面朝向黄浦江（局部 +Z）
  const clockMaterial = emissiveMaterial(0xfff3cf, {
    type: "lamp",
    base: 0.9,
    baseColor: 0x2a2418,
    roughness: 0.6,
  });
  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 32),
    clockMaterial,
  );
  clockFace.position.set(0, roofY + height * 0.66, z + width / 2 + 0.06);
  group.add(clockFace);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.22, 6, 32),
    metalMaterial(0x4a4133, 0.5, 0.6),
  );
  ring.position.copy(clockFace.position);
  group.add(ring);

  const handMaterial = metalMaterial(0x25211a, 0.6, 0.5);
  const hourHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.8, 0.5),
    handMaterial,
  );
  hourHand.position.set(
    0,
    roofY + height * 0.66 + 0.5,
    z + width / 2 + 0.12,
  );
  group.add(hourHand);

  const minuteHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 2.7, 0.5),
    handMaterial,
  );
  minuteHand.position.set(
    0,
    roofY + height * 0.66 + 0.7,
    z + width / 2 + 0.12,
  );
  minuteHand.rotation.x = Math.PI / 2.6;
  group.add(minuteHand);
}

/* ------------------------------------------------------------------ */
/* 单栋建筑                                                            */
/* ------------------------------------------------------------------ */

function createBundBuilding(spec, washMaterial, columnTransforms) {
  const group = new THREE.Group();
  const { width, depth, height, style, kind, tint } = spec;

  const facade = facadeMaterial(kind, {
    tint,
    roughness: 0.78,
    metalness: 0.06,
    envMapIntensity: 0.55,
    emissiveBase: 0.9,
  });

  const geometry = new THREE.BoxGeometry(width, height, depth, 2, 4, 1);
  scaleUVs(geometry, Math.max(1, width / 26), Math.max(1, height / 16));

  const body = new THREE.Mesh(geometry, facade);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 基座
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width + 2.4, 2.4, depth + 2.4),
    stoneMaterial(0x998d7b, 0.9),
  );
  base.position.y = 1.2;
  base.receiveShadow = true;
  group.add(base);

  // 檐口
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(width + 2.2, 1.8, depth + 2.2),
    stoneMaterial(0xd3c6ae, 0.85),
  );
  cornice.position.y = height + 0.4;
  cornice.castShadow = true;
  group.add(cornice);

  const roofY = height + 1.3;

  // 夜间暖色泛光（临江面 + 背立面）
  const wash = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.94, height * 0.94),
    washMaterial,
  );
  wash.position.set(0, height * 0.5, depth / 2 + 0.45);
  wash.renderOrder = 2;
  group.add(wash);

  const washBack = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.94, height * 0.94),
    washMaterial,
  );
  washBack.position.set(0, height * 0.5, -depth / 2 - 0.45);
  washBack.rotation.y = Math.PI;
  washBack.renderOrder = 2;
  group.add(washBack);

  // 屋顶女儿墙
  const parapet = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.94, 1.2, depth * 0.94),
    stoneMaterial(0xb9ac96, 0.9),
  );
  parapet.position.y = roofY + 0.6;
  parapet.castShadow = true;
  group.add(parapet);

  // 柱廊（局部坐标记录，稍后转世界坐标合批）
  if (style === "classic" || style === "clock") {
    const count = 6;
    const span = width * 0.72;
    const columnHeight = height * 0.62;
    for (let i = 0; i < count; i++) {
      columnTransforms.push({
        x: -span / 2 + (span / (count - 1)) * i,
        y: 2.2 + columnHeight / 2,
        z: depth / 2 + 1.1,
        height: columnHeight,
        group,
      });
    }
  }

  // 三角山花
  if (style === "classic" && width > 56) {
    const pedimentShape = new THREE.Shape();
    pedimentShape.moveTo(-width * 0.34, 0);
    pedimentShape.lineTo(width * 0.34, 0);
    pedimentShape.lineTo(0, width * 0.14);
    pedimentShape.closePath();
    const pedimentGeometry = new THREE.ExtrudeGeometry(pedimentShape, {
      depth: 2.6,
      bevelEnabled: false,
      steps: 1,
    });
    const pediment = new THREE.Mesh(
      pedimentGeometry,
      stoneMaterial(0xd6c9b1, 0.84),
    );
    pediment.position.set(0, roofY + 1.2, depth / 2 - 2.6);
    pediment.castShadow = true;
    group.add(pediment);
  }

  if (style === "dome") {
    addDome(group, {
      y: roofY + 1,
      radius: Math.min(width, depth) * 0.27,
      copper: spec.copper !== false,
    });
  }

  if (style === "pyramid") {
    addPyramidRoof(group, {
      y: roofY + 1,
      radius: Math.min(width, depth) * 0.42,
      height: 22,
    });
  }

  if (style === "clock") {
    addClockTower(group, {
      z: 0,
      roofY,
      width: 13,
      height: 22,
    });
  }

  // 屋顶小构件
  if (Math.random() > 0.5) {
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(5, 3, 7),
      stoneMaterial(0xa89c88, 0.9),
    );
    vent.position.set(width * 0.2, roofY + 2.5, -depth * 0.2);
    group.add(vent);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/* 组装                                                                */
/* ------------------------------------------------------------------ */

export function createBund(scene) {
  const group = new THREE.Group();
  group.name = "TheBund";

  const specs = [
    { width: 66, depth: 54, height: 31, style: "classic", kind: "stoneWarm", tint: 0xf4e6cc },
    { width: 58, depth: 50, height: 26, style: "brick", kind: "brick", tint: 0xffe9dd },
    { width: 62, depth: 56, height: 35, style: "dome", kind: "stonePale", tint: 0xf3ead8 },
    { width: 58, depth: 50, height: 29, style: "classic", kind: "stoneWarm", tint: 0xf7ead2 },
    { width: 64, depth: 58, height: 34, style: "pyramid", kind: "stonePale", tint: 0xf6ecd9 },
    { width: 56, depth: 50, height: 27, style: "classic", kind: "stoneWarm", tint: 0xf0e2c8 },
    { width: 60, depth: 52, height: 30, style: "brick", kind: "brick", tint: 0xffe4d2 },
    { width: 64, depth: 56, height: 33, style: "classic", kind: "stonePale", tint: 0xf5ecd9 },
    { width: 68, depth: 58, height: 36, style: "clock", kind: "stonePale", tint: 0xf8eeda },
    { width: 58, depth: 50, height: 28, style: "classic", kind: "stoneWarm", tint: 0xf2e4ca },
    { width: 62, depth: 54, height: 32, style: "dome", kind: "stonePale", tint: 0xf4ead6, copper: false },
    { width: 56, depth: 50, height: 26, style: "classic", kind: "stoneWarm", tint: 0xf5e7cd },
    { width: 60, depth: 52, height: 31, style: "brick", kind: "brick", tint: 0xffe6d4 },
    { width: 62, depth: 54, height: 29, style: "classic", kind: "stonePale", tint: 0xf4ebd7 },
    { width: 58, depth: 50, height: 27, style: "dome", kind: "stoneWarm", tint: 0xf3e5cb, copper: true },
    { width: 64, depth: 54, height: 33, style: "classic", kind: "stonePale", tint: 0xf7eeda },
  ];

  const washMaterial = new THREE.MeshBasicMaterial({
    map: createWashTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const columnTransforms = [];
  const gap = 15;
  const uStart = 0.246;
  let travelled = 0;

  for (const spec of specs) {
    const centerMeters = travelled + spec.width / 2;
    const u = uStart + centerMeters / river.length;
    const bank = river.bankPoint(u, 1, 0);
    const n = river.normalAt(u);
    const faceDir = n.clone().negate(); // 朝向江面
    const setback = 78 + spec.depth / 2;

    const building = createBundBuilding(spec, washMaterial, columnTransforms);
    building.position.set(
      bank.x + faceDir.x * setback,
      L,
      bank.z + faceDir.z * setback,
    );
    building.rotation.y = Math.atan2(faceDir.x, faceDir.z);
    building.updateMatrixWorld(true);
    group.add(building);

    // 柱廊转换到世界坐标
    for (const transform of columnTransforms) {
      if (transform.group !== building) continue;
      const world = building.localToWorld(
        new THREE.Vector3(transform.x, transform.y, transform.z),
      );
      transform.world = world;
    }

    travelled += spec.width + gap;
  }

  /* 柱廊：一个 InstancedMesh 完成所有历史建筑立柱 */
  const columnGeometry = new THREE.CylinderGeometry(0.72, 0.86, 1, 12);
  const columnMaterial = stoneMaterial(0xd9ccb4, 0.86);
  const columns = new THREE.InstancedMesh(
    columnGeometry,
    columnMaterial,
    columnTransforms.length,
  );
  const dummy = new THREE.Object3D();
  columnTransforms.forEach((transform, index) => {
    dummy.position.copy(transform.world);
    dummy.scale.set(1, transform.height, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    columns.setMatrixAt(index, dummy.matrix);
  });
  columns.instanceMatrix.needsUpdate = true;
  columns.castShadow = true;
  columns.receiveShadow = true;
  group.add(columns);

  scene.add(group);

  return {
    group,
    washMaterial,
    update(elapsed, state) {
      washMaterial.opacity = Math.min(0.62, state.lampIntensity * 0.42);
    },
  };
}
