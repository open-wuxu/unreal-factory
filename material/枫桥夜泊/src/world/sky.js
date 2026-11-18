import * as THREE from "three";

/**
 * 深秋午夜天空。
 *
 * 一个跟随相机的巨大天空球：深蓝渐变、稀疏星光、低垂的落月、
 * 贴着地平线的薄云与月晕。月亮方向由 config.moonDirectionAt(t)
 * 提供，40 秒内缓慢下沉，但始终停在地平线之上。
 */
export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color(0x0b1424) },
    uHorizon: { value: new THREE.Color(0x1b2b42) },
    uBottom: { value: new THREE.Color(0x070b12) },
    uMoonColor: { value: new THREE.Color(0xb7c9de) },
    uMoonDir: { value: new THREE.Vector3(-0.12, 0.1, -0.99).normalize() },
    uMoonGlow: { value: 1.0 },
    uStars: { value: 1.0 },
    uCloud: { value: 0.36 },
    uTime: { value: 0.0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDirection;

      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform vec3 uMoonColor;
      uniform vec3 uMoonDir;
      uniform float uMoonGlow;
      uniform float uStars;
      uniform float uCloud;
      uniform float uTime;

      varying vec3 vDirection;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += valueNoise(p) * amplitude;
          p = p * 2.04 + 13.3;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 dir = normalize(vDirection);
        vec3 moonDir = normalize(uMoonDir);
        float h = dir.y;

        // 深蓝夜空：地平线略有雾气抬升，天顶压暗
        float up = smoothstep(-0.02, 0.34, h);
        vec3 sky = mix(uHorizon, uTop, pow(up, 0.72));
        sky = mix(uBottom, sky, smoothstep(-0.32, 0.03, h));

        // 月亮：低悬在地平线上方，带克制的光晕
        float d = max(dot(dir, moonDir), 0.0);
        float disc = smoothstep(0.99943, 0.99978, d);
        float limb = smoothstep(0.99943, 0.99992, d);
        float maria = valueNoise(dir.xz * 420.0 + 7.0) * 0.18
                    + valueNoise(dir.xz * 180.0 + 19.0) * 0.12;
        vec3 moonDisc = uMoonColor * (1.05 - maria) * (0.82 + limb * 0.34);
        sky = mix(sky, moonDisc * 1.18, disc * uMoonGlow);

        float halo = pow(d, 420.0) * 0.34 + pow(d, 42.0) * 0.09 + pow(d, 9.0) * 0.025;
        sky += uMoonColor * halo * uMoonGlow;

        // 地平线附近的湿冷气团，把远山和天空连起来
        float haze = pow(max(0.0, 1.0 - abs(h + 0.01)), 10.0);
        sky += vec3(0.08, 0.105, 0.14) * haze * 0.38;
        sky += uMoonColor * pow(max(0.0, d), 5.0) * haze * 0.06;

        // 薄云：只在地平线以上，缓慢漂移，靠近月亮的一侧被镀上冷光
        if (h > -0.01) {
          vec2 cuv = dir.xz / (h + 0.3) * 0.42;
          float cloud = fbm(cuv * 1.35 + vec2(uTime * 0.0032, uTime * 0.0009));
          cloud = smoothstep(0.52, 0.8, cloud);
          float band = smoothstep(-0.01, 0.1, h) * (1.0 - smoothstep(0.34, 0.72, h));
          float moonEdge = pow(max(0.0, d), 3.0);
          vec3 cloudColor = mix(vec3(0.09, 0.115, 0.16), uMoonColor * 0.52, moonEdge * 0.8);
          sky = mix(sky, cloudColor, cloud * band * uCloud * 0.55);
        }

        // 稀疏星光，只在较高处出现
        if (uStars > 0.001 && h > 0.02) {
          vec3 cell = floor(dir * 760.0);
          float star = hash21(cell.xy + cell.z * 41.7);
          float visible = step(0.9981, star) * uStars;
          float twinkle = 0.55 + 0.45 * sin(uTime * 1.3 + star * 117.0);
          float fade = smoothstep(0.03, 0.42, h) * (1.0 - smoothstep(0.2, 0.65, d));
          sky += vec3(0.78, 0.86, 1.0) * visible * twinkle * fade * 0.85;
        }

        // 极淡的银河 / 高空薄霭
        float milky = fbm(dir.xz * 3.6 + 11.0) * smoothstep(0.1, 0.7, h);
        sky += vec3(0.05, 0.07, 0.1) * milky * 0.35;

        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(14000, 64, 40),
    material,
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.matrixAutoUpdate = false;

  return {
    mesh,
    uniforms,
    update(camera, moonDir, elapsed) {
      mesh.position.copy(camera.position);
      mesh.updateMatrix();
      uniforms.uMoonDir.value.copy(moonDir);
      uniforms.uTime.value = elapsed;
    },
  };
}
