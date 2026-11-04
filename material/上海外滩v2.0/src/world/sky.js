import * as THREE from "three";

/**
 * 程序化天空：渐变、太阳光晕、云层与星空。
 * 天空球跟随相机，保证永远包裹视角。
 */
export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color(0x2a67c4) },
    uHorizon: { value: new THREE.Color(0xcfe6ff) },
    uBottom: { value: new THREE.Color(0xb9d4ea) },
    uSunColor: { value: new THREE.Color(0xfff2d4) },
    uSunDir: { value: new THREE.Vector3(-0.52, 0.66, 0.54).normalize() },
    uSunGlow: { value: 1.0 },
    uStars: { value: 0.0 },
    uCloud: { value: 0.55 },
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
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunGlow;
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
        for (int i = 0; i < 4; i++) {
          value += valueNoise(p) * amplitude;
          p = p * 2.03 + 17.7;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 dir = normalize(vDirection);
        vec3 sunDir = normalize(uSunDir);
        float h = dir.y;

        float up = smoothstep(-0.015, 0.19, h);
        vec3 sky = mix(uHorizon, uTop, pow(up, 0.8));
        sky = mix(uBottom, sky, smoothstep(-0.2, 0.012, h));

        float sunDot = max(dot(dir, sunDir), 0.0);
        sky += uSunColor * pow(sunDot, 7.0) * 0.16 * uSunGlow;
        sky += uSunColor * pow(sunDot, 180.0) * 0.9 * uSunGlow;
        sky += uSunColor * smoothstep(0.99935, 0.9998, sunDot) * 2.4 * uSunGlow;
        sky += uSunColor * pow(max(0.0, 1.0 - abs(h)), 7.0) * pow(sunDot, 3.0) * 0.22 * uSunGlow;

        // 云层：只出现在地平线以上，随时间缓慢漂移
        if (h > 0.0) {
          vec2 cuv = dir.xz / (h + 0.24) * 0.5;
          float cloud = fbm(cuv * 1.15 + vec2(uTime * 0.0045, uTime * 0.0012));
          cloud = smoothstep(0.58, 0.84, cloud);
          float fade = smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.38, 0.78, h));
          vec3 cloudColor = mix(uHorizon * 0.82, uSunColor * 0.7 + vec3(0.06), pow(sunDot, 2.0));
          sky = mix(sky, cloudColor, cloud * uCloud * fade);
        }

        // 星空：高频哈希 + 缓慢闪烁
        if (uStars > 0.001 && h > 0.01) {
          vec3 cell = floor(dir * 820.0);
          float star = hash21(cell.xy + cell.z * 37.1);
          float visible = step(0.9976, star) * uStars;
          float twinkle = 0.6 + 0.4 * sin(uTime * 1.7 + star * 93.0);
          float fade = smoothstep(0.02, 0.28, h) * (1.0 - smoothstep(0.9, 1.0, sunDot));
          sky += vec3(0.85, 0.92, 1.0) * visible * twinkle * fade * 0.85;
        }

        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(12000, 64, 40), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.matrixAutoUpdate = false;

  return {
    mesh,
    uniforms,
    update(camera, elapsed) {
      mesh.position.copy(camera.position);
      mesh.updateMatrix();
      uniforms.uTime.value = elapsed;
    },
  };
}
