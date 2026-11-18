import * as THREE from "three";

/**
 * 乌鸦。
 *
 * 低多边形剪影：身体、头、喙、尾与两片可上下扇动的翅膀。
 * 每只乌鸦沿一条 CatmullRom 曲线飞行，按切线转向，并按转弯
 * 方向轻微侧倾。只在各自的时间窗内出现。
 */

function createWingGeometry(sign) {
  // 本地坐标：翼根在原点，+X 朝前，翼展沿 ±Z
  const points = [
    [0.08, 0, 0],
    [0.16, 0.02, 0.36 * sign],
    [-0.02, 0, 0.88 * sign],
    [-0.22, -0.01, 1.06 * sign],
    [-0.34, 0, 0.62 * sign],
    [-0.24, 0, 0.24 * sign],
  ];
  const positions = [];
  for (const p of points) positions.push(...p);
  const indices = sign > 0
    ? [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]
    : [2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4, 0];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCrow() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x08090c,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), material);
  body.scale.set(1.9, 0.72, 0.72);
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 9, 7), material);
  head.position.set(0.36, 0.045, 0);
  group.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 6), material);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.5, 0.03, 0);
  group.add(beak);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.46, 4), material);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.42, 0.01, 0);
  tail.scale.set(1, 1, 0.4);
  group.add(tail);

  const rightWing = new THREE.Group();
  rightWing.position.set(0.05, 0.04, 0.08);
  const rightMesh = new THREE.Mesh(createWingGeometry(1), material);
  rightWing.add(rightMesh);
  group.add(rightWing);

  const leftWing = new THREE.Group();
  leftWing.position.set(0.05, 0.04, -0.08);
  const leftMesh = new THREE.Mesh(createWingGeometry(-1), material);
  leftWing.add(leftMesh);
  group.add(leftWing);

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.frustumCulled = false;
    }
  });

  return { group, rightWing, leftWing };
}

const FLIGHTS = [
  {
    start: 1.2,
    duration: 17.5,
    speed: 7.8,
    phase: 0.3,
    points: [
      [-170, 37, -18],
      [-96, 32, -52],
      [-22, 34, -72],
      [58, 41, -48],
      [132, 50, 2],
      [186, 58, 34],
    ],
  },
  {
    start: 8.4,
    duration: 15.5,
    speed: 8.6,
    phase: 2.1,
    points: [
      [148, 47, -108],
      [74, 40, -132],
      [-6, 43, -124],
      [-86, 47, -104],
      [-154, 53, -72],
    ],
  },
  {
    start: 33.2,
    duration: 12.5,
    speed: 7.0,
    phase: 4.4,
    points: [
      [112, 33, 16],
      [42, 28, -18],
      [-38, 31, -44],
      [-118, 37, -26],
      [-176, 42, 6],
    ],
  },
];

export function createCrows() {
  const group = new THREE.Group();
  group.name = "Crows";

  const crows = FLIGHTS.map((flight) => {
    const crow = createCrow();
    crow.group.visible = false;
    group.add(crow.group);
    const curve = new THREE.CatmullRomCurve3(
      flight.points.map((p) => new THREE.Vector3(...p)),
      false,
      "catmullrom",
      0.4,
    );
    return { ...crow, flight, curve, lastU: 0 };
  });

  const forward = new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const previous = new THREE.Vector3();

  function update(delta, elapsed) {
    for (const crow of crows) {
      const { flight, curve } = crow;
      const u = (elapsed - flight.start) / flight.duration;
      if (u < 0 || u > 1) {
        crow.group.visible = false;
        crow.lastU = u;
        continue;
      }

      crow.group.visible = true;
      curve.getPointAt(Math.min(0.999, Math.max(0.001, u)), position);
      curve.getPointAt(Math.min(0.999, Math.max(0.001, u + 0.008)), tangent);
      previous.copy(position);
      tangent.sub(previous).normalize();
      if (tangent.lengthSq() < 0.0001) tangent.set(1, 0, 0);

      quaternion.setFromUnitVectors(forward, tangent);
      crow.group.quaternion.copy(quaternion);
      crow.group.position.copy(position);

      // 侧倾：按切线在水平面的转向量估算
      const turn = tangent.x * 0.0 + tangent.z;
      crow.group.rotateZ(-turn * 0.05);

      const flap =
        Math.sin(elapsed * flight.speed + flight.phase) * 0.72 +
        Math.sin(elapsed * flight.speed * 0.31 + flight.phase * 1.7) * 0.16;
      crow.rightWing.rotation.x = -flap;
      crow.leftWing.rotation.x = flap;

      // 长距离滑翔时翅膀放平
      const glide = Math.max(0, Math.sin(elapsed * 0.4 + flight.phase) - 0.55) / 0.45;
      crow.rightWing.rotation.x *= 1 - glide * 0.75;
      crow.leftWing.rotation.x *= 1 - glide * 0.75;
    }
  }

  return { group, crows, update };
}
