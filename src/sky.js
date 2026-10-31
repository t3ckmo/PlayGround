import * as THREE from 'three'
import { FOG_FAR, FOG_NEAR } from './world.js'

const DAY_SECONDS = 480
const CLOUD_RANGE = 260

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uNight;

  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 dir = normalize(vDir);
    float up = clamp(dir.y, -1.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(clamp(up, 0.0, 1.0), 0.55));
    col = mix(uGround, col, smoothstep(-0.22, 0.02, up));

    float sun = max(dot(dir, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(sun, 900.0) * 1.9 + pow(sun, 24.0) * 0.16 + pow(sun, 5.0) * 0.03);

    float star = step(0.9986, hash(floor(dir * 460.0))) * smoothstep(0.0, 0.22, up);
    col += vec3(0.85, 0.9, 1.0) * star * uNight * 0.9;

    gl_FragColor = vec4(col, 1.0);
  }
`

function makeSunTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 96
  const ctx = canvas.getContext('2d')
  const glow = ctx.createRadialGradient(48, 48, 14, 48, 48, 47)
  glow.addColorStop(0, 'rgba(255, 244, 190, 0.42)')
  glow.addColorStop(0.45, 'rgba(255, 224, 128, 0.16)')
  glow.addColorStop(1, 'rgba(255, 196, 70, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 96, 96)
  ctx.fillStyle = '#ffeaa2'
  ctx.fillRect(28, 28, 40, 40)
  ctx.fillStyle = '#fff8d4'
  ctx.fillRect(30, 30, 36, 36)
  ctx.fillStyle = '#fffdf0'
  ctx.fillRect(32, 32, 32, 32)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeMoonTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 96
  const ctx = canvas.getContext('2d')
  const glow = ctx.createRadialGradient(48, 48, 10, 48, 48, 44)
  glow.addColorStop(0, 'rgba(220, 235, 255, 0.55)')
  glow.addColorStop(0.5, 'rgba(180, 210, 255, 0.12)')
  glow.addColorStop(1, 'rgba(150, 190, 255, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 96, 96)
  ctx.fillStyle = '#e7eefc'
  ctx.fillRect(34, 34, 28, 28)
  ctx.fillStyle = '#c3d0e8'
  ctx.fillRect(38, 39, 5, 5)
  ctx.fillRect(50, 48, 6, 6)
  ctx.fillRect(44, 54, 4, 4)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export class Sky {
  constructor(scene) {
    this.scene = scene
    this.time = 0.305
    this.day = 1
    this.cycleSeconds = DAY_SECONDS
    this.sunDirection = new THREE.Vector3(0, 1, 0)
    this.daylight = 1
    this.twilight = 0
    this.night = 0
    this.blockTint = new THREE.Color(1, 1, 1)
    this.waterTint = new THREE.Color(1, 1, 1)
    this.fogColor = new THREE.Color(0xbfe0f5)
    this.horizonColor = new THREE.Color(0xbfe0f5)
    this.cloudMaterial = null

    this.uniforms = {
      uZenith: { value: new THREE.Color(0x3f7fd6) },
      uHorizon: { value: new THREE.Color(0xbfe0f5) },
      uGround: { value: new THREE.Color(0x607d92) },
      uSunColor: { value: new THREE.Color(0xffe6a3) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uNight: { value: 0 }
    }

    const geometry = new THREE.SphereGeometry(500, 32, 20)
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    })
    this.sphere = new THREE.Mesh(geometry, material)
    this.sphere.frustumCulled = false
    this.sphere.renderOrder = -1000
    scene.add(this.sphere)

    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeSunTexture(),
        transparent: true,
        depthWrite: false,
        fog: false
      })
    )
    this.sunSprite.scale.setScalar(38)
    this.sunSprite.renderOrder = -900
    scene.add(this.sunSprite)

    this.moonSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeMoonTexture(),
        transparent: true,
        depthWrite: false,
        fog: false
      })
    )
    this.moonSprite.scale.setScalar(32)
    this.moonSprite.renderOrder = -900
    scene.add(this.moonSprite)

    this.scene.fog = new THREE.Fog(0xa9d3ee, FOG_NEAR, FOG_FAR)

    this._createClouds()
    this.update(0, new THREE.Vector3(0, 40, 0))
  }

  _createClouds() {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      fog: true
    })
    this.cloudMaterial = material
    this.clouds = []
    this.cloudDrift = 0

    let seed = 0x1f2e3d
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }

    const count = 120
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    mesh.frustumCulled = false
    mesh.renderOrder = 4
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.cloudMesh = mesh
    this.scene.add(mesh)

    let index = 0
    while (index < count) {
      const clusterX = (random() * 2 - 1) * CLOUD_RANGE
      const clusterZ = (random() * 2 - 1) * CLOUD_RANGE
      const clusterY = 76 + random() * 18
      const pieces = 2 + Math.floor(random() * 3)
      for (let p = 0; p < pieces && index < count; p++) {
        this.clouds.push({
          x: clusterX + (random() * 2 - 1) * 15,
          y: clusterY + (random() * 2 - 1) * 1.8,
          z: clusterZ + (random() * 2 - 1) * 9,
          sx: 8 + random() * 16,
          sy: 1.4 + random() * 1.8,
          sz: 7 + random() * 11
        })
        index++
      }
    }
    this._writeCloudMatrices(0)
  }

  _writeCloudMatrices(cameraX, cameraZ) {
    const dummy = new THREE.Object3D()
    const range = CLOUD_RANGE * 2
    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i]
      let x = cloud.x + this.cloudDrift - cameraX
      let z = cloud.z - cameraZ
      x = ((x % range) + range) % range - range / 2 + cameraX
      z = ((z % range) + range) % range - range / 2 + cameraZ
      dummy.position.set(x, cloud.y, z)
      dummy.scale.set(cloud.sx, cloud.sy, cloud.sz)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      this.cloudMesh.setMatrixAt(i, dummy.matrix)
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true
  }

  update(dt, cameraPosition) {
    this.time += dt / this.cycleSeconds
    if (this.time >= 1) {
      this.time -= 1
      this.day++
    }

    const angle = (this.time - 0.25) * Math.PI * 2
    const elevation = Math.sin(angle)
    this.sunDirection.set(Math.cos(angle), elevation, 0.3).normalize()
    this.daylight = smoothstep(-0.1, 0.14, elevation)
    this.twilight = Math.exp(-Math.pow(elevation / 0.16, 2))
    this.night = 1 - smoothstep(-0.12, 0.05, elevation)

    const dayTop = CACHE.dayTop
    const dayHorizon = CACHE.dayHorizon
    const nightTop = CACHE.nightTop
    const nightHorizon = CACHE.nightHorizon
    const duskTop = CACHE.duskTop
    const duskHorizon = CACHE.duskHorizon

    CACHE.top.copy(nightTop).lerp(dayTop, this.daylight)
    CACHE.top.lerp(duskTop, this.twilight * 0.55 * (0.35 + this.daylight * 0.65))
    CACHE.horizon.copy(nightHorizon).lerp(dayHorizon, this.daylight)
    CACHE.horizon.lerp(duskHorizon, this.twilight * 0.9)

    this.uniforms.uZenith.value.copy(CACHE.top)
    this.uniforms.uHorizon.value.copy(CACHE.horizon)
    this.uniforms.uGround.value.copy(CACHE.horizon).multiplyScalar(0.62)
    this.uniforms.uSunDir.value.copy(this.sunDirection)
    this.uniforms.uNight.value = this.night
    this.uniforms.uSunColor.value.setRGB(
      1.0,
      0.82 + this.daylight * 0.12,
      0.62 + this.daylight * 0.3
    )

    this.fogColor.copy(CACHE.horizon)
    this.horizonColor.copy(CACHE.horizon)
    this.scene.fog.color.copy(this.horizonColor)

    const warm = this.twilight * 0.16 * (0.4 + this.daylight * 0.6)
    this.blockTint.setRGB(
      0.3 + 0.7 * this.daylight + warm,
      0.37 + 0.63 * this.daylight + warm * 0.55,
      0.58 + 0.42 * this.daylight
    )
    this.waterTint.copy(this.blockTint)

    this.cloudMaterial.color.setRGB(
      0.45 + 0.55 * this.daylight + warm,
      0.52 + 0.48 * this.daylight + warm * 0.5,
      0.72 + 0.28 * this.daylight
    )
    this.cloudMaterial.opacity = 0.28 + 0.48 * this.daylight

    if (cameraPosition) {
      this.sphere.position.copy(cameraPosition)
      this.sunSprite.position
        .copy(cameraPosition)
        .addScaledVector(this.sunDirection, 340)
      this.moonSprite.position
        .copy(cameraPosition)
        .addScaledVector(this.sunDirection, -340)
      this.sunSprite.visible = this.sunDirection.y > -0.12
      this.moonSprite.visible = this.sunDirection.y < 0.12
      this.cloudDrift += dt * 1.8
      this._writeCloudMatrices(cameraPosition.x, cameraPosition.z)
    }
  }

  get clockLabel() {
    const totalMinutes = Math.floor(this.time * 24 * 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `Day ${this.day} · ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }
}

const CACHE = {
  top: new THREE.Color(),
  horizon: new THREE.Color(),
  dayTop: new THREE.Color(0x3d7cd4),
  dayHorizon: new THREE.Color(0xa9d3ee),
  nightTop: new THREE.Color(0x050a18),
  nightHorizon: new THREE.Color(0x0f1c36),
  duskTop: new THREE.Color(0x53639b),
  duskHorizon: new THREE.Color(0xff9d5c)
}
