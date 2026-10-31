import { Vector3 } from 'three';

const EPS = 1e-4;

export class Player {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.position = new Vector3(0, 40, 0);
    this.velocity = new Vector3();
    this.width = 0.6;
    this.height = 1.8;
    this.eyeHeight = 1.62;
    this.yaw = 0;
    this.pitch = -0.08;
    this.onGround = false;
    this.inWater = false;
    this.headInWater = false;
    this.flying = false;
    this.sprinting = false;
    this.walkTime = 0;
    this.stepDistance = 0;
    this.fovKick = 0;
    this.roll = 0;
  }

  spawn(x, z, surfaceY, yaw) {
    this.position.set(x + 0.5, surfaceY + 1.02, z + 0.5);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = -0.1;
    this.onGround = false;
    this.flying = false;
    this.updateCamera(0);
  }

  look(dx, dy, sensitivity = 0.0022) {
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    const limit = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  }

  toggleFly() {
    this.flying = !this.flying;
    if (this.flying) this.velocity.y = 0;
    return this.flying;
  }

  collides() {
    const p = this.position;
    const half = this.width / 2;
    const minX = Math.floor(p.x - half + EPS);
    const maxX = Math.floor(p.x + half - EPS);
    const minY = Math.floor(p.y + EPS);
    const maxY = Math.floor(p.y + this.height - EPS);
    const minZ = Math.floor(p.z - half + EPS);
    const maxZ = Math.floor(p.z + half - EPS);
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.world.isSolidAt(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  intersectsBlock(x, y, z) {
    const p = this.position;
    const half = this.width / 2;
    return (
      p.x + half > x + EPS &&
      p.x - half < x + 1 - EPS &&
      p.y + this.height > y + EPS &&
      p.y < y + 1 - EPS &&
      p.z + half > z + EPS &&
      p.z - half < z + 1 - EPS
    );
  }

  moveAxis(axis, delta) {
    if (delta === 0) return false;
    const p = this.position;
    p[axis] += delta;
    if (!this.collides()) return false;

    const half = this.width / 2;
    if (axis === 'x') {
      if (delta > 0) p.x = Math.floor(p.x + half) - half - EPS;
      else p.x = Math.floor(p.x - half) + 1 + half + EPS;
      this.velocity.x = 0;
    } else if (axis === 'z') {
      if (delta > 0) p.z = Math.floor(p.z + half) - half - EPS;
      else p.z = Math.floor(p.z - half) + 1 + half + EPS;
      this.velocity.z = 0;
    } else {
      if (delta > 0) {
        p.y = Math.floor(p.y + this.height) - this.height - EPS;
      } else {
        p.y = Math.floor(p.y) + 1 + EPS;
        this.onGround = true;
      }
      this.velocity.y = 0;
    }
    return true;
  }

  update(dt, input) {
    const world = this.world;
    const feetWater = world.isWaterAt(this.position.x, this.position.y + 0.15, this.position.z);
    const bodyWater =
      feetWater || world.isWaterAt(this.position.x, this.position.y + 0.9, this.position.z);
    this.inWater = bodyWater;
    this.headInWater = world.isWaterAt(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z,
    );

    let ix = input.moveX;
    let iy = input.moveY;
    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }

    const yaw = this.yaw;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const wishX = forwardX * iy + rightX * ix;
    const wishZ = forwardZ * iy + rightZ * ix;

    this.sprinting = input.sprint && iy > 0.2 && !this.inWater;
    const speed = this.flying
      ? 13.5
      : this.inWater
        ? 3.3
        : this.sprinting
          ? 7.4
          : 4.8;

    const targetX = wishX * speed;
    const targetZ = wishZ * speed;
    const accel = this.flying ? 9 : this.onGround ? 16 : this.inWater ? 6 : 4.5;
    const blend = 1 - Math.exp(-accel * dt);
    this.velocity.x += (targetX - this.velocity.x) * blend;
    this.velocity.z += (targetZ - this.velocity.z) * blend;

    if (this.flying) {
      const up = (input.jump ? 1 : 0) - (input.descend ? 1 : 0);
      this.velocity.y += (up * 10 - this.velocity.y) * (1 - Math.exp(-10 * dt));
    } else if (this.inWater) {
      this.velocity.y -= 8.5 * dt;
      this.velocity.y *= 1 - Math.min(0.9, 2.4 * dt);
      if (input.jump) this.velocity.y = Math.min(this.velocity.y + 24 * dt, 4.4);
      this.velocity.y = Math.max(this.velocity.y, -5);
    } else {
      this.velocity.y -= 28 * dt;
      this.velocity.y = Math.max(this.velocity.y, -48);
      if (input.jump && this.onGround) {
        this.velocity.y = 8.5;
        this.onGround = false;
      }
    }

    this.onGround = false;
    this.moveAxis('x', this.velocity.x * dt);
    this.moveAxis('z', this.velocity.z * dt);
    this.moveAxis('y', this.velocity.y * dt);

    // Keep the player inside the playable height, just in case.
    if (this.position.y < -4) {
      this.position.y = 40;
      this.velocity.set(0, 0, 0);
    }

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround && horizontalSpeed > 0.6) {
      this.walkTime += dt * horizontalSpeed * 2.2;
      this.stepDistance += horizontalSpeed * dt;
    } else {
      this.walkTime += dt * 0.6;
    }

    const targetFovKick = this.sprinting ? 6 : 0;
    this.fovKick += (targetFovKick - this.fovKick) * (1 - Math.exp(-6 * dt));
    const targetRoll = this.flying ? 0 : -ix * 0.012;
    this.roll += (targetRoll - this.roll) * (1 - Math.exp(-8 * dt));

    this.updateCamera(dt);
  }

  updateCamera() {
    const bob =
      this.onGround && !this.flying
        ? Math.sin(this.walkTime * 2) * 0.035 + Math.abs(Math.sin(this.walkTime)) * 0.012
        : 0;
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight + bob,
      this.position.z,
    );
    this.camera.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }

  getEyePosition(out = new Vector3()) {
    return out.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z,
    );
  }

  getDirection(out = new Vector3()) {
    const cp = Math.cos(this.pitch);
    out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    return out;
  }
}
