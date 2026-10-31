import {
  Group,
  Mesh,
  MeshLambertMaterial,
  DoubleSide,
} from 'three';
import { createNoise2D, fbm, smoothstep, clamp, hash2, hash3, mulberry32 } from './noise.js';
import {
  AIR,
  BEDROCK,
  DIRT,
  GRASS,
  GRAVEL,
  LEAVES,
  LOG,
  SAND,
  SNOW,
  STONE,
  WATER,
  isOpaque,
  isSolid,
} from './blocks.js';
import { buildChunkGeometry } from './mesher.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 72;
export const SEA_LEVEL = 24;

const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;

const keyOf = (cx, cz) => `${cx},${cz}`;
const indexOf = (x, y, z) => x + z * CHUNK_SIZE + y * CHUNK_AREA;

export class World {
  constructor({ scene, seed, atlas, waterTexture }) {
    this.scene = scene;
    this.seed = seed >>> 0;
    this.atlas = atlas;
    this.height = WORLD_HEIGHT;
    this.chunks = new Map();
    this.edits = new Map();
    this.group = new Group();
    this.group.name = 'world';
    scene.add(this.group);

    this.continentNoise = createNoise2D(this.seed);
    this.hillNoise = createNoise2D(this.seed ^ 0x1b56c4e9);
    this.detailNoise = createNoise2D(this.seed ^ 0x9e3779b1);
    this.ridgeNoise = createNoise2D(this.seed ^ 0x7f4a7c15);
    this.tempNoise = createNoise2D(this.seed ^ 0x2545f491);
    this.moistNoise = createNoise2D(this.seed ^ 0x6a09e667);

    this.material = new MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
      alphaTest: 0.45,
    });
    this.material.name = 'voxel';

    this.waterMaterial = new MeshLambertMaterial({
      map: waterTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: DoubleSide,
    });
    this.waterMaterial.name = 'water';

    this.dirtyQueue = new Set();
    this.spawnGuard = null;
  }

  /* ------------------------------------------------------------------ */
  /* Terrain shape                                                       */
  /* ------------------------------------------------------------------ */

  heightAt(gx, gz) {
    const continent = fbm(this.continentNoise, gx * 0.0018, gz * 0.0018, 4);
    const hills = fbm(this.hillNoise, gx * 0.012, gz * 0.012, 4);
    const detail = fbm(this.detailNoise, gx * 0.06, gz * 0.06, 3);
    const ridgeRaw = fbm(this.ridgeNoise, gx * 0.0045 + 37, gz * 0.0045 - 61, 4);
    const ridge = 1 - Math.abs(ridgeRaw) * 2.2;
    const mountain = smoothstep(0.78, 0.99, ridge);
    const h =
      SEA_LEVEL +
      2 +
      continent * 15 +
      hills * 7 +
      detail * 1.8 +
      mountain * 26;
    return clamp(Math.floor(h), 3, WORLD_HEIGHT - 12);
  }

  temperatureAt(gx, gz) {
    return fbm(this.tempNoise, gx * 0.0032 + 11, gz * 0.0032 - 23, 3);
  }

  moistureAt(gx, gz) {
    return fbm(this.moistNoise, gx * 0.0038 - 41, gz * 0.0038 + 17, 3);
  }

  biomeAt(gx, gz, height = this.heightAt(gx, gz)) {
    const temp = this.temperatureAt(gx, gz);
    const moist = this.moistureAt(gx, gz);
    if (height > 50 || temp < -0.3) return 'snow';
    if (temp > 0.19 && moist < 0.03) return 'desert';
    if (moist > 0.1) return 'forest';
    return 'plains';
  }

  surfaceBlockAt(gx, gz, height = this.heightAt(gx, gz)) {
    if (height < SEA_LEVEL) return SAND;
    if (height <= SEA_LEVEL + 2) return SAND;
    const biome = this.biomeAt(gx, gz, height);
    if (biome === 'snow') return SNOW;
    if (biome === 'desert') return SAND;
    return GRASS;
  }

  findSpawn() {
    // Two-stage search: cheaply score a dense grid, then run the expensive
    // view-cone analysis on the most promising handful of spots.
    const candidates = [];
    const collect = (step, limit) => {
      candidates.length = 0;
      for (let gz = -limit; gz <= limit; gz += step) {
        for (let gx = -limit; gx <= limit; gx += step) {
          const h = this.heightAt(gx, gz);
          if (h < SEA_LEVEL + 2 || h > SEA_LEVEL + 18) continue;
          if (this.surfaceBlockAt(gx, gz, h) !== GRASS) continue;
          const biome = this.biomeAt(gx, gz, h);
          if (biome === 'desert' || biome === 'snow') continue;

          let minH = 999;
          let maxH = -999;
          for (let dz = -8; dz <= 8; dz += 4) {
            for (let dx = -8; dx <= 8; dx += 4) {
              const hh = this.heightAt(gx + dx, gz + dz);
              minH = Math.min(minH, hh);
              maxH = Math.max(maxH, hh);
            }
          }
          if (maxH - minH > 4) continue;

          let land = 0;
          let landSamples = 0;
          for (let dz = -16; dz <= 16; dz += 8) {
            for (let dx = -16; dx <= 16; dx += 8) {
              landSamples++;
              if (this.heightAt(gx + dx, gz + dz) > SEA_LEVEL) land++;
            }
          }
          const landRatio = land / landSamples;
          if (landRatio < 0.5) continue;

          let trees = 0;
          for (let dz = -10; dz <= 10; dz += 5) {
            for (let dx = -10; dx <= 10; dx += 5) {
              if (dx === 0 && dz === 0) continue;
              if (this.treeAt(gx + dx, gz + dz)) trees++;
            }
          }

          const flat = 4 - (maxH - minH);
          const cheap =
            -trees * 3 +
            flat * 0.9 +
            landRatio * 6 -
            Math.abs(h - (SEA_LEVEL + 7)) * 0.3 -
            Math.hypot(gx, gz) * 0.03;
          candidates.push({ x: gx, z: gz, h, cheap });
        }
      }
    };

    collect(4, 64);
    if (candidates.length === 0) collect(8, 160);
    candidates.sort((a, b) => b.cheap - a.cheap);

    let best = null;
    for (const candidate of candidates.slice(0, 36)) {
      const { x: gx, z: gz, h } = candidate;

      // Count every trunk in the immediate clearing (the spawn guard will
      // remove the innermost ones, so trunks just outside it matter most).
      let clearing = 0;
      for (let dz = -8; dz <= 8; dz++) {
        for (let dx = -8; dx <= 8; dx++) {
          if (dx * dx + dz * dz > 64) continue;
          if (dx === 0 && dz === 0) continue;
          if (this.treeAt(gx + dx, gz + dz)) clearing++;
        }
      }

      // Pick the most open, scenic direction. Sample a cone rather than a
      // single line so a trunk just off-centre cannot fill the opening view.
      let view = null;
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        const dx = Math.cos(ang);
        const dz = Math.sin(ang);
        const px = -dz;
        const pz = dx;
        let open = 0;
        let water = 0;
        let sight = 0;
        let blocked = 0;
        for (const dist of [3, 6, 9, 13, 18, 24, 34, 46]) {
          const hh = this.heightAt(gx + Math.round(dx * dist), gz + Math.round(dz * dist));
          if (hh <= h + 1) open++;
          if (hh < SEA_LEVEL) water += dist >= 18 ? 1.7 : 0.5;
          else sight += 0.35;
          if (dist <= 9 && hh > h + 2) blocked += 2.5;
          else if (hh > h + 12) blocked += 0.4;
        }
        let trees = 0;
        for (const dist of [3, 5, 7, 10, 14]) {
          const lateral = dist <= 7 ? [-4, -2, 0, 2, 4] : dist <= 10 ? [-2, 0, 2] : [0];
          for (const lat of lateral) {
            if (
              this.treeAt(
                gx + Math.round(dx * dist + px * lat),
                gz + Math.round(dz * dist + pz * lat),
              )
            ) {
              trees += dist <= 7 ? 3.5 : 1.5;
            }
          }
        }
        const score = open * 1.1 + water + sight - trees - blocked;
        if (!view || score > view.score) view = { angle: ang, score };
      }

      const score = candidate.cheap + view.score - clearing * 2.5;
      if (!best || score > best.score) {
        best = {
          x: gx,
          z: gz,
          h,
          score,
          yaw: Math.atan2(-Math.cos(view.angle), -Math.sin(view.angle)),
        };
      }
    }

    if (!best) {
      const h = this.heightAt(0, 0);
      best = {
        x: 0,
        z: 0,
        h: Math.max(h, SEA_LEVEL + 1),
        score: 0,
        yaw: this.scenicYaw(0, 0),
      };
    }
    // Keep the spawn clearing free of tree trunks so the opening view is never
    // a wall of bark. Trees are stamped from this pure function, so the guard
    // is honoured by every chunk generated from here on.
    this.spawnGuard = { x: best.x, z: best.z };
    return best;
  }

  scenicYaw(gx, gz) {
    let bestAngle = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      let water = 0;
      let land = 0;
      let nearLand = 0;
      for (const dist of [10, 16, 24, 32, 40]) {
        const h = this.heightAt(gx + Math.round(Math.cos(a) * dist), gz + Math.round(Math.sin(a) * dist));
        if (h < SEA_LEVEL) {
          water += dist > 18 ? 1.6 : 0.7;
        } else {
          land += 1;
          if (dist <= 16) nearLand += 1;
        }
      }
      const score = water + land * 0.35 + nearLand * 0.5 - Math.max(0, water - 6) * 0.8;
      if (score > bestScore) {
        bestScore = score;
        bestAngle = a;
      }
    }
    const dx = Math.cos(bestAngle);
    const dz = Math.sin(bestAngle);
    return Math.atan2(-dx, -dz);
  }

  /* ------------------------------------------------------------------ */
  /* Chunk data                                                          */
  /* ------------------------------------------------------------------ */

  treeAt(gx, gz) {
    if (this.spawnGuard) {
      const dx = gx - this.spawnGuard.x;
      const dz = gz - this.spawnGuard.z;
      if (dx * dx + dz * dz <= 16) return false;
    }
    const h = this.heightAt(gx, gz);
    if (h <= SEA_LEVEL + 1 || h > 49) return false;
    const biome = this.biomeAt(gx, gz, h);
    if (biome === 'desert' || biome === 'snow') return false;
    const slope = Math.max(
      Math.abs(this.heightAt(gx + 1, gz) - h),
      Math.abs(this.heightAt(gx - 1, gz) - h),
      Math.abs(this.heightAt(gx, gz + 1) - h),
      Math.abs(this.heightAt(gx, gz - 1) - h),
    );
    if (slope > 1) return false;
    const moist = this.moistureAt(gx, gz);
    const density = biome === 'forest' ? 0.028 + Math.max(0, moist) * 0.05 : 0.007 + Math.max(0, moist) * 0.014;
    return hash2(gx, gz, this.seed ^ 0x5eed1234) < density;
  }

  stampTree(data, x0, z0, gx, gz) {
    const h = this.heightAt(gx, gz);
    const rng = mulberry32((hash2(gx, gz, this.seed ^ 0xabad1dea) * 0xffffffff) >>> 0);
    const trunkHeight = 4 + Math.floor(rng() * 3);
    const topY = h + trunkHeight;
    const set = (x, y, z, id, replaceAirOnly = false) => {
      const lx = x - x0;
      const lz = z - z0;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
      if (y < 0 || y >= this.height) return;
      const idx = indexOf(lx, y, lz);
      if (replaceAirOnly && data[idx] !== AIR) return;
      data[idx] = id;
    };

    for (let i = 1; i <= trunkHeight; i++) set(gx, h + i, gz, LOG);

    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy <= -1 ? 2 : 1;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx === 0 && dz === 0 && dy < 1) continue;
          if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && rng() < 0.55) continue;
          set(gx + dx, topY + dy, gz + dz, LEAVES, true);
        }
      }
    }
    set(gx, topY + 1, gz, LEAVES, true);
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * this.height);
    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const gx = x0 + lx;
        const gz = z0 + lz;
        const h = this.heightAt(gx, gz);
        const surface = this.surfaceBlockAt(gx, gz, h);
        const sub = surface === SAND ? SAND : surface === SNOW ? DIRT : DIRT;
        const underwater = h < SEA_LEVEL;

        data[indexOf(lx, 0, lz)] = BEDROCK;
        for (let y = 1; y <= h; y++) {
          let id = STONE;
          if (y === h) id = surface;
          else if (y >= h - 3) id = sub;
          else if (y > 1 && hash3(gx, y, gz, this.seed ^ 0x51ed) < 0.012) id = GRAVEL;
          data[indexOf(lx, y, lz)] = id;
        }

        if (underwater) {
          for (let y = h + 1; y <= SEA_LEVEL; y++) data[indexOf(lx, y, lz)] = WATER;
        }
      }
    }

    // Trees are deterministic in world space, so stamp any that reach this chunk.
    for (let gz = z0 - 3; gz < z0 + CHUNK_SIZE + 3; gz++) {
      for (let gx = x0 - 3; gx < x0 + CHUNK_SIZE + 3; gx++) {
        if (this.treeAt(gx, gz)) this.stampTree(data, x0, z0, gx, gz);
      }
    }

    const edits = this.edits.get(keyOf(cx, cz));
    if (edits) {
      for (const [idx, id] of edits) data[idx] = id;
    }

    return data;
  }

  ensureData(cx, cz) {
    const key = keyOf(cx, cz);
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;
    chunk = {
      cx,
      cz,
      key,
      data: this.generateChunk(cx, cz),
      mesh: null,
      waterMesh: null,
      dirty: true,
      meshed: false,
    };
    this.chunks.set(key, chunk);

    // A new neighbour changes which border faces are visible.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const other = this.chunks.get(keyOf(cx + dx, cz + dz));
      if (other && other.meshed) other.dirty = true;
    }
    return chunk;
  }

  getChunk(cx, cz) {
    return this.chunks.get(keyOf(cx, cz)) ?? null;
  }

  getBlock(x, y, z) {
    if (y < 0) return BEDROCK;
    if (y >= this.height) return AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(keyOf(cx, cz));
    if (!chunk) return AIR;
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return chunk.data[indexOf(lx, y, lz)];
  }

  isSolidAt(x, y, z) {
    return isSolid(this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
  }

  isWaterAt(x, y, z) {
    return this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === WATER;
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= this.height) return false;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.ensureData(cx, cz);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    const idx = indexOf(lx, y, lz);
    if (chunk.data[idx] === id) return false;
    chunk.data[idx] = id;

    const key = keyOf(cx, cz);
    let edits = this.edits.get(key);
    if (!edits) {
      edits = new Map();
      this.edits.set(key, edits);
    }
    edits.set(idx, id);

    chunk.dirty = true;
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
    return true;
  }

  markDirty(cx, cz) {
    const chunk = this.chunks.get(keyOf(cx, cz));
    if (chunk) chunk.dirty = true;
  }

  /* ------------------------------------------------------------------ */
  /* Meshing                                                             */
  /* ------------------------------------------------------------------ */

  meshChunk(chunk) {
    const { solid, water } = buildChunkGeometry(this, chunk, this.atlas.uv);
    this.disposeChunkMeshes(chunk);

    if (solid) {
      const mesh = new Mesh(solid, this.material);
      mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
      chunk.mesh = mesh;
    }
    if (water) {
      const mesh = new Mesh(water, this.waterMaterial);
      mesh.position.set(0, 0, 0);
      mesh.receiveShadow = false;
      mesh.renderOrder = 2;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
      chunk.waterMesh = mesh;
    }
    chunk.dirty = false;
    chunk.meshed = true;
  }

  disposeChunkMeshes(chunk) {
    if (chunk.mesh) {
      this.group.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    if (chunk.waterMesh) {
      this.group.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
      chunk.waterMesh = null;
    }
  }

  unloadChunk(chunk) {
    this.disposeChunkMeshes(chunk);
    this.chunks.delete(chunk.key);
  }

  /* ------------------------------------------------------------------ */
  /* Streaming                                                           */
  /* ------------------------------------------------------------------ */

  neededChunks(px, pz, radius) {
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    const list = [];
    const r2 = (radius + 0.4) * (radius + 0.4);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        list.push({ cx: pcx + dx, cz: pcz + dz, d2 });
      }
    }
    list.sort((a, b) => a.d2 - b.d2);
    return list;
  }

  prime(px, pz, radius) {
    const needed = this.neededChunks(px, pz, radius);
    for (const { cx, cz } of needed) this.ensureData(cx, cz);
    for (const { cx, cz } of needed) {
      const chunk = this.chunks.get(keyOf(cx, cz));
      if (chunk) this.meshChunk(chunk);
    }
  }

  update(px, pz, radius, { genBudget = 3, meshBudget = 6 } = {}) {
    const needed = this.neededChunks(px, pz, radius);
    let generated = 0;
    for (const { cx, cz } of needed) {
      if (this.chunks.has(keyOf(cx, cz))) continue;
      this.ensureData(cx, cz);
      generated++;
      if (generated >= genBudget) break;
    }

    const t0 = performance.now();
    let meshed = 0;
    for (const { cx, cz } of needed) {
      const chunk = this.chunks.get(keyOf(cx, cz));
      if (!chunk || !chunk.dirty) continue;
      this.meshChunk(chunk);
      meshed++;
      if (performance.now() - t0 >= meshBudget) break;
    }

    // Unload chunks that are comfortably outside the view radius.
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    const limit = radius + 2;
    for (const chunk of [...this.chunks.values()]) {
      if (Math.abs(chunk.cx - pcx) > limit || Math.abs(chunk.cz - pcz) > limit) {
        this.unloadChunk(chunk);
      }
    }

    let ready = 0;
    for (const { cx, cz } of needed) {
      const chunk = this.chunks.get(keyOf(cx, cz));
      if (chunk && chunk.meshed && !chunk.dirty) ready++;
    }
    return { ready, total: needed.length, generated, meshed };
  }

  /* ------------------------------------------------------------------ */
  /* Raycast + persistence                                               */
  /* ------------------------------------------------------------------ */

  raycast(origin, direction, maxDistance = 6) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = direction.x > 0 ? 1 : -1;
    const stepY = direction.y > 0 ? 1 : -1;
    const stepZ = direction.z > 0 ? 1 : -1;
    const tDeltaX = direction.x === 0 ? Infinity : Math.abs(1 / direction.x);
    const tDeltaY = direction.y === 0 ? Infinity : Math.abs(1 / direction.y);
    const tDeltaZ = direction.z === 0 ? Infinity : Math.abs(1 / direction.z);
    let tMaxX =
      direction.x === 0
        ? Infinity
        : (stepX > 0 ? x + 1 - origin.x : origin.x - x) / Math.abs(direction.x);
    let tMaxY =
      direction.y === 0
        ? Infinity
        : (stepY > 0 ? y + 1 - origin.y : origin.y - y) / Math.abs(direction.y);
    let tMaxZ =
      direction.z === 0
        ? Infinity
        : (stepZ > 0 ? z + 1 - origin.z : origin.z - z) / Math.abs(direction.z);

    let normal = [0, 0, 0];
    let t = 0;
    for (let guard = 0; guard < 128 && t <= maxDistance; guard++) {
      const id = this.getBlock(x, y, z);
      if (id !== AIR && id !== WATER) {
        return { x, y, z, id, normal };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        normal = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        normal = [0, -stepY, 0];
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        normal = [0, 0, -stepZ];
      }
    }
    return null;
  }

  serializeEdits() {
    const out = [];
    for (const [key, map] of this.edits) {
      const [cx, cz] = key.split(',').map(Number);
      for (const [idx, id] of map) {
        const y = Math.floor(idx / 256);
        const rem = idx % 256;
        const z = Math.floor(rem / 16);
        const x = rem % 16;
        out.push([cx * CHUNK_SIZE + x, y, cz * CHUNK_SIZE + z, id]);
      }
    }
    return out;
  }

  loadEdits(list) {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      if (!Array.isArray(entry) || entry.length !== 4) continue;
      const [x, y, z, id] = entry;
      const cx = Math.floor(x / CHUNK_SIZE);
      const cz = Math.floor(z / CHUNK_SIZE);
      const lx = x - cx * CHUNK_SIZE;
      const lz = z - cz * CHUNK_SIZE;
      const key = keyOf(cx, cz);
      let edits = this.edits.get(key);
      if (!edits) {
        edits = new Map();
        this.edits.set(key, edits);
      }
      edits.set(indexOf(lx, y, lz), id);
    }
  }

  dispose() {
    for (const chunk of this.chunks.values()) this.disposeChunkMeshes(chunk);
    this.chunks.clear();
    this.scene.remove(this.group);
    this.material.dispose();
    this.waterMaterial.dispose();
  }
}
