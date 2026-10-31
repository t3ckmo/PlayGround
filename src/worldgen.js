import {
  fbm2,
  hash2,
  smoothstep,
  clamp
} from './noise.js'
import {
  AIR,
  GRASS,
  DIRT,
  STONE,
  SAND,
  SNOW,
  LOG,
  LEAVES,
  WATER,
  BEDROCK,
  SANDSTONE,
  GRAVEL
} from './blocks.js'

export const CHUNK_SIZE = 16
export const WORLD_HEIGHT = 80
export const SEA_LEVEL = 26

export const BIOME = {
  PLAINS: 'plains',
  FOREST: 'forest',
  DESERT: 'desert',
  SNOW: 'snow'
}

function ridgeNoise(x, z, seed, octaves = 3) {
  const value = fbm2(x, z, seed, octaves, 2, 0.5)
  const ridge = 1 - Math.abs(value * 2 - 1)
  return ridge * ridge
}

export function createGenerator(seed) {
  seed = seed >>> 0
  const columnCache = new Map()

  function rawColumn(wx, wz) {
    const continental = fbm2(wx * 0.0045, wz * 0.0045, seed + 101, 4)
    const hills = (fbm2(wx * 0.019, wz * 0.019, seed + 102, 3) - 0.5) * 9
    const detail = (fbm2(wx * 0.055, wz * 0.055, seed + 105, 2) - 0.5) * 2.2
    const mask = smoothstep(0.55, 0.84, fbm2(wx * 0.0027, wz * 0.0027, seed + 103, 3))
    const mountain = ridgeNoise(wx * 0.0062, wz * 0.0062, seed + 104, 3) * 34 * mask

    let height = Math.floor(21 + continental * 25 + hills + detail + mountain)
    height = clamp(height, 3, WORLD_HEIGHT - 11)

    const temperature = fbm2(wx * 0.0036 + 40, wz * 0.0036 - 17, seed + 201, 3)
    const moisture = fbm2(wx * 0.0052 - 9, wz * 0.0052 + 23, seed + 202, 3)

    let biome
    if (temperature < 0.34 || height > 54) biome = BIOME.SNOW
    else if (temperature > 0.65 && moisture < 0.42) biome = BIOME.DESERT
    else if (moisture > 0.57) biome = BIOME.FOREST
    else biome = BIOME.PLAINS

    return { height, biome, temperature, moisture }
  }

  function column(wx, wz) {
    const key = wx + ',' + wz
    const cached = columnCache.get(key)
    if (cached) return cached
    const value = rawColumn(wx, wz)
    if (columnCache.size > 300000) columnCache.clear()
    columnCache.set(key, value)
    return value
  }

  function topBlockFor(height, biome) {
    if (height <= SEA_LEVEL) {
      return height > SEA_LEVEL - 4 ? SAND : GRAVEL
    }
    if (biome === BIOME.DESERT) return SAND
    if (biome === BIOME.SNOW || height > 50) return SNOW
    return GRASS
  }

  function fillColumn(data, x, z, info) {
    const { height, biome } = info
    const top = topBlockFor(height, biome)
    const sub = biome === BIOME.DESERT || height <= SEA_LEVEL + 1 ? SAND : DIRT

    // Chunk data is zero-initialised (air), so only fill the column up to the
    // highest non-air block. This roughly halves the work for typical terrain.
    const maxY = Math.max(height, SEA_LEVEL)
    for (let y = 0; y <= maxY; y++) {
      let id = AIR
      if (y === 0 || (y === 1 && hash2(x + 17, z + 91, seed + 5) < 0.55)) {
        id = BEDROCK
      } else if (y < height - 3) {
        id = STONE
      } else if (y < height) {
        id = sub
        if (biome === BIOME.SNOW && height > 44) id = STONE
      } else if (y === height) {
        id = top
        if (height > 55 && biome !== BIOME.SNOW) id = STONE
      } else if (y <= SEA_LEVEL) {
        id = WATER
      }
      data[y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x] = id
    }
  }

  function setLocal(data, x, y, z, id, replaceSolid = false) {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return
    const index = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x
    const current = data[index]
    if (current === AIR || current === LEAVES || current === WATER || replaceSolid) {
      data[index] = id
    }
  }

  function stampOak(data, cx, cz, baseX, baseZ, height) {
    const trunk = 4 + Math.floor(hash2(baseX, baseZ, seed + 610) * 3)
    const topY = height + trunk
    if (topY + 2 >= WORLD_HEIGHT) return

    for (let y = height + 1; y <= topY; y++) {
      setLocal(data, baseX - cx * CHUNK_SIZE, y, baseZ - cz * CHUNK_SIZE, LOG)
    }

    for (let dy = -2; dy <= 2; dy++) {
      const radius = dy <= 0 ? 2 : dy === 1 ? 2 : 1
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const edge = Math.abs(dx) === radius && Math.abs(dz) === radius
          if (edge && (dy >= 1 || hash2(baseX + dx * 31, baseZ + dz * 17 + dy * 7, seed + 611) < 0.55)) continue
          if (dy === 2 && Math.abs(dx) + Math.abs(dz) > 1) continue
          setLocal(data, baseX + dx - cx * CHUNK_SIZE, topY + dy, baseZ + dz - cz * CHUNK_SIZE, LEAVES)
        }
      }
    }
    // a little crown above the canopy
    setLocal(data, baseX - cx * CHUNK_SIZE, topY + 2, baseZ - cz * CHUNK_SIZE, LEAVES)
  }

  function stampSpruce(data, cx, cz, baseX, baseZ, height) {
    const trunk = 6 + Math.floor(hash2(baseX, baseZ, seed + 620) * 3)
    const topY = height + trunk
    if (topY + 2 >= WORLD_HEIGHT) return

    for (let y = height + 1; y <= topY; y++) {
      setLocal(data, baseX - cx * CHUNK_SIZE, y, baseZ - cz * CHUNK_SIZE, LOG)
    }

    for (let layer = 0; layer <= 7; layer++) {
      const y = topY - layer
      const radius = layer < 1 ? 0 : layer < 3 ? 1 : layer < 5 ? 2 : 3
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue
          setLocal(data, baseX + dx - cx * CHUNK_SIZE, y, baseZ + dz - cz * CHUNK_SIZE, LEAVES)
        }
      }
    }
    setLocal(data, baseX - cx * CHUNK_SIZE, topY + 1, baseZ - cz * CHUNK_SIZE, LEAVES)
  }

  function addTrees(data, cx, cz) {
    const cell = 5
    const minCellX = Math.floor((cx * CHUNK_SIZE - 4) / cell)
    const maxCellX = Math.floor((cx * CHUNK_SIZE + CHUNK_SIZE + 4) / cell)
    const minCellZ = Math.floor((cz * CHUNK_SIZE - 4) / cell)
    const maxCellZ = Math.floor((cz * CHUNK_SIZE + CHUNK_SIZE + 4) / cell)

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
        const presence = hash2(cellX, cellZ, seed + 500)
        const jitterX = 1 + Math.floor(hash2(cellX, cellZ, seed + 501) * (cell - 2))
        const jitterZ = 1 + Math.floor(hash2(cellX, cellZ, seed + 502) * (cell - 2))
        const baseX = cellX * cell + jitterX
        const baseZ = cellZ * cell + jitterZ

        const info = column(baseX, baseZ)
        if (info.height <= SEA_LEVEL + 1) continue
        if (info.biome === BIOME.DESERT) {
          if (presence < 0.86) continue
          // small sandstone rocks in the desert
          const rockHeight = 1 + Math.floor(hash2(baseX, baseZ, seed + 630) * 3)
          for (let y = 1; y <= rockHeight; y++) {
            setLocal(data, baseX - cx * CHUNK_SIZE, info.height + y, baseZ - cz * CHUNK_SIZE, SANDSTONE)
          }
          continue
        }

        const chance = info.biome === BIOME.FOREST ? 0.44 : info.biome === BIOME.SNOW ? 0.26 : 0.13
        if (presence > chance) continue
        if (info.height > 56) continue

        if (info.biome === BIOME.SNOW) stampSpruce(data, cx, cz, baseX, baseZ, info.height)
        else stampOak(data, cx, cz, baseX, baseZ, info.height)
      }
    }
  }

  function generateChunk(cx, cz, editsForChunk) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT)
    const baseX = cx * CHUNK_SIZE
    const baseZ = cz * CHUNK_SIZE

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        fillColumn(data, x, z, column(baseX + x, baseZ + z))
      }
    }

    addTrees(data, cx, cz)

    if (editsForChunk) {
      for (const [key, id] of editsForChunk) {
        const [ex, ey, ez] = key.split(',').map(Number)
        const lx = ex - baseX
        const lz = ez - baseZ
        if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || ey < 0 || ey >= WORLD_HEIGHT) continue
        data[ey * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] = id
      }
    }

    return data
  }

  function findSpawn() {
    let best = null
    let bestScore = -Infinity

    for (let radius = 0; radius <= 82; radius += 6) {
      const steps = radius === 0 ? 1 : Math.min(48, Math.max(10, Math.round(radius * 0.7)))
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2
        const wx = Math.round(8 + Math.cos(angle) * radius)
        const wz = Math.round(8 + Math.sin(angle) * radius)
        const info = column(wx, wz)
        if (info.height < SEA_LEVEL + 2 || info.height > SEA_LEVEL + 11) continue

        let min = 999
        let max = -999
        for (let dz = -2; dz <= 2; dz += 2) {
          for (let dx = -2; dx <= 2; dx += 2) {
            const h = column(wx + dx, wz + dz).height
            if (h < min) min = h
            if (h > max) max = h
          }
        }
        const slope = max - min
        if (slope > 6) continue

        // Find the most scenic direction: water in view, open horizon, downhill.
        let bestView = -Infinity
        let bestYaw = 0
        for (let a = 0; a < 16; a++) {
          const dirAngle = (a / 16) * Math.PI * 2
          const dx = Math.cos(dirAngle)
          const dz = Math.sin(dirAngle)
          let view = 0
          let water = 0
          for (const distance of [9, 18, 28, 38]) {
            const sample = column(Math.round(wx + dx * distance), Math.round(wz + dz * distance))
            if (sample.height <= SEA_LEVEL) {
              view += 7 + distance * 0.14
              water++
            } else if (sample.height < info.height - 1) {
              view += 1.4
            } else if (sample.height > info.height + 7) {
              view -= 6
            }
          }
          if (water > 0) view += 9
          if (view > bestView) {
            bestView = view
            bestYaw = Math.atan2(-dx, -dz)
          }
        }

        const biomeBonus = info.biome === BIOME.PLAINS ? 90 : info.biome === BIOME.SNOW ? 30 : info.biome === BIOME.FOREST ? -140 : -300
        const score = bestView + biomeBonus + info.height * 0.7 - slope * 1.7
        if (score > bestScore) {
          bestScore = score
          best = { x: wx, z: wz, height: info.height, biome: info.biome, yaw: bestYaw, pitch: -0.085 }
        }
      }
    }

    if (!best) {
      const fallback = column(8, 8)
      best = {
        x: 8,
        z: 8,
        height: Math.max(SEA_LEVEL + 2, fallback.height),
        biome: fallback.biome,
        yaw: 0,
        pitch: -0.085
      }
    }

    return best
  }

  return { seed, column, generateChunk, findSpawn, topBlockFor }
}
