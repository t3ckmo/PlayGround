import * as THREE from 'three'
import {
  AIR,
  BLOCKS,
  WATER,
  GRASS,
  LEAVES,
  GLASS,
  BEDROCK,
  TILES,
  tileFor,
  isOpaque,
  isSolid,
  isLiquid
} from './blocks.js'
import { CHUNK_SIZE, WORLD_HEIGHT, createGenerator } from './worldgen.js'
import { hash2 } from './noise.js'

export const RENDER_DISTANCE = 5
export const FOG_NEAR = 46
export const FOG_FAR = 74

const AXES = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
]

const FACES = [
  {
    n: [1, 0, 0],
    uAxis: 2,
    vAxis: 1,
    shade: 0.76,
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1]
    ],
    uv: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0]
    ]
  },
  {
    n: [-1, 0, 0],
    uAxis: 2,
    vAxis: 1,
    shade: 0.71,
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0]
    ],
    uv: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0]
    ]
  },
  {
    n: [0, 1, 0],
    uAxis: 0,
    vAxis: 2,
    shade: 1.0,
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0]
    ],
    uv: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ]
  },
  {
    n: [0, -1, 0],
    uAxis: 0,
    vAxis: 2,
    shade: 0.5,
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1]
    ],
    uv: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ]
  },
  {
    n: [0, 0, 1],
    uAxis: 0,
    vAxis: 1,
    shade: 0.86,
    corners: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1]
    ],
    uv: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0]
    ]
  },
  {
    n: [0, 0, -1],
    uAxis: 0,
    vAxis: 1,
    shade: 0.64,
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0]
    ],
    uv: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ]
  }
]

const AO_LEVELS = [0.45, 0.64, 0.83, 1.0]

function chunkKey(cx, cz) {
  return cx + ',' + cz
}

