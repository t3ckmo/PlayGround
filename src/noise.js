// Small, dependency-free deterministic noise helpers.
// Everything is driven by 32-bit integer hashes so worlds are reproducible
// from a single seed on every device.

export function hash2(x, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

export function hash3(x, y, z, seed = 0) {
  let h =
    Math.imul(x | 0, 374761393) ^
    Math.imul(y | 0, 2246822519) ^
    Math.imul(z | 0, 668265263) ^
    Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

function fade(t) {
  return t * t * (3 - 2 * t)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

export function noise2(x, z, seed = 0) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = fade(xf)
  const v = fade(zf)
  const a = hash2(xi, zi, seed)
  const b = hash2(xi + 1, zi, seed)
  const c = hash2(xi, zi + 1, seed)
  const d = hash2(xi + 1, zi + 1, seed)
  return lerp(lerp(a, b, u), lerp(c, d, u), v)
}

export function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = fade(x - xi)
  const yf = fade(y - yi)
  const zf = fade(z - zi)
  const c000 = hash3(xi, yi, zi, seed)
  const c100 = hash3(xi + 1, yi, zi, seed)
  const c010 = hash3(xi, yi + 1, zi, seed)
  const c110 = hash3(xi + 1, yi + 1, zi, seed)
  const c001 = hash3(xi, yi, zi + 1, seed)
  const c101 = hash3(xi + 1, yi, zi + 1, seed)
  const c011 = hash3(xi, yi + 1, zi + 1, seed)
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed)
  const x00 = lerp(c000, c100, xf)
  const x10 = lerp(c010, c110, xf)
  const x01 = lerp(c001, c101, xf)
  const x11 = lerp(c011, c111, xf)
  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf)
}

export function fbm2(x, z, seed = 0, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amplitude = 0.5
  let frequency = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * frequency, z * frequency, seed + i * 1013) * amplitude
    norm += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }
  return sum / norm
}

export function fbm3(x, y, z, seed = 0, octaves = 3, lacunarity = 2, gain = 0.5) {
  let amplitude = 0.5
  let frequency = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += noise3(x * frequency, y * frequency, z * frequency, seed + i * 1013) * amplitude
    norm += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }
  return sum / norm
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}
