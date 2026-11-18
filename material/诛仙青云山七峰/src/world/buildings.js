import * as THREE from "three";
import { createMaterials } from "./materials.js";

/**
 * 中式宫观建筑构件库。
 *
 * 所有函数返回 THREE.Group，原点在建筑底面中心；默认朝向 +Z。
 * 屋顶是参数化歇山/庑殿曲面：坡面曲率 + 四角起翘，可叠成重檐。
 */

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const columnGeometry = new THREE.CylinderGeometry(0.42, 0.5, 1, 10);
const dummy = new THREE.Object3D();

function addBox(group, material, { x = 0, y = 0, z = 0, w = 1, h = 1, d = 1 }) {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function buildRoofSurface(width, depth, height, overhang, upturn) {
  const nx = 28;
  const nz = 20;
  const positions = [];
  const uvs = [];
  const indices = [];
  const halfWidth = width / 2 + overhang;
  const halfDepth = depth / 2 + overhang;
  const ridgeHalf = Math.max(0, halfWidth - halfDepth);

  for (let j = 0; j <= nz; j++) {
    const v = -1 + (2 * j) / nz;
    for (let i = 0; i <= nx; i++) {
      const u = -1 + (2 * i) / nx;
      const x = u * halfWidth;
      const z = v * halfDepth;
      // 歇山顶：正脊沿 X 方向，脊外再向两端收坡。
      const pastRidge = Math.max(0, Math.abs(x) - ridgeHalf);
      const edge = Math.min(
        1,
        Math.max(Math.abs(z), pastRidge) / halfDepth,
      );
      let y = height * (1 - Math.pow(edge, 1.35));
      y += upturn * Math.pow(Math.abs(u * v), 4) * 1.6;
      positions.push(x, y, z);
      uvs.push(
        ((u + 1) / 2) * Math.max(1, width / 6),
        ((v + 1) / 2) * Math.max(1, depth / 6),
      );
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 2;
      const d = a + nx + 1;
      indices.push(a, d, c, a, c, b);
    }
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

export function createPlatform({
  width = 20,
  depth = 12,
  height = 2.5,
  steps = 0,
} = {}) {
  const group = new THREE.Group();
  const materials = createMaterials();

  addBox(group, materials.darkStone, {
    y: 0.18,
    w: width + 1.8,
    h: 0.36,
    d: depth + 1.8,
  });
  addBox(group, materials.stone, {
    y: height / 2,
    w: width,
    h: height,
    d: depth,
  });
  addBox(group, materials.darkStone, {
    y: height - 0.12,
    w: width + 0.9,
    h: 0.24,
    d: depth + 0.9,
  });

  for (let i = 0; i < steps; i++) {
    const t = (steps - i) / (steps + 1);
    const stepHeight = height * t;
    addBox(group, materials.stone, {
      y: stepHeight / 2,
      z: depth / 2 + 0.9 + (i + 0.5) * 1.15,
      w: Math.min(width * 0.62, width - 2),
      h: stepHeight,
      d: 1.18,
    });
  }
  return group;
}

export function createRoof({
  width = 18,
  depth = 12,
  height = 6,
  tiers = 1,
  upturn = 0.6,
  overhang = 1.5,
} = {}) {
  const group = new THREE.Group();
  const materials = createMaterials();

  for (let tier = 0; tier < tiers; tier++) {
    const shrink = 1 - tier * 0.2;
    const tierWidth = width * shrink;
    const tierDepth = depth * shrink;
    const tierHeight = height * (tier === 0 ? 1 : 0.72);
    const baseY = tier * height * 0.64 + tier * 1.2;

    const surface = new THREE.Mesh(
      buildRoofSurface(tierWidth, tierDepth, tierHeight, overhang, upturn),
      materials.roof,
    );
    surface.position.y = baseY;
    surface.castShadow = true;
    surface.receiveShadow = true;
    group.add(surface);

    const ridgeLength = Math.max(0, tierWidth - tierDepth);
    if (ridgeLength > 1.5) {
      addBox(group, materials.roof, {
        y: baseY + tierHeight + 0.3,
        w: ridgeLength,
        h: 0.6,
        d: 0.7,
      });
    } else {
      const finial = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 8),
        materials.gold,
      );
      finial.position.y = baseY + tierHeight + 0.5;
      finial.castShadow = true;
      group.add(finial);
    }

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addBox(group, materials.gold, {
          x: sx * (tierWidth / 2 + overhang * 0.82),
          y: baseY + upturn * 1.55,
          z: sz * (tierDepth / 2 + overhang * 0.82),
          w: 0.38,
          h: 0.38,
          d: 0.38,
        });
      }
    }
  }
  return group;
}