export class World {
  constructor(scene, atlas, seed, savedEdits = []) {
    this.scene = scene
    this.atlas = atlas
    this.seed = seed >>> 0
    this.generator = createGenerator(this.seed)
    this.chunks = new Map()
    this.edits = new Map()
    this.editsByChunk = new Map()
    this.buildOrder = []
    this.frames = 0
    this.spawn = this.generator.findSpawn()

    for (const entry of savedEdits) {
      const [x, y, z, id] = entry
      this.edits.set(`${x},${y},${z}`, id)
      this.registerChunkEdit(x, y, z, id)
    }

    const materialOptions = {
      map: atlas.texture,
      vertexColors: true,
      side: THREE.FrontSide
    }
    this.solidMaterial = new THREE.MeshBasicMaterial({
      ...materialOptions,
      alphaTest: 0.5
    })
    this.waterMaterial = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
      side: THREE.DoubleSide
    })

    for (let radius = 0; radius <= RENDER_DISTANCE; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) === radius) this.buildOrder.push([dx, dz])
        }
      }
    }
    this.buildOrder.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]))
  }

  registerChunkEdit(x, y, z, id) {
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    const key = chunkKey(cx, cz)
    let map = this.editsByChunk.get(key)
    if (!map) {
      map = new Map()
      this.editsByChunk.set(key, map)
    }
    map.set(`${x},${y},${z}`, id)
  }

  hasChunk(cx, cz) {
    return this.chunks.has(chunkKey(cx, cz))
  }

  ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz)
    let chunk = this.chunks.get(key)
    if (chunk) return chunk

    const edits = this.editsByChunk.get(key)
    const data = this.generator.generateChunk(cx, cz, edits)
    chunk = {
      cx,
      cz,
      data,
      mesh: null,
      waterMesh: null,
      dirty: true,
      meshed: false
    }
    this.chunks.set(key, chunk)

    for (const [ox, oz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ]) {
      const neighbor = this.chunks.get(chunkKey(cx + ox, cz + oz))
      if (neighbor && neighbor.meshed) neighbor.dirty = true
    }

    return chunk
  }

  getBlock(x, y, z) {
    if (y < 0) return BEDROCK // keeps the player from falling out of the world
    if (y >= WORLD_HEIGHT) return AIR
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    const chunk = this.chunks.get(chunkKey(cx, cz))
    if (!chunk) return AIR
    const lx = x - cx * CHUNK_SIZE
    const lz = z - cz * CHUNK_SIZE
    return chunk.data[y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx]
  }

  isSolidAt(x, y, z) {
    return isSolid(this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)))
  }

  setBlock(x, y, z, id, options = {}) {
    x = Math.floor(x)
    y = Math.floor(y)
    z = Math.floor(z)
    if (y < 0 || y >= WORLD_HEIGHT) return false
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    const chunk = this.ensureChunk(cx, cz)
    const lx = x - cx * CHUNK_SIZE
    const lz = z - cz * CHUNK_SIZE
    const index = y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx
    if (chunk.data[index] === id) return false

    chunk.data[index] = id
    chunk.dirty = true

    if (options.record !== false) {
      const key = `${x},${y},${z}`
      this.edits.set(key, id)
      this.registerChunkEdit(x, y, z, id)
    }

    if (lx === 0) this.markDirty(cx - 1, cz)
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz)
    if (lz === 0) this.markDirty(cx, cz - 1)
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1)
    return true
  }

  markDirty(cx, cz) {
    const chunk = this.chunks.get(chunkKey(cx, cz))
    if (chunk) chunk.dirty = true
  }

  clearSpawnArea(x, y, z, radius = 2, height = 4) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = 0; dy < height; dy++) {
          const id = this.getBlock(x + dx, y + dy, z + dz)
          if (id !== AIR && id !== WATER && id !== BEDROCK) {
            this.setBlock(x + dx, y + dy, z + dz, AIR)
          }
        }
      }
    }
  }

  async preload(onProgress, initialRadius = 3) {
    const totalChunks = (initialRadius * 2 + 3) ** 2
    let done = 0
    const dataRadius = initialRadius + 1

    for (let radius = 0; radius <= dataRadius; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue
          this.ensureChunk(dx, dz)
          done++
          if (done % 12 === 0) {
            onProgress?.(Math.min(58, (done / totalChunks) * 58))
            await nextFrame()
          }
        }
      }
    }

    const meshTotal = (initialRadius * 2 + 1) ** 2
    let meshed = 0
    for (let radius = 0; radius <= initialRadius; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue
          const chunk = this.ensureChunk(dx, dz)
          this.buildChunkMesh(chunk)
          meshed++
          if (meshed % 6 === 0) {
            onProgress?.(58 + (meshed / meshTotal) * 42)
            await nextFrame()
          }
        }
      }
    }
    onProgress?.(100)
  }

  update(px, pz, budgetMs = 6) {
    const centerX = Math.floor(px / CHUNK_SIZE)
    const centerZ = Math.floor(pz / CHUNK_SIZE)
    const start = performance.now()
    let rebuilt = 0

    for (const [dx, dz] of this.buildOrder) {
      const cx = centerX + dx
      const cz = centerZ + dz
      const chunk = this.ensureChunk(cx, cz)
      if (!chunk.dirty && chunk.meshed) continue

      // Meshing needs neighboring data for culling and ambient occlusion.
      this.ensureChunk(cx + 1, cz)
      this.ensureChunk(cx - 1, cz)
      this.ensureChunk(cx, cz + 1)
      this.ensureChunk(cx, cz - 1)
      this.ensureChunk(cx + 1, cz + 1)
      this.ensureChunk(cx - 1, cz - 1)
      this.ensureChunk(cx + 1, cz - 1)
      this.ensureChunk(cx - 1, cz + 1)
      this.buildChunkMesh(chunk)
      rebuilt++
      if (performance.now() - start > budgetMs) break
    }

    this.frames++
    if (this.frames % 90 === 0) this.unloadFar(centerX, centerZ)
    return rebuilt
  }

  unloadFar(centerX, centerZ) {
    const limit = RENDER_DISTANCE + 2
    for (const [key, chunk] of this.chunks) {
      if (Math.abs(chunk.cx - centerX) <= limit && Math.abs(chunk.cz - centerZ) <= limit) continue
      this.disposeChunk(chunk)
      this.chunks.delete(key)
    }
  }

  disposeChunk(chunk) {
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh)
      chunk.mesh.geometry.dispose()
      chunk.mesh = null
    }
    if (chunk.waterMesh) {
      this.scene.remove(chunk.waterMesh)
      chunk.waterMesh.geometry.dispose()
      chunk.waterMesh = null
    }
  }

  buildChunkMesh(chunk) {
    const ring = []
    for (let oz = -1; oz <= 1; oz++) {
      for (let ox = -1; ox <= 1; ox++) {
        ring.push(ox === 0 && oz === 0 ? chunk : this.chunks.get(chunkKey(chunk.cx + ox, chunk.cz + oz)) || null)
      }
    }

    const data = chunk.data
    const get = (x, y, z) => {
      if (y < 0 || y >= WORLD_HEIGHT) return AIR
      const rx = x < 0 ? -1 : x >= CHUNK_SIZE ? 1 : 0
      const rz = z < 0 ? -1 : z >= CHUNK_SIZE ? 1 : 0
      const record = ring[(rz + 1) * 3 + (rx + 1)]
      if (!record) return AIR
      const lx = x - rx * CHUNK_SIZE
      const lz = z - rz * CHUNK_SIZE
      return record.data[y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx]
    }

    const positions = []
    const uvs = []
    const colors = []
    const indices = []
    const waterPositions = []
    const waterUvs = []
    const waterColors = []
    const waterIndices = []

    const pushVertex = (list, px, py, pz, u, v, shade, tile, ao = 1) => {
      list.pos.push(px, py, pz)
      list.uv.push(...this.atlas.uv(tile, u, v))
      const c = shade * ao
      list.col.push(c, c, c)
    }

    const solid = { pos: positions, uv: uvs, col: colors }
    const water = { pos: waterPositions, uv: waterUvs, col: waterColors }

    const addFace = (list, indicesList, x, y, z, face, tile, aoValues) => {
      const base = list.pos.length / 3
      for (let i = 0; i < 4; i++) {
        const corner = face.corners[i]
        const uv = face.uv[i]
        pushVertex(list, x + corner[0], y + corner[1], z + corner[2], uv[0], uv[1], face.shade, tile, aoValues[i])
      }
      if (aoValues[0] + aoValues[2] > aoValues[1] + aoValues[3]) {
        indicesList.push(base + 1, base + 2, base + 3, base + 1, base + 3, base)
      } else {
        indicesList.push(base, base + 1, base + 2, base, base + 2, base + 3)
      }
    }

    const aoFor = (face, x, y, z) => {
      const values = [1, 1, 1, 1]
      const n = face.n
      const uAxis = AXES[face.uAxis]
      const vAxis = AXES[face.vAxis]
      for (let i = 0; i < 4; i++) {
        const corner = face.corners[i]
        const du = corner[face.uAxis] ? 1 : -1
        const dv = corner[face.vAxis] ? 1 : -1
        const bx = x + n[0]
        const by = y + n[1]
        const bz = z + n[2]
        const s1 = isOpaque(get(bx + uAxis[0] * du, by + uAxis[1] * du, bz + uAxis[2] * du)) ? 1 : 0
        const s2 = isOpaque(get(bx + vAxis[0] * dv, by + vAxis[1] * dv, bz + vAxis[2] * dv)) ? 1 : 0
        const cornerOccluded =
          s1 && s2
            ? 1
            : isOpaque(
                get(
                  bx + uAxis[0] * du + vAxis[0] * dv,
                  by + uAxis[1] * du + vAxis[1] * dv,
                  bz + uAxis[2] * du + vAxis[2] * dv
                )
              )
              ? 1
              : 0
        const level = 3 - s1 - s2 - cornerOccluded
        values[i] = AO_LEVELS[level]
      }
      return values
    }

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = data[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x]
          if (id === AIR) continue

          if (id === WATER) {
            for (let f = 0; f < FACES.length; f++) {
              const face = FACES[f]
              const nx = x + face.n[0]
              const ny = y + face.n[1]
              const nz = z + face.n[2]
              const neighbor = get(nx, ny, nz)
              if (f === 2) {
                if (neighbor !== AIR && !(BLOCKS[neighbor] && BLOCKS[neighbor].cutout)) continue
              } else if (f === 3) {
                if (neighbor !== AIR && !(BLOCKS[neighbor] && BLOCKS[neighbor].cutout)) continue
              } else if (neighbor !== AIR && !(BLOCKS[neighbor] && BLOCKS[neighbor].cutout)) {
                continue
              }
              addFace(water, waterIndices, x, y, z, face, TILES.water, [1, 1, 1, 1])
            }
            continue
          }

          const block = BLOCKS[id]
          if (!block) continue
          const cutout = block.cutout

          for (let f = 0; f < FACES.length; f++) {
            const face = FACES[f]
            const neighbor = get(x + face.n[0], y + face.n[1], z + face.n[2])
            let visible
            if (cutout) {
              visible = neighbor === AIR || neighbor === WATER || (neighbor !== id && BLOCKS[neighbor]?.cutout)
            } else {
              visible = !isOpaque(neighbor)
            }
            if (!visible) continue

            const tile = tileFor(block, f)
            const ao = aoFor(face, x, y, z)
            addFace(solid, indices, x, y, z, face, tile, ao)
          }
        }
      }
    }

    // Grass tufts and flowers add life without needing extra chunk data.
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 1; y < WORLD_HEIGHT - 2; y++) {
          if (data[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] !== GRASS) continue
          if (data[(y + 1) * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] !== AIR) continue
          const wx = chunk.cx * CHUNK_SIZE + x
          const wz = chunk.cz * CHUNK_SIZE + z
          const roll = hash2(wx, wz, this.seed + 900)
          if (roll > 0.19) continue
          const flower = roll < 0.022
          const tile = flower
            ? hash2(wx, wz, this.seed + 901) > 0.5
              ? TILES.flowerRed
              : TILES.flowerYellow
            : TILES.tuft
          const ox = x + 0.15 + hash2(wx, wz, this.seed + 902) * 0.7
          const oz = z + 0.15 + hash2(wx, wz, this.seed + 903) * 0.7
          const size = 0.34 + hash2(wx, wz, this.seed + 904) * 0.12
          const top = y + 1 + 0.55 + hash2(wx, wz, this.seed + 905) * 0.3
          const yBase = y + 1
          const shade = 0.92

          const addPlant = (ax, az, bx, bz) => {
            for (const flip of [false, true]) {
              const base = positions.length / 3
              const verts = [
                [ax, yBase, az],
                [bx, yBase, bz],
                [bx, top, bz],
                [ax, top, az]
              ]
              const uvsQ = [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1]
              ]
              for (let i = 0; i < 4; i++) {
                const v = flip ? 3 - i : i
                positions.push(verts[i][0], verts[i][1], verts[i][2])
                uvs.push(...this.atlas.uv(tile, uvsQ[i][0], uvsQ[i][1]))
                colors.push(shade, shade, shade)
              }
              if (flip) indices.push(base, base + 2, base + 1, base, base + 3, base + 2)
              else indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
            }
          }

          addPlant(ox - size, oz - size, ox + size, oz + size)
          addPlant(ox - size, oz + size, ox + size, oz - size)
        }
      }
    }

    const buildGeometry = (list, indexList) => {
      if (indexList.length === 0) return null
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(list.pos, 3))
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(list.uv, 2))
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(list.col, 3))
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indexList), 1))
      geometry.computeBoundingSphere()
      return geometry
    }

    if (chunk.mesh) {
      this.scene.remove(chunk.mesh)
      chunk.mesh.geometry.dispose()
      chunk.mesh = null
    }
    if (chunk.waterMesh) {
      this.scene.remove(chunk.waterMesh)
      chunk.waterMesh.geometry.dispose()
      chunk.waterMesh = null
    }

    const solidGeometry = buildGeometry(solid, indices)
    if (solidGeometry) {
      const mesh = new THREE.Mesh(solidGeometry, this.solidMaterial)
      mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE)
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
      this.scene.add(mesh)
      chunk.mesh = mesh
    }

    const waterGeometry = buildGeometry(water, waterIndices)
    if (waterGeometry) {
      const mesh = new THREE.Mesh(waterGeometry, this.waterMaterial)
      mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE)
      mesh.renderOrder = 2
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
      this.scene.add(mesh)
      chunk.waterMesh = mesh
    }

    chunk.meshed = true
    chunk.dirty = false
  }

  raycast(origin, direction, maxDistance = 7) {
    let x = Math.floor(origin.x)
    let y = Math.floor(origin.y)
    let z = Math.floor(origin.z)
    const stepX = Math.sign(direction.x)
    const stepY = Math.sign(direction.y)
    const stepZ = Math.sign(direction.z)
    const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / direction.x)
    const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / direction.y)
    const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / direction.z)
    let tMaxX =
      stepX === 0 ? Infinity : stepX > 0 ? (x + 1 - origin.x) / direction.x : (origin.x - x) / -direction.x
    let tMaxY =
      stepY === 0 ? Infinity : stepY > 0 ? (y + 1 - origin.y) / direction.y : (origin.y - y) / -direction.y
    let tMaxZ =
      stepZ === 0 ? Infinity : stepZ > 0 ? (z + 1 - origin.z) / direction.z : (origin.z - z) / -direction.z
    let normal = [0, 0, 0]
    let t = 0

    for (let i = 0; i < 128 && t <= maxDistance; i++) {
      const id = this.getBlock(x, y, z)
      if (id !== AIR && !isLiquid(id)) {
        return { x, y, z, normal: [...normal], block: id }
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX
        t = tMaxX
        tMaxX += tDeltaX
        normal = [-stepX, 0, 0]
      } else if (tMaxY < tMaxZ) {
        y += stepY
        t = tMaxY
        tMaxY += tDeltaY
        normal = [0, -stepY, 0]
      } else {
        z += stepZ
        t = tMaxZ
        tMaxZ += tDeltaZ
        normal = [0, 0, -stepZ]
      }
    }
    return null
  }

  serializeEdits() {
    const edits = []
    for (const [key, id] of this.edits) {
      const [x, y, z] = key.split(',').map(Number)
      edits.push([x, y, z, id])
    }
    return edits
  }
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
