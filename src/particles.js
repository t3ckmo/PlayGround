import * as THREE from 'three'

const MAX_PARTICLES = 420

export class Particles {
  constructor(scene) {
    this.positions = new Float32Array(MAX_PARTICLES * 3)
    this.colors = new Float32Array(MAX_PARTICLES * 3)
    this.velocity = new Float32Array(MAX_PARTICLES * 3)
    this.life = new Float32Array(MAX_PARTICLES)
    this.maxLife = new Float32Array(MAX_PARTICLES)
    this.cursor = 0

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.positions[i * 3 + 1] = -999
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000000)

    const material = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    })
    this.points = new THREE.Points(geometry, material)
    this.points.frustumCulled = false
    this.points.renderOrder = 5
    scene.add(this.points)
  }

  spawn(x, y, z, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const index = this.cursor
      this.cursor = (this.cursor + 1) % MAX_PARTICLES
      const jitter = 0.25
      this.positions[index * 3] = x + 0.5 + (Math.random() - 0.5) * jitter
      this.positions[index * 3 + 1] = y + 0.5 + (Math.random() - 0.5) * jitter
      this.positions[index * 3 + 2] = z + 0.5 + (Math.random() - 0.5) * jitter
      this.velocity[index * 3] = (Math.random() - 0.5) * 4.2
      this.velocity[index * 3 + 1] = Math.random() * 4 + 1.2
      this.velocity[index * 3 + 2] = (Math.random() - 0.5) * 4.2
      const shade = 0.72 + Math.random() * 0.4
      this.colors[index * 3] = color[0] * shade
      this.colors[index * 3 + 1] = color[1] * shade
      this.colors[index * 3 + 2] = color[2] * shade
      this.maxLife[index] = 0.55 + Math.random() * 0.45
      this.life[index] = this.maxLife[index]
    }
    this.points.geometry.attributes.color.needsUpdate = true
  }

  update(dt) {
    let alive = false
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue
      alive = true
      this.life[i] -= dt
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -999
        continue
      }
      this.velocity[i * 3 + 1] -= 18 * dt
      const drag = Math.exp(-1.4 * dt)
      this.velocity[i * 3] *= drag
      this.velocity[i * 3 + 2] *= drag
      this.positions[i * 3] += this.velocity[i * 3] * dt
      this.positions[i * 3 + 1] += this.velocity[i * 3 + 1] * dt
      this.positions[i * 3 + 2] += this.velocity[i * 3 + 2] * dt
    }
    if (alive) this.points.geometry.attributes.position.needsUpdate = true
  }

  clear() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.life[i] = 0
      this.positions[i * 3 + 1] = -999
    }
    this.points.geometry.attributes.position.needsUpdate = true
  }
}