export function createHall({
  width = 26,
  depth = 16,
  height = 8,
  bays = 5,
  roofHeight = 6,
  tiers = 1,
  steps = 3,
} = {}) {
  const group = new THREE.Group();
  const materials = createMaterials();
  const platformHeight = 2.2;
  group.add(
    createPlatform({
      width: width + 7,
      depth: depth + 6,
      height: platformHeight,
      steps,
    }),
  );

  const floorY = platformHeight;
  addBox(group, materials.wall, {
    y: floorY + height * 0.44,
    w: width * 0.92,
    h: height * 0.88,
    d: depth * 0.9,
  });

  const halfW = width * 0.46;
  const halfD = depth * 0.44;
  const columnPositions = [];
  for (let i = 0; i <= bays; i++) {
    const x = -halfW + (2 * halfW * i) / bays;
    columnPositions.push([x, halfD], [x, -halfD]);
  }
  for (const z of [-halfD * 0.55, 0, halfD * 0.55]) {
    columnPositions.push([-halfW, z], [halfW, z]);
  }

  const columns = new THREE.InstancedMesh(
    columnGeometry,
    materials.column,
    columnPositions.length,
  );
  columnPositions.forEach(([x, z], index) => {
    dummy.position.set(x, floorY + height / 2, z);
    dummy.scale.set(1, height, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    columns.setMatrixAt(index, dummy.matrix);
  });
  columns.castShadow = true;
  columns.receiveShadow = true;
  group.add(columns);

  addBox(group, materials.wood, {
    y: floorY + height * 0.97,
    w: width + 0.9,
    h: 0.85,
    d: depth + 0.9,
  });

  const panelWidth = (width * 0.82) / bays;
  for (let i = 0; i < bays; i++) {
    const x = -width * 0.41 + panelWidth * (i + 0.5);
    addBox(group, materials.lattice, {
      x,
      y: floorY + height * 0.46,
      z: halfD + 0.08,
      w: panelWidth * 0.7,
      h: height * 0.5,
      d: 0.16,
    });
  }
  addBox(group, materials.wall, {
    y: floorY + height * 0.4,
    z: halfD + 0.16,
    w: width * 0.16,
    h: height * 0.64,
    d: 0.2,
  });

  const roof = createRoof({
    width: width + 2,
    depth: depth + 2,
    height: roofHeight,
    tiers,
    upturn: 0.72,
    overhang: 3,
  });
  roof.position.y = floorY + height + 0.55;
  group.add(roof);
  return group;
}

export function createGate({ width = 12, height = 9, text = "青云" } = {}) {
  const group = new THREE.Group();
  const materials = createMaterials();

  for (const sx of [-1, 1]) {
    addBox(group, materials.stone, {
      x: sx * (width / 2),
      y: height / 2,
      w: 2,
      h: height,
      d: 2,
    });
    addBox(group, materials.darkStone, {
      x: sx * (width / 2),
      y: 0.35,
      w: 3,
      h: 0.7,
      d: 3,
    });
  }
  addBox(group, materials.wood, {
    y: height,
    w: width + 3,
    h: 1.2,
    d: 2.2,
  });

  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.5, width * 0.2),
    materials.makePlaque(text),
  );
  plaque.position.set(0, height - 1.3, 1.15);
  group.add(plaque);

  const roof = createRoof({
    width: width + 5,
    depth: 7,
    height: 3.6,
    tiers: 1,
    upturn: 0.5,
    overhang: 1.2,
  });
  roof.position.y = height + 1.1;
  group.add(roof);
  return group;
}

