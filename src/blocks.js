// Block registry. Face order is: +X, -X, +Y (top), -Y (bottom), +Z, -Z.

export const AIR = 0
export const GRASS = 1
export const DIRT = 2
export const STONE = 3
export const COBBLE = 4
export const SAND = 5
export const SNOW = 6
export const LOG = 7
export const LEAVES = 8
export const PLANKS = 9
export const WATER = 10
export const GLASS = 11
export const BEDROCK = 12
export const BRICKS = 13
export const SANDSTONE = 14
export const GRAVEL = 15

// Tile indices inside the generated texture atlas.
export const TILES = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  cobble: 4,
  sand: 5,
  snow: 6,
  logSide: 7,
  logTop: 8,
  leaves: 9,
  planks: 10,
  water: 11,
  glass: 12,
  bedrock: 13,
  bricks: 14,
  sandstone: 15,
  gravel: 16,
  tuft: 17,
  flowerRed: 18,
  flowerYellow: 19
}

const def = (id, name, tiles, options = {}) => ({
  id,
  name,
  tiles,
  solid: options.solid !== false,
  opaque: options.opaque !== false,
  cutout: Boolean(options.cutout),
  liquid: Boolean(options.liquid),
  color: options.color || [0.6, 0.6, 0.6],
  ...options
})

export const BLOCKS = {
  [GRASS]: def(GRASS, 'Grass Block', { top: TILES.grassTop, side: TILES.grassSide, bottom: TILES.dirt }, {
    color: [0.42, 0.67, 0.24]
  }),
  [DIRT]: def(DIRT, 'Dirt', TILES.dirt, { color: [0.53, 0.36, 0.22] }),
  [STONE]: def(STONE, 'Stone', TILES.stone, { color: [0.56, 0.58, 0.6] }),
  [COBBLE]: def(COBBLE, 'Cobblestone', TILES.cobble, { color: [0.5, 0.52, 0.54] }),
  [SAND]: def(SAND, 'Sand', TILES.sand, { color: [0.88, 0.8, 0.58] }),
  [SNOW]: def(SNOW, 'Snow', TILES.snow, { color: [0.93, 0.96, 0.98] }),
  [LOG]: def(LOG, 'Oak Log', { top: TILES.logTop, side: TILES.logSide, bottom: TILES.logTop }, {
    color: [0.45, 0.33, 0.19]
  }),
  [LEAVES]: def(LEAVES, 'Leaves', TILES.leaves, {
    opaque: false,
    cutout: true,
    color: [0.3, 0.58, 0.19]
  }),
  [PLANKS]: def(PLANKS, 'Oak Planks', TILES.planks, { color: [0.72, 0.56, 0.32] }),
  [WATER]: def(WATER, 'Water', TILES.water, {
    solid: false,
    opaque: false,
    liquid: true,
    color: [0.25, 0.47, 0.78]
  }),
  [GLASS]: def(GLASS, 'Glass', TILES.glass, {
    opaque: false,
    cutout: true,
    color: [0.72, 0.86, 0.92]
  }),
  [BEDROCK]: def(BEDROCK, 'Bedrock', TILES.bedrock, { color: [0.2, 0.2, 0.22] }),
  [BRICKS]: def(BRICKS, 'Bricks', TILES.bricks, { color: [0.6, 0.27, 0.2] }),
  [SANDSTONE]: def(SANDSTONE, 'Sandstone', TILES.sandstone, { color: [0.84, 0.76, 0.55] }),
  [GRAVEL]: def(GRAVEL, 'Gravel', TILES.gravel, { color: [0.52, 0.49, 0.47] })
}

export const HOTBAR = [GRASS, DIRT, STONE, COBBLE, SAND, LOG, PLANKS, LEAVES, GLASS]

export function tileFor(block, face) {
  if (face === 2) return block.tiles.top ?? block.tiles.all ?? block.tiles
  if (face === 3) return block.tiles.bottom ?? block.tiles.all ?? block.tiles
  return block.tiles.side ?? block.tiles.all ?? block.tiles
}

export function isOpaque(id) {
  return id !== AIR && BLOCKS[id]?.opaque === true
}

export function isSolid(id) {
  return id !== AIR && BLOCKS[id]?.solid !== false
}

export function isLiquid(id) {
  return BLOCKS[id]?.liquid === true
}
