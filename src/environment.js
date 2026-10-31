import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  CanvasTexture,
  SRGBColorSpace,
  RepeatWrapping,
  LinearFilter,
  DoubleSide,
} from 'three';
import { mulberry32, clamp, smoothstep } from './noise.js';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  uniform float sunStrength;
  uniform float moonStrength;
  uniform float starStrength;

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    float t = pow(clamp(h * 1.15, 0.0, 1.0), 0.55);
    vec3 col = mix(horizonColor, topColor, t);
    col = mix(col, horizonColor * 0.6, smoothstep(0.0, -0.28, h));

    float sd = max(dot(dir, sunDir), 0.0);
    col += sunColor * pow(sd, 1200.0) * 14.0 * sunStrength;
    col += sunColor * pow(sd, 18.0) * 0.32 * sunStrength;
    col += sunColor * pow(sd, 4.0) * 0.07 * sunStrength;

    float md = max(dot(dir, -sunDir), 0.0);
    col += vec3(0.78, 0.85, 1.0) * pow(md, 1800.0) * 4.0 * moonStrength;
    col += vec3(0.4, 0.5, 0.85) * pow(md, 22.0) * 0.1 * moonStrength;

    if (starStrength > 0.001) {
      vec3 p = dir * 260.0;
      vec3 cell = floor(p);
      float n = hash13(cell);
      float star = smoothstep(0.9977, 1.0, n) * smoothstep(0.0, 0.22, dir.y);
      float twinkle = 0.7 + 0.3 * hash13(cell + 7.0);
      col += vec3(0.85, 0.9, 1.0) * star * starStrength * 1.6 * twinkle;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

function makeCloudTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(0xc10d5eed);
  ctx.clearRect(0, 0, size, size);

  const blob = (x, y, r, alpha) => {
    for (let ox = -size; ox <= size; ox += size) {
      for (let oy = -size; oy <= size; oy += size) {
        const cx = x + ox;
        const cy = y + oy;
        if (cx + r < 0 || cy + r < 0 || cx - r > size || cy - r > size) continue;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(255,255,255,${alpha})`);
        g.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.75})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  for (let i = 0; i < 26; i++) {
    blob(20 + rng() * 216, 20 + rng() * 216, 12 + rng() * 30, 0.1 + rng() * 0.18);
  }
  for (let i = 0; i < 14; i++) {
    blob(40 + rng() * 176, 40 + rng() * 176, 8 + rng() * 16, 0.2 + rng() * 0.2);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export class Environment {
  constructor(scene, { shadows = true } = {}) {
    this.scene = scene;
    this.time = 0.34;
    this.dayLength = 480;
    this.sunDir = new Vector3(0.5, 0.7, 0.3).normalize();
    this.underwater = false;
    this.viewFar = 96;

    this.fog = new Fog(0xcfe8f7, 44, 96);
    scene.fog = this.fog;

    this.topColor = new Color(0x3f8fd0);
    this.horizonColor = new Color(0xcfe8f7);

    this.skyMaterial = new ShaderMaterial({
      uniforms: {
        topColor: { value: new Color(0x3f8fd0) },
        horizonColor: { value: new Color(0xcfe8f7) },
        sunColor: { value: new Color(0xfff3d6) },
        sunDir: { value: this.sunDir.clone() },
        sunStrength: { value: 1 },
        moonStrength: { value: 0 },
        starStrength: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      side: 1, // THREE.BackSide
      depthWrite: false,
      fog: false,
    });

    this.sky = new Mesh(new SphereGeometry(500, 32, 20), this.skyMaterial);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    this.sunLight = new DirectionalLight(0xfff0d2, 2.1);
    this.sunLight.castShadow = shadows;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.left = -60;
    this.sunLight.shadow.camera.right = 60;
    this.sunLight.shadow.camera.top = 60;
    this.sunLight.shadow.camera.bottom = -60;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 260;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.06;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.hemi = new HemisphereLight(0xbfd9f2, 0x4b5b3c, 0.85);
    scene.add(this.hemi);

    this.cloudMaterial = new MeshBasicMaterial({
      map: makeCloudTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      fog: false,
      side: DoubleSide,
      color: 0xffffff,
    });
    this.cloudMaterial.map.repeat.set(3, 3);
    this.clouds = new Mesh(new PlaneGeometry(1100, 1100), this.cloudMaterial);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 102;
    this.clouds.renderOrder = -5;
    scene.add(this.clouds);
    this.cloudOffset = 0;

    this.tmpColor = new Color();
  }

  setViewDistance(near, far) {
    this.fog.near = near;
    this.fog.far = far;
    this.viewFar = far;
  }

  update(dt, camera, focus) {
    this.time = (this.time + dt / this.dayLength) % 1;
    const angle = (this.time - 0.25) * Math.PI * 2;
    const sunDir = this.sunDir.set(Math.cos(angle), Math.sin(angle), 0.32).normalize();
    const elevation = sunDir.y;

    const day = smoothstep(-0.02, 0.34, elevation);
    const dusk = Math.exp(-Math.pow((elevation - 0.015) / 0.16, 2)) * 0.9;
    const night = 1 - smoothstep(-0.22, 0.03, elevation);

    const dayTop = new Color(0x3f8fd0);
    const dayHorizon = new Color(0xd3e9f7);
    const sunsetTop = new Color(0x40508e);
    const sunsetHorizon = new Color(0xff9a5c);
    const nightTop = new Color(0x050914);
    const nightHorizon = new Color(0x0c1730);

    const top = this.tmpColor.copy(nightTop).lerp(dayTop, day).lerp(sunsetTop, dusk * 0.55);
    const horizon = new Color().copy(nightHorizon).lerp(dayHorizon, day).lerp(sunsetHorizon, dusk);

    const uniforms = this.skyMaterial.uniforms;
    uniforms.topColor.value.copy(top);
    uniforms.horizonColor.value.copy(horizon);
    uniforms.sunDir.value.copy(sunDir);
    uniforms.sunStrength.value = smoothstep(-0.08, 0.05, elevation);
    uniforms.moonStrength.value = night * 0.9;
    uniforms.starStrength.value = night * 0.9;

    const sunColor = new Color(0xffb26b).lerp(new Color(0xfff5de), smoothstep(0.02, 0.38, elevation));
    uniforms.sunColor.value.copy(sunColor);

    this.sunLight.color.copy(sunColor);
    this.sunLight.intensity = 0.12 + 2.05 * smoothstep(-0.04, 0.3, elevation);
    this.sunLight.position.copy(focus).addScaledVector(sunDir, 95);
    this.sunLight.target.position.copy(focus);
    this.sunLight.target.updateMatrixWorld();

    this.hemi.intensity = 0.4 + 0.85 * day;
    this.hemi.color.copy(horizon).lerp(new Color(0xffffff), 0.25);
    this.hemi.groundColor.setHex(0x46543a);

    const cloudTint = new Color(0xffffff)
      .lerp(new Color(0xffc9a1), dusk * 0.55)
      .lerp(new Color(0x2a3550), night * 0.85);
    this.cloudMaterial.color.copy(cloudTint);
    this.cloudMaterial.opacity = 0.8 - night * 0.25;

    this.cloudOffset += dt * 0.0016;
    const cloudTex = this.cloudMaterial.map;
    cloudTex.offset.set(this.cloudOffset, this.cloudOffset * 0.55);
    this.clouds.position.x = focus.x;
    this.clouds.position.z = focus.z;

    this.sky.position.copy(camera.position);

    if (this.underwater) {
      this.fog.color.setHex(0x1a5d8a);
      this.fog.near = 1.5;
      this.fog.far = 26;
    } else {
      this.fog.color.copy(horizon);
      this.fog.near = Math.max(18, this.viewFar * 0.42);
      this.fog.far = this.viewFar;
    }

    return { horizon, top, sunDir, elevation };
  }

  dispose() {
    this.scene.remove(this.sky, this.clouds, this.sunLight, this.sunLight.target, this.hemi);
    this.sky.geometry.dispose();
    this.skyMaterial.dispose();
    this.clouds.geometry.dispose();
    this.cloudMaterial.map.dispose();
    this.cloudMaterial.dispose();
  }
}
