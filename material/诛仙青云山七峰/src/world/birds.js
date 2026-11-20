import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * 仙鹤：四群鹤绕峰飞行。身体合并成一个几何体，双翼独立扇动。
 * 所有位置由绝对时间推导，拖动时间轴可重现。
 */

const FLOCKS = [
  { center: [0, 1930, 0], radius: 360, altitude: 1930, speed: 0.09, phase: 0.4 },
  { center: [-2500, 1440, 2500], radius: 240, altitude: 1440, speed: 0.13, phase: 2.1 },
  { center: [1900, 1470, 3000], radius: 210, altitude: 1470, speed: 0.12, phase: 3.6 },
  { center: [-2600, 1330, -1800], radius: 270, altitude: 1330, speed: 0.1, phase: 5.2 },
];

function craneGeometry() {
  const body = new THREE.SphereGeometry(0.45, 8, 6);
  body.scale(1.9, 0.65, 0.7);
  const neck = new THREE.CylinderGeometry(0.1, 0.17, 1.2, 6);
  neck.rotateX(-0.75);
  neck.translate(0, 0.55, 0.85);
  const head = new THREE.SphereGeometry(0.2, 7, 5);
  head.translate(0, 1.0, 1.35);
  const tail = new THREE.ConeGeometry(0.22, 0.9, 6);
  tail.rotateX(-Math.PI / 2);
  tail.translate(0, 0.05, -1.05);
  return mergeGeometries([body, neck, head, tail]);
}

function createCrane(bodyMaterial, wingMaterial) {
  const bird = new THREE.Group();
  const body = new THREE.Mesh(craneGeometry(), bodyMaterial);
  body.castShadow = true;
  bird.add(body);

  const wingGeometry = new THREE.BoxGeometry(2.4, 0.06, 0.66);
  wingGeometry.translate(1.2, 0.12, 0);
  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.castShadow = true;
  bird.add(leftWing);
  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
  rightWing.scale.x = -1;
  rightWing.castShadow = true;
  bird.add(rightWing);

  bird.userData.wings = [leftWing, rightWing];
  return bird;
}

export function createBirds(scene) {
  const group = new THREE.Group();
  group.name = "birds";

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xece7d8,
    roughness: 0.82,
  });
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0xded8c6,
    roughness: 0.86,
    side: THREE.DoubleSide,
  });

  const flocks = [];

  for (const definition of FLOCKS) {
    const flockGroup = new THREE.Group();
    flockGroup.position.set(...definition.center);
    const birds = [];
    const offsets = [
      [0, 0, 0],
      [-5, 0.6, -6],
      [5, 0.6, -6],
      [-10, 1.2, -12],
      [10, 1.2, -12],
    ];
    offsets.forEach(([x, y, z], index) => {
      const bird = createCrane(bodyMaterial, wingMaterial);
      bird.position.set(x, y, z);
      bird.userData.phase = index * 0.7;
      flockGroup.add(bird);
      birds.push(bird);
    });
    group.add(flockGroup);
    flocks.push({
      group: flockGroup,
      birds,
      definition,
      samples: [],
    });
  }

  scene.add(group);
  let clock = 0;

  function update(delta, state) {
    clock = state && state.time !== undefined ? state.time : clock + delta;
    for (const flock of flocks) {
      const { center, radius, altitude, speed, phase } = flock.definition;
      const angle = clock * speed + phase;
      flock.group.position.set(
        center[0] + Math.cos(angle) * radius,
        altitude + Math.sin(clock * 0.6 + phase) * 14,
        center[2] + Math.sin(angle) * radius,
      );
      flock.group.rotation.y = -angle;
      for (const bird of flock.birds) {
        const flap = Math.sin(clock * 5.2 + bird.userData.phase + phase) * 0.62;
        bird.userData.wings[0].rotation.z = flap;
        bird.userData.wings[1].rotation.z = -flap;
      }
    }
  }

  update(0, { time: 0 });
  group.updateMatrixWorld(true);
  for (const flock of flocks) {
    const position = new THREE.Vector3();
    for (const bird of flock.birds) {
      bird.getWorldPosition(position);
      flock.samples.push({ x: position.x, y: position.y, z: position.z });
    }
  }

  return { group, flocks, update };
}
