import * as THREE from 'three'
import { TILES, tileFor, BLOCKS, GLASS } from './blocks.js'

const TILE_SIZE = 16
const COLS = 8
const ATLAS_SIZE = TILE_SIZE * COLS

function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rgb(c, jitter = 0) {
  const r = Math.max(0, Math.min(255, Math.round(c[0] + jitter)))
  const g = Math.max(0, Math.min(255, Math.round(c[1] + jitter)))
  const b = Math.max(0, Math.min(255, Math.round(c[2] + jitter)))
  return `rgb(${r},${g},${b})`
}

function fill(ctx, color, variance, random) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const jitter = (random() * 2 - 1) * variance
      ctx.fillStyle = rgb(color, jitter)
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

function pixels(ctx, random, colors, count) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(random() * colors.length)]
    ctx.fillRect(Math.floor(random() * TILE_SIZE), Math.floor(random() * TILE_SIZE), 1, 1)
  }
}

function paint(ctx, index, painter) {
  const x = (index % COLS) * TILE_SIZE
  const y = Math.floor(index / COLS) * TILE_SIZE
  ctx.save()
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.rect(0, 0, TILE_SIZE, TILE_SIZE)
  ctx.clip()
  painter()
  ctx.restore()
}

export function createAtlas() {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_SIZE
  canvas.height = ATLAS_SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const random = mulberry32(0x5eed1234)

  // Grass top ------------------------------------------------------------
  paint(ctx, TILES.grassTop, () => {
    fill(ctx, [92, 158, 58], 16, random)
    pixels(ctx, random, ['#78c94a', '#8bd85b', '#5f9f36', '#4c8429', '#86d259'], 46)
    pixels(ctx, random, ['#a4e476', '#3f7623'], 12)
  })

  // Grass side ----------------------------------------------------------
  paint(ctx, TILES.grassSide, () => {
    fill(ctx, [117, 82, 47], 11, random)
    pixels(ctx, random, ['#9a7042', '#7b5530', '#a9804c', '#6d4b29'], 34)
    pixels(ctx, random, ['#7f7f83', '#6a6a6e'], 9)
    for (let x = 0; x < TILE_SIZE; x++) {
      const depth = 3 + Math.floor(random() * 3)
      for (let y = 0; y < depth; y++) {
        ctx.fillStyle = rgb(y === depth - 1 ? [73, 126, 40] : [94, 163, 58], (random() * 2 - 1) * 16)
        ctx.fillRect(x, y, 1, 1)
      }
    }
  })

  // Dirt ----------------------------------------------------------------
  paint(ctx, TILES.dirt, () => {
    fill(ctx, [122, 86, 51], 12, random)
    pixels(ctx, random, ['#9c6d3f', '#6e4a28', '#b07c48', '#5e3f22', '#8a8a8e', '#75757a'], 52)
  })

  // Stone ---------------------------------------------------------------
  paint(ctx, TILES.stone, () => {
    fill(ctx, [126, 129, 134], 12, random)
    pixels(ctx, random, ['#9a9da2', '#7e8186', '#adb0b5', '#6c6f74'], 54)
    // a couple of hairline cracks
    for (let i = 0; i < 3; i++) {
      let x = Math.floor(random() * 14) + 1
      let y = Math.floor(random() * 14) + 1
      for (let s = 0; s < 4; s++) {
        ctx.fillStyle = '#6a6d72'
        ctx.fillRect(x, y, 1, 1)
        x += random() > 0.5 ? 1 : 0
        y += random() > 0.4 ? 1 : -1
        x = Math.max(0, Math.min(15, x))
        y = Math.max(0, Math.min(15, y))
      }
    }
  })

  // Cobblestone ---------------------------------------------------------
  paint(ctx, TILES.cobble, () => {
    fill(ctx, [84, 86, 90], 7, random)
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const row = Math.floor(y / 8)
        const offset = row === 1 ? 4 : 0
        const gx = (x + offset) % 8
        const gy = y % 8
        const mortar = gx === 0 || gy === 0 || (gx === 7 && random() > 0.55)
        if (mortar) continue
        let shade = 128 + (random() * 2 - 1) * 14
        if (gx === 1 || gy === 1) shade += 24
        if (gx === 6 || gy === 6) shade -= 16
        ctx.fillStyle = `rgb(${Math.round(shade)},${Math.round(shade + 2)},${Math.round(shade + 5)})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
    pixels(ctx, random, ['#6f7176', '#aeb1b6'], 18)
  })

  // Sand ----------------------------------------------------------------
  paint(ctx, TILES.sand, () => {
    fill(ctx, [222, 207, 155], 9, random)
    pixels(ctx, random, ['#efe0b4', '#c9b47f', '#d9c58f', '#b7a06a'], 48)
  })

  // Snow ----------------------------------------------------------------
  paint(ctx, TILES.snow, () => {
    fill(ctx, [242, 248, 252], 4, random)
    pixels(ctx, random, ['#ffffff', '#dfeaf3', '#cdddeb', '#f5fbff'], 44)
  })

  // Log side ------------------------------------------------------------
  paint(ctx, TILES.logSide, () => {
    fill(ctx, [104, 76, 44], 9, random)
    for (let x = 0; x < TILE_SIZE; x++) {
      const stripe = random()
      if (stripe < 0.2) {
        for (let y = 0; y < TILE_SIZE; y++) {
          ctx.fillStyle = rgb([76, 53, 29], (random() * 2 - 1) * 8)
          ctx.fillRect(x, y, 1, 1)
        }
      } else if (stripe > 0.82) {
        for (let y = 0; y < TILE_SIZE; y++) {
          ctx.fillStyle = rgb([132, 99, 58], (random() * 2 - 1) * 8)
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
    pixels(ctx, random, ['#5a3d21', '#8f6a3d', '#b08350'], 30)
  })

  // Log top -------------------------------------------------------------
  paint(ctx, TILES.logTop, () => {
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const dx = x - 7.5
        const dy = y - 7.5
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d > 6.9) {
          ctx.fillStyle = rgb([92, 66, 38], (random() * 2 - 1) * 10)
        } else {
          const ring = Math.sin(d * 2.4) > 0 ? 0 : -18
          ctx.fillStyle = rgb([168, 132, 82], ring + (random() * 2 - 1) * 8)
        }
        ctx.fillRect(x, y, 1, 1)
      }
    }
    ctx.fillStyle = '#5c4226'
    ctx.fillRect(7, 7, 2, 2)
  })

  // Leaves --------------------------------------------------------------
  paint(ctx, TILES.leaves, () => {
    fill(ctx, [56, 108, 37], 8, random)
    const greens = ['#3d7d28', '#4a8f30', '#397324', '#569b38', '#63a943', '#2f6420']
    for (let i = 0; i < 34; i++) {
      const x = Math.floor(random() * 15)
      const y = Math.floor(random() * 15)
      const color = greens[Math.floor(random() * greens.length)]
      ctx.fillStyle = color
      ctx.fillRect(x, y, 2, 2)
      if (random() > 0.5) ctx.fillRect(x + (random() > 0.5 ? 2 : -1), y + 1, 1, 1)
    }
    // sparse gaps let a little sky through without turning the canopy into noise
    for (let i = 0; i < 5; i++) {
      ctx.clearRect(Math.floor(random() * 16), Math.floor(random() * 16), 1, 1)
    }
    ctx.clearRect(4, 11, 2, 1)
    ctx.clearRect(12, 3, 1, 2)
  })

  // Planks --------------------------------------------------------------
  paint(ctx, TILES.planks, () => {
    fill(ctx, [167, 128, 73], 8, random)
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        if (y % 4 === 0) {
          ctx.fillStyle = rgb([108, 78, 40], (random() * 2 - 1) * 5)
          ctx.fillRect(x, y, 1, 1)
        } else if (x === (y < 8 ? 11 : 4)) {
          ctx.fillStyle = '#7a5629'
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = random() > 0.5 ? '#b98d50' : '#8d6836'
      ctx.fillRect(Math.floor(random() * 16), Math.floor(random() * 16), 1, 1)
    }
  })

  // Water ---------------------------------------------------------------
  paint(ctx, TILES.water, () => {
    fill(ctx, [54, 112, 184], 8, random)
    for (let x = 0; x < TILE_SIZE; x++) {
      const y1 = 3 + Math.round(Math.sin(x * 0.8) * 1.2)
      const y2 = 10 + Math.round(Math.cos(x * 0.55) * 1.4)
      ctx.fillStyle = 'rgba(126, 180, 231, 0.72)'
      ctx.fillRect(x, y1, 1, 1)
      ctx.fillStyle = 'rgba(95, 151, 210, 0.6)'
      ctx.fillRect(x, y2, 1, 1)
    }
    pixels(ctx, random, ['#3f7cb8', '#69a3d8', '#2f679f'], 22)
  })

  // Glass ---------------------------------------------------------------
  paint(ctx, TILES.glass, () => {
    ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE)
    ctx.fillStyle = 'rgba(192, 228, 238, 0.28)'
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
    ctx.fillStyle = 'rgba(226, 246, 252, 0.95)'
    ctx.fillRect(0, 0, TILE_SIZE, 1)
    ctx.fillRect(0, 15, TILE_SIZE, 1)
    ctx.fillRect(0, 0, 1, TILE_SIZE)
    ctx.fillRect(15, 0, 1, TILE_SIZE)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.fillRect(2, 3, 1, 3)
    ctx.fillRect(4, 2, 1, 2)
    ctx.fillRect(1, 8, 1, 1)
  })

  // Bedrock -------------------------------------------------------------
  paint(ctx, TILES.bedrock, () => {
    fill(ctx, [58, 58, 63], 14, random)
    pixels(ctx, random, ['#2e2e33', '#75757c', '#444449', '#8a8a92', '#1f1f23'], 70)
  })

  // Bricks --------------------------------------------------------------
  paint(ctx, TILES.bricks, () => {
    fill(ctx, [188, 176, 161], 5, random)
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const row = Math.floor(y / 4)
        const offset = row % 2 === 0 ? 0 : 4
        const bx = (x + offset) % 8
        const by = y % 4
        if (bx === 0 || by === 0) continue
        const shade = (random() * 2 - 1) * 12
        ctx.fillStyle = rgb([151, 66, 48], shade)
        ctx.fillRect(x, y, 1, 1)
        if (by === 1 && bx === 1) {
          ctx.fillStyle = 'rgba(255, 170, 140, 0.25)'
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
  })

  // Sandstone -----------------------------------------------------------
  paint(ctx, TILES.sandstone, () => {
    fill(ctx, [217, 202, 155], 8, random)
    for (let x = 0; x < TILE_SIZE; x++) {
      if (random() > 0.55) {
        ctx.fillStyle = 'rgba(168, 149, 105, 0.65)'
        ctx.fillRect(x, 5, 1, 1)
        ctx.fillRect(x, 11, 1, 1)
      }
    }
    pixels(ctx, random, ['#e7d8ab', '#c0aa7c', '#aa9366', '#efe2bc'], 40)
  })

  // Gravel --------------------------------------------------------------
  paint(ctx, TILES.gravel, () => {
    fill(ctx, [113, 108, 103], 10, random)
    const stones = ['#8a857f', '#6e6a66', '#a19b94', '#575450', '#96908a', '#7c6f63']
    for (let i = 0; i < 34; i++) {
      const x = Math.floor(random() * 14) + 1
      const y = Math.floor(random() * 14) + 1
      ctx.fillStyle = stones[Math.floor(random() * stones.length)]
      ctx.fillRect(x, y, 2, 2)
    }
    pixels(ctx, random, ['#c0bab3', '#4c4946'], 16)
  })

  // Grass tuft ----------------------------------------------------------
  paint(ctx, TILES.tuft, () => {
    ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE)
    const blades = ['#4f9231', '#63aa3a', '#7ac34a', '#3d7a24']
    for (let i = 0; i < 7; i++) {
      const x = 2 + Math.floor(random() * 12)
      const height = 5 + Math.floor(random() * 8)
      const lean = random() > 0.5 ? 1 : -1
      const color = blades[Math.floor(random() * blades.length)]
      for (let y = 0; y < height; y++) {
        ctx.fillStyle = color
        ctx.fillRect(Math.max(0, Math.min(15, x + Math.round((y / height) * lean * 2))), 15 - y, 1, 1)
      }
    }
  })

  // Red flower ----------------------------------------------------------
  paint(ctx, TILES.flowerRed, () => {
    ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE)
    ctx.fillStyle = '#3f7d25'
    ctx.fillRect(8, 7, 1, 9)
    ctx.fillRect(6, 11, 2, 1)
    ctx.fillRect(9, 13, 2, 1)
    ctx.fillStyle = '#c93c37'
    ctx.fillRect(7, 4, 3, 1)
    ctx.fillRect(6, 5, 5, 1)
    ctx.fillRect(7, 6, 3, 1)
    ctx.fillStyle = '#e45a50'
    ctx.fillRect(7, 4, 2, 1)
    ctx.fillStyle = '#ffd76a'
    ctx.fillRect(8, 5, 1, 1)
  })

  // Yellow flower -------------------------------------------------------
  paint(ctx, TILES.flowerYellow, () => {
    ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE)
    ctx.fillStyle = '#3f7d25'
    ctx.fillRect(7, 7, 1, 9)
    ctx.fillRect(5, 11, 2, 1)
    ctx.fillRect(8, 13, 2, 1)
    ctx.fillStyle = '#e9b62e'
    ctx.fillRect(6, 4, 4, 1)
    ctx.fillRect(5, 5, 1, 1)
    ctx.fillRect(10, 5, 1, 1)
    ctx.fillRect(6, 6, 4, 1)
    ctx.fillStyle = '#ffd95c'
    ctx.fillRect(7, 5, 2, 1)
    ctx.fillStyle = '#f6f0d0'
    ctx.fillRect(7, 6, 1, 1)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping

  const inv = 1 / ATLAS_SIZE
  function uv(tile, u, v) {
    const col = tile % COLS
    const row = Math.floor(tile / COLS)
    return [
      (col * TILE_SIZE + 0.5 + u * (TILE_SIZE - 1)) * inv,
      1 - (row * TILE_SIZE + TILE_SIZE - 0.5 - v * (TILE_SIZE - 1)) * inv
    ]
  }

  function createIcon(blockId) {
    const size = 64
    const block = BLOCKS[blockId]
    const icon = document.createElement('canvas')
    icon.width = size
    icon.height = size
    const ictx = icon.getContext('2d')
    ictx.imageSmoothingEnabled = false

    const topTile = tileFor(block, 2)
    const sideTile = tileFor(block, 0)
    const topX = (topTile % COLS) * TILE_SIZE
    const topY = Math.floor(topTile / COLS) * TILE_SIZE
    const sideX = (sideTile % COLS) * TILE_SIZE
    const sideY = Math.floor(sideTile / COLS) * TILE_SIZE

    const drawFace = (sx, sy, transform, shade) => {
      ictx.save()
      ictx.setTransform(...transform)
      if (blockId === GLASS) {
        ictx.fillStyle = 'rgba(196, 232, 244, 0.3)'
        ictx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
      }
      ictx.drawImage(canvas, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE)
      if (shade > 0) {
        ictx.globalCompositeOperation = 'source-atop'
        ictx.fillStyle = `rgba(8, 14, 22, ${shade})`
        ictx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
      }
      ictx.restore()
    }

    // Isometric cube: top diamond, left face, right face.
    drawFace(topX, topY, [1.625, 0.875, -1.625, 0.875, 32, 6], 0)
    drawFace(sideX, sideY, [1.625, 0.875, 0, 1.625, 6, 20], 0.16)
    drawFace(sideX, sideY, [1.625, -0.875, 0, 1.625, 32, 34], 0.3)

    ictx.strokeStyle = 'rgba(5, 10, 16, 0.42)'
    ictx.lineWidth = 1
    ictx.beginPath()
    ictx.moveTo(32, 6)
    ictx.lineTo(58, 20)
    ictx.lineTo(32, 34)
    ictx.lineTo(6, 20)
    ictx.closePath()
    ictx.moveTo(6, 20)
    ictx.lineTo(6, 46)
    ictx.lineTo(32, 60)
    ictx.lineTo(32, 34)
    ictx.lineTo(58, 20)
    ictx.lineTo(58, 46)
    ictx.lineTo(32, 60)
    ictx.stroke()

    return icon
  }

  return { canvas, texture, uv, createIcon }
}
