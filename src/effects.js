import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from 'three';

const MAX_PARTICLES = 96;

export class Particles {
  constructor(scene, world) {
    this.world = world;
    this.geometry = new BoxGeometry(1, 1, 1);
    this.material = new MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new InstancedMesh(this.geometry, this.material, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
    this.mesh.instanceColor.setUsage(DynamicDrawUsage);
    scene.add(this.mesh);

    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        pos: new Vector3(),
        vel: new Vector3(),
        life: 0,
        maxLife: 1,
        size: 0.1,
        rotation: new Quaternion(),
        spin: new Vector3(),
      });
    }
    this.matrix = new Matrix4();
    this.quaternion = new Quaternion();
    this.euler = new Euler(0, 0, 0, 'XYZ');
    this.scale = new Vector3();
    this.color = new Color();
    this.dummy = new Vector3();
    this.cursor = 0;
    this.alive = 0;
  }

  burst(x, y, z, blockColor, count = 14, power = 1) {
    const base = new Color(blockColor);
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      p.active = true;
      p.pos.set(x + 0.5 + (Math.random() - 0.5) * 0.55, y + 0.5 + (Math.random() - 0.5) * 0.55, z + 0.5 + (Math.random() - 0.5) * 0.55);
      p.vel.set(
        (Math.random() - 0.5) * 3.6 * power,
        1.2 + Math.random() * 3.4 * power,
        (Math.random() - 0.5) * 3.6 * power,
      );
      p.life = 0.5 + Math.random() * 0.55;
      p.maxLife = p.life;
      p.size = 0.07 + Math.random() * 0.1;
      p.rotation.set(Math.random(), Math.random(), Math.random(), Math.random()).normalize();
      p.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      p.color = base.clone().multiplyScalar(0.75 + Math.random() * 0.5);
    }
    this.alive = Math.min(MAX_PARTICLES, this.alive + count);
  }

  splash(x, y, z, count = 12) {
    const p0 = this.particles[this.cursor];
    this.burst(x - 0.5, y - 0.5, z - 0.5, 0x7fc6e8, count, 0.8);
  }

  update(dt) {
    if (this.alive <= 0) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    let alive = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) {
        this.matrix.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.matrix);
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.matrix.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.matrix);
        continue;
      }
      alive++;
      p.vel.y -= 22 * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (this.world.isSolidAt(p.pos.x, p.pos.y, p.pos.z)) {
        p.pos.y += 0.06;
        p.vel.y = Math.abs(p.vel.y) * 0.22;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      const t = p.life / p.maxLife;
      const s = p.size * Math.min(1, t * 3);
      this.scale.set(s, s, s);
      this.quaternion.setFromEuler(
        this.euler.set(p.spin.x * dt, p.spin.y * dt, p.spin.z * dt, 'XYZ'),
      );
      p.rotation.multiply(this.quaternion);
      this.matrix.compose(p.pos, p.rotation, this.scale);
      this.mesh.setMatrixAt(i, this.matrix);
      this.mesh.setColorAt(i, p.color);
    }
    this.alive = alive;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