export function createPavilion({
  radius = 5,
  height = 5,
  tiers = 1,
  roofHeight = 3.6,
} = {}) {
  const group = new THREE.Group();
  const materials = createMaterials();

  group.add(
    createPlatform({
      width: radius * 2 + 2,
      depth: radius * 2 + 2,
      height: 1.2,
      steps: 2,
    }),
  );

  const columnTop = 1.2 + height;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(group, materials.column, {
        x: sx * radius * 0.8,
        z: sz * radius * 0.8,
        y: 1.2 + height / 2,
        w: 0.6,
        h: height,
        d: 0.6,
      });
    }
  }
  addBox(group, materials.wood, {
    y: columnTop,
    w: radius * 2,
    h: 0.6,
    d: radius * 2,
  });

  const balustrade = createBalustrade({
    points: [
      new THREE.Vector3(-radius * 0.85, 1.2, radius * 0.85),
      new THREE.Vector3(radius * 0.85, 1.2, radius * 0.85),
      new THREE.Vector3(radius * 0.85, 1.2, -radius * 0.85),
      new THREE.Vector3(-radius * 0.85, 1.2, -radius * 0.85),
      new THREE.Vector3(-radius * 0.85, 1.2, radius * 0.85),
    ],
    height: 1,
  });
  group.add(balustrade);

  const roof = createRoof({
    width: radius * 2.6,
    depth: radius * 2.6,
    height: roofHeight,
    tiers,
    upturn: 0.7,
    overhang: 1.1,
  });
  roof.position.y = columnTop + 0.4;
  group.add(roof);
  return group;
}

export function createPagoda({ radius = 4, levels = 5 } = {}) {
  const group = new THREE.Group();
  const materials = createMaterials();
  const base = createPlatform({
    width: radius * 2.4,
    depth: radius * 2.4,
    height: 2,
    steps: 3,
  });
  group.add(base);

  let y = 2;
  for (let level = 0; level < levels; level++) {
    const shrink = 1 - level * 0.11;
    const width = radius * 2 * shrink;
    addBox(group, level % 2 === 0 ? materials.wall : materials.wood, {
      y: y + 2.2,
      w: width * 0.86,
      h: 4.4,
      d: width * 0.86,
    });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addBox(group, materials.column, {
          x: sx * width * 0.42,
          z: sz * width * 0.42,
          y: y + 2.2,
          w: 0.35,
          h: 4.4,
          d: 0.35,
        });
      }
    }
    const roof = createRoof({
      width: width * 1.25,
      depth: width * 1.25,
      height: 2.4,
      tiers: 1,
      upturn: 0.45,
      overhang: 1,
    });
    roof.position.y = y + 4.4;
    group.add(roof);
    y += 6.2;
  }

  const finial = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 3.2, 8),
    materials.gold,
  );
  finial.position.y = y + 1.4;
  finial.castShadow = true;
  group.add(finial);
  return group;
}

export function createStaircase({
  from = new THREE.Vector3(),
  to = new THREE.Vector3(0, 0, 10),
  width = 4,
  risers = 10,
  surfaceAt = null,
} = {}) {
  const group = new THREE.Group();
  const materials = createMaterials();
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const horizontal = Math.hypot(dx, dz);
  const rise = to.y - from.y;
  const stepRise = rise / risers;
  const stepDepth = horizontal / risers;

  group.position.copy(from);
  group.rotation.y = Math.atan2(dx, dz);

  for (let i = 0; i < risers; i++) {
    const z = stepDepth * (i + 0.5);
    const fallbackTop = stepRise * (i + 1);
    const topY = surfaceAt ? surfaceAt(z) : fallbackTop;

    if (surfaceAt) {
      // 沿山体表面铺台阶：每级是一块薄踏板，避免在陡崖上生成巨型方块。
      addBox(group, materials.stone, {
        y: topY - 0.3,
        z,
        w: width,
        h: 0.6,
        d: stepDepth + 0.05,
      });
      for (const sx of [-1, 1]) {
        addBox(group, materials.darkStone, {
          x: (sx * width) / 2,
          y: topY + 0.55,
          z,
          w: 0.35,
          h: 1.1,
          d: stepDepth + 0.05,
        });
      }
    } else {
      const height = Math.max(0.4, fallbackTop);
      addBox(group, materials.stone, {
        y: topY - height / 2,
        z,
        w: width,
        h: height,
        d: stepDepth + 0.04,
      });
    }
  }
  return group;
}

