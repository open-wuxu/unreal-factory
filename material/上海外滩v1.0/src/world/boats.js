import * as THREE from "three";
import { RIVER } from "../config.js";
import { createGlowTexture } from "../utils/textures.js";
import { emissiveMaterial, metalMaterial } from "./materials.js";

/** 船体俯视轮廓，挤出成带船艏的船壳。 */
function createHullGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-5, -13);
  shape.lineTo(5, -13);
  shape.lineTo(5, 5);
  shape.quadraticCurveTo(5, 12, 0, 14);
  shape.quadraticCurveTo(-5, 12, -5, 5);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 3.2,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 8,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createBoat({
  hullColor = 0xf2f4f6,
  stripeColor = 0x1f5d8a,
  cabinLevels = 2,
  scale = 1,
}) {
  const group = new THREE.Group();

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: hullColor,
    metalness: 0.18,
    roughness: 0.45,
  });
  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: stripeColor,
    metalness: 0.3,
    roughness: 0.4,
  });
  const windowMaterial = emissiveMaterial(0xffe0a4, {
    type: "boat",
    base: 1.5,
    baseColor: 0x1c150c,
    roughness: 0.4,
  });

  const hull = new THREE.Mesh(createHullGeometry(), hullMaterial);
  hull.position.y = 1.7;
  group.add(hull);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(10.1, 0.6, 24),
    stripeMaterial,
  );
  stripe.position.y = 1.1;
  group.add(stripe);

  // 甲板舱室
  let topY = 1.7;
  const cabinMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9eef2,
    metalness: 0.1,
    roughness: 0.5,
  });

  for (let level = 0; level < cabinLevels; level++) {
    const shrink = 1 - level * 0.14;
    const height = 2.4;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(8.4 * shrink, height, 16 * shrink),
      cabinMaterial,
    );
    cabin.position.set(0, topY + height / 2, level === 0 ? 0.5 : -0.4);
    group.add(cabin);

    const windows = new THREE.Mesh(
      new THREE.BoxGeometry(
        8.5 * shrink,
        height * 0.42,
        16.1 * shrink,
      ),
      windowMaterial,
    );
    windows.position.set(
      0,
      topY + height * 0.58,
      level === 0 ? 0.5 : -0.4,
    );
    group.add(windows);

    // 白色遮阳顶
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(8.9 * shrink, 0.3, 16.6 * shrink),
      cabinMaterial,
    );
    roof.position.set(
      0,
      topY + height + 0.15,
      level === 0 ? 0.5 : -0.4,
    );
    group.add(roof);

    topY += height + 0.3;
  }

  // 桅杆与信号灯
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 6, 6),
    metalMaterial(0x8b949c, 0.4, 0.8),
  );
  mast.position.set(0, topY + 3, -1);
  group.add(mast);

  const mastLightMaterial = emissiveMaterial(0xfff3d0, {
    type: "boat",
    base: 1.4,
    baseColor: 0x1c1a12,
  });
  const mastLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    mastLightMaterial,
  );
  mastLight.position.set(0, topY + 6, -1);
  group.add(mastLight);

  const portLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    emissiveMaterial(0xff3b30, {
      type: "boat",
      base: 1.6,
      baseColor: 0x200604,
    }),
  );
  portLight.position.set(-5.05, 1.9, 6);
  group.add(portLight);

  const starboardLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    emissiveMaterial(0x35ff8a, {
      type: "boat",
      base: 1.6,
      baseColor: 0x04180c,
    }),
  );
  starboardLight.position.set(5.05, 1.9, 6);
  group.add(starboardLight);

  // 尾流：一块被拉长的光晕平面
  const wakeMaterial = new THREE.MeshBasicMaterial({
    map: createGlowTexture(
      "rgba(225,240,255,0.55)",
      "rgba(190,225,245,0.16)",
      "rgba(160,205,235,0)",
    ),
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(14, 44), wakeMaterial);
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, 0.12, -30);
  group.add(wake);

  group.scale.setScalar(scale);
  group.userData.wakeMaterial = wakeMaterial;

  return group;
}

export function createBoats(scene) {
  const group = new THREE.Group();
  group.name = "Boats";

  const definitions = [
    {
      x: -74,
      z: -2100,
      speed: 8.5,
      heading: 0,
      axis: "z",
      cabinLevels: 2,
      hullColor: 0xf4f6f8,
      stripeColor: 0x1f5d8a,
      scale: 1.15,
    },
    {
      x: 66,
      z: 1800,
      speed: -7.2,
      heading: Math.PI,
      axis: "z",
      cabinLevels: 2,
      hullColor: 0xeceff2,
      stripeColor: 0x8b2f3a,
      scale: 0.95,
    },
    {
      x: -18,
      z: 400,
      speed: 5.6,
      heading: 0,
      axis: "z",
      cabinLevels: 3,
      hullColor: 0xf6f7f8,
      stripeColor: 0x2b6e6a,
      scale: 1.3,
    },
    {
      x: 112,
      z: -900,
      speed: -6.4,
      heading: Math.PI,
      axis: "z",
      cabinLevels: 1,
      hullColor: 0xdfe6ee,
      stripeColor: 0x2a3d6b,
      scale: 0.8,
    },
    {
      x: -160,
      z: -560,
      speed: 4.2,
      heading: Math.PI / 2,
      axis: "x",
      cabinLevels: 2,
      hullColor: 0xf2eee6,
      stripeColor: 0x9a6b2f,
      scale: 0.75,
    },
  ];

  const boats = definitions.map((definition) => {
    const mesh = createBoat(definition);
    mesh.position.set(definition.x, RIVER.waterLevel, definition.z);
    mesh.rotation.y = definition.heading;
    group.add(mesh);
    return {
      ...definition,
      mesh,
      phase: Math.random() * Math.PI * 2,
    };
  });

  scene.add(group);

  return {
    group,
    update(delta, elapsed, state) {
      for (const boat of boats) {
        if (boat.axis === "z") {
          boat.z += boat.speed * delta;
          if (boat.z > 2400) boat.z = -2400;
          if (boat.z < -2400) boat.z = 2400;
        } else {
          boat.x += boat.speed * delta;
          if (boat.x > 190) boat.x = -190;
          if (boat.x < -190) boat.x = 190;
        }

        const mesh = boat.mesh;
        mesh.position.set(
          boat.x,
          RIVER.waterLevel + Math.sin(elapsed * 0.85 + boat.phase) * 0.16,
          boat.z,
        );
        mesh.rotation.x =
          Math.sin(elapsed * 0.72 + boat.phase) * 0.012;
        mesh.rotation.z =
          Math.sin(elapsed * 0.93 + boat.phase * 1.4) * 0.01;

        const wakeMaterial = mesh.userData.wakeMaterial;
        if (wakeMaterial) {
          wakeMaterial.opacity =
            0.35 + state.boatLight * 0.22 + Math.sin(elapsed * 3 + boat.phase) * 0.03;
        }
      }
    },
  };
}
