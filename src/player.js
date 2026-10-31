import * as THREE from 'three'
import { isLiquid, isSolid } from './blocks.js'
import { WORLD_HEIGHT } from './worldgen.js'

const HALF_WIDTH = 0.3
const HEIGHT = 1.8
const EYE_HEIGHT = 1.62
const GRAVITY = 28
const JUMP_SPEED = 8.7
const WALK_SPEED = 4.7
const SPRINT_SPEED = 7.3
const FLY_SPEED = 10.5
const FLY_SPRINT_SPEED = 17

export class Player {
  constructor(world, camera, domElement) {
    this.world = world
    this.camera = camera
    this.dom = domElement
    this.position = new THREE.Vector3(0.5, 40, 0.5)
    this.velocity = new THREE.Vector3()
    this.yaw = 0
    this.pitch = 0
    this.onGround = false
    this.flying = false
    this.inWater = false
    this.headInWater = false
    this.sprinting = false
    this.enabled = false
    this.keys = new Set()
    this.joystick = { x: 0, y: 0 }
    this.touchJump = false
    this.lastSpace = 0
    this.stepDistance = 0
    this.spawn = { x: 0.5, y: 40, z: 0.5, yaw: 0, pitch: 0 }
    this.callbacks = {}
    this._bindKeys()
  }