export function createBalustrade({ points = [], height = 1.1 } = {}) {
  const group = new THREE.Group();
  const materials = createMaterials();
  if (points.length < 2) return group;

  const spacing = 3;
  for (let s = 0; s < points.length - 1; s++) {
    const a = points[s];
    const b = points[s + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const count = Math.max(1, Math.round(length / spacing));
    const angle = Math.atan2(dx, dz);

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      addBox(group, materials.stone, {
        x: a.x + dx * t,
        y: a.y + height / 2,
        z: a.z + dz * t,
        w: 0.3,
        h: height,
        d: 0.3,
      });
    }

    const rail = new THREE.Mesh(unitBox, materials.stone);
    rail.scale.set(0.2, 0.16, length);
    rail.rotation.y = angle;
    rail.position.set(
      (a.x + b.x) / 2,
      (a.y + b.y) / 2 + height * 0.78,
      (a.z + b.z) / 2,
    );
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
  }
  return group;
}

export function createBridge({
  from = new THREE.Vector3(),
  to = new THREE.Vector3(0, 0, 20),
  width = 4,
  arch = 2,
} = {}) {
  const group = new THREE.Group();
  const materials = createMaterials();
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  const segments = 16;
  group.position.copy(from);
  group.rotation.y = Math.atan2(dx, dz);

  const segmentLength = length / segments;
  for (let i = 0; i < segments; i++) {
    const t = (i + 0.5) / segments;
    addBox(group, materials.wood, {
      y: Math.sin(Math.PI * t) * arch,
      z: segmentLength * (i + 0.5),
      w: width,
      h: 0.5,
      d: segmentLength + 0.08,
    });
    for (const sx of [-1, 1]) {
      addBox(group, materials.darkStone, {
        x: (sx * width) / 2,
        y: Math.sin(Math.PI * t) * arch + 0.75,
        z: segmentLength * (i + 0.5),
        w: 0.22,
        h: 1.1,
        d: 0.22,
      });
    }
  }
  return group;
}

export function createLantern({ height = 4, color = 0xffb066 } = {}) {
  const group = new THREE.Group();
  const materials = createMaterials();
  addBox(group, materials.darkWood ?? materials.wall, {
    y: height / 2,
    w: 0.22,
    h: height,
    d: 0.22,
  });
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.6), material);
  lamp.position.y = height + 0.3;
  group.add(lamp);
  addBox(group, materials.darkStone, {
    y: height + 0.78,
    w: 0.8,
    h: 0.18,
    d: 0.8,
  });
  return { group, material, lamp };
}

export function createIncenseBurner({ size = 3 } = {}) {
  const group = new THREE.Group();
  const materials = createMaterials();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(size * 0.9, size, 0.5, 12),
    materials.darkStone,
  );
  base.position.y = 0.25;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(size * 0.62, size * 0.42, size * 0.6, 12),
    materials.gold,
  );
  bowl.position.y = size * 0.55;
  bowl.castShadow = true;
  group.add(bowl);

  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    addBox(group, materials.darkStone, {
      x: Math.cos(angle) * size * 0.5,
      z: Math.sin(angle) * size * 0.5,
      y: size * 0.16,
      w: 0.3,
      h: size * 0.32,
      d: 0.3,
    });
  }

  const lid = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.5, size * 0.5, 12),
    materials.gold,
  );
  lid.position.y = size * 0.95;
  lid.castShadow = true;
  group.add(lid);
  return group;
}

export function createStele({ width = 3, height = 5, text = "青云" } = {}) {
  const group = new THREE.Group();
  const materials = createMaterials();
  addBox(group, materials.darkStone, {
    y: 0.4,
    w: width * 1.4,
    h: 0.8,
    d: width * 0.5,
  });
  addBox(group, materials.stone, {
    y: height / 2 + 0.8,
    w: width,
    h: height,
    d: width * 0.28,
  });
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.72, height * 0.72),
    materials.makePlaque(text),
  );
  plaque.position.set(0, height * 0.58 + 0.8, width * 0.15);
  group.add(plaque);
  return group;
}