  _bindKeys() {
    window.addEventListener('keydown', (event) => {
      if (!this.enabled) return
      if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault()
      if (event.repeat) return

      if (event.code === 'Space') {
        const now = performance.now()
        if (now - this.lastSpace < 280) {
          this.toggleFly()
          this.lastSpace = 0
        } else {
          this.lastSpace = now
        }
      }
      if (event.code === 'KeyF') this.toggleFly()
      this.keys.add(event.code)
    })

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code)
    })

    window.addEventListener('blur', () => {
      this.keys.clear()
      this.joystick.x = 0
      this.joystick.y = 0
      this.touchJump = false
    })
  }

  setSpawn(x, y, z, yaw = 0, pitch = 0) {
    this.spawn = { x: x + 0.5, y: y + 0.001, z: z + 0.5, yaw, pitch }
    this.respawn()
  }

  respawn() {
    this.position.set(this.spawn.x, this.spawn.y, this.spawn.z)
    this.velocity.set(0, 0, 0)
    this.yaw = this.spawn.yaw
    this.pitch = this.spawn.pitch
    this.flying = false
    this.onGround = false
  }

  toggleFly() {
    this.flying = !this.flying
    this.velocity.y = 0
    this.callbacks.onFly?.(this.flying)
  }

  setJoystick(x, y) {
    this.joystick.x = x
    this.joystick.y = y
  }

  look(dx, dy, sensitivity = 0.0022) {
    this.yaw -= dx * sensitivity
    this.pitch -= dy * sensitivity
    this.pitch = Math.max(-1.54, Math.min(1.54, this.pitch))
  }

  update(dt) {
    if (!this.enabled) return
    dt = Math.min(dt, 0.05)

    const forwardInput =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
      this.joystick.y
    const strafeInput =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.joystick.x
    const wantsJump = this.keys.has('Space') || this.touchJump
    this.sprinting = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && !this.flying

    const sin = Math.sin(this.yaw)
    const cos = Math.cos(this.yaw)
    let dirX = -sin * forwardInput + cos * strafeInput
    let dirZ = -cos * forwardInput - sin * strafeInput
    const length = Math.hypot(dirX, dirZ)
    if (length > 1) {
      dirX /= length
      dirZ /= length
    }

    const feetBlock = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.2),
      Math.floor(this.position.z)
    )
    const headBlock = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + EYE_HEIGHT),
      Math.floor(this.position.z)
    )
    this.inWater = isLiquid(feetBlock)
    this.headInWater = isLiquid(headBlock)

    let speed
    if (this.flying) speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? FLY_SPRINT_SPEED : FLY_SPEED
    else if (this.inWater) speed = 3.3
    else speed = this.sprinting ? SPRINT_SPEED : WALK_SPEED

    const targetX = dirX * speed
    const targetZ = dirZ * speed
    const response = this.flying ? 8 : this.onGround ? 15 : this.inWater ? 6 : 2.2
    const blend = 1 - Math.exp(-response * dt)
    this.velocity.x += (targetX - this.velocity.x) * blend
    this.velocity.z += (targetZ - this.velocity.z) * blend

    if (this.flying) {
      const lift = (wantsJump ? 1 : 0) - (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1 : 0)
      this.velocity.y += (lift * FLY_SPEED - this.velocity.y) * (1 - Math.exp(-10 * dt))
    } else if (this.inWater) {
      this.velocity.y -= 9 * dt
      this.velocity.y = Math.max(this.velocity.y, -3.2)
      if (wantsJump) this.velocity.y = 4.4
    } else {
      this.velocity.y -= GRAVITY * dt
      this.velocity.y = Math.max(this.velocity.y, -45)
      if (wantsJump && this.onGround) {
        this.velocity.y = JUMP_SPEED
        this.onGround = false
        this.callbacks.onJump?.()
      }
    }

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z)
    this.stepDistance += horizontalSpeed * dt
    if (this.onGround && this.stepDistance > (this.sprinting ? 2.1 : 1.9)) {
      this.stepDistance = 0
      this.callbacks.onStep?.()
    }

    const maxComponent = Math.max(Math.abs(this.velocity.x), Math.abs(this.velocity.y), Math.abs(this.velocity.z))
    const steps = Math.max(1, Math.min(8, Math.ceil((maxComponent * dt) / 0.22)))
    const stepDt = dt / steps
    this.onGround = false
    for (let i = 0; i < steps; i++) {
      this.moveAxis('x', this.velocity.x * stepDt)
      this.moveAxis('z', this.velocity.z * stepDt)
      this.moveAxis('y', this.velocity.y * stepDt)
    }

    if (this.position.y < -24) this.respawn()

    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z)
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
  }

  moveAxis(axis, amount) {
    if (amount === 0) return
    this.position[axis] += amount

    const minX = this.position.x - HALF_WIDTH
    const maxX = this.position.x + HALF_WIDTH
    const minY = this.position.y
    const maxY = this.position.y + HEIGHT
    const minZ = this.position.z - HALF_WIDTH
    const maxZ = this.position.z + HALF_WIDTH

    let limit = amount > 0 ? Infinity : -Infinity
    let hit = false

    const x0 = Math.floor(minX + 0.0001)
    const x1 = Math.floor(maxX - 0.0001)
    const y0 = Math.floor(minY + 0.0001)
    const y1 = Math.floor(maxY - 0.0001)
    const z0 = Math.floor(minZ + 0.0001)
    const z1 = Math.floor(maxZ - 0.0001)

    for (let bx = x0; bx <= x1; bx++) {
      for (let by = y0; by <= y1; by++) {
        for (let bz = z0; bz <= z1; bz++) {
          if (by < 0 || by >= WORLD_HEIGHT) continue
          if (!isSolid(this.world.getBlock(bx, by, bz))) continue
          hit = true
          if (axis === 'x') {
            if (amount > 0) limit = Math.min(limit, bx - HALF_WIDTH)
            else limit = Math.max(limit, bx + 1 + HALF_WIDTH)
          } else if (axis === 'z') {
            if (amount > 0) limit = Math.min(limit, bz - HALF_WIDTH)
            else limit = Math.max(limit, bz + 1 + HALF_WIDTH)
          } else {
            if (amount > 0) limit = Math.min(limit, by - HEIGHT)
            else {
              limit = Math.max(limit, by + 1)
              this.onGround = true
            }
          }
        }
      }
    }

    if (hit) {
      this.position[axis] = limit
      if (axis === 'y') {
        if (amount < 0 && this.velocity.y < 0) {
          if (this.velocity.y < -12) this.callbacks.onLand?.(this.velocity.y)
          this.velocity.y = 0
        } else if (amount > 0) {
          this.velocity.y = 0
        }
      } else {
        this.velocity[axis] = 0
      }
    }
  }

  getEyePosition(target = new THREE.Vector3()) {
    return target.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z)
  }

  getLookDirection(target = new THREE.Vector3()) {
    const cos = Math.cos(this.pitch)
    return target.set(-Math.sin(this.yaw) * cos, Math.sin(this.pitch), -Math.cos(this.yaw) * cos)
  }

  playerBoxIntersects(x, y, z) {
    return (
      x + 1 > this.position.x - HALF_WIDTH &&
      x < this.position.x + HALF_WIDTH &&
      y + 1 > this.position.y &&
      y < this.position.y + HEIGHT &&
      z + 1 > this.position.z - HALF_WIDTH &&
      z < this.position.z + HALF_WIDTH
    )
  }
}
