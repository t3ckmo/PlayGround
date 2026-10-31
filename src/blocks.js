// Block registry. Ids are stored in the voxel array, so keep them stable.

export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const SAND = 4;
export const LOG = 5;
export const LEAVES = 6;
export const PLANKS = 7;
export const GLASS = 8;
export const BRICK = 9;
export const SNOW = 10;
export const COBBLE = 11;
export const WATER = 12;
export const BEDROCK = 13;
export const GRAVEL = 14;

// Atlas tile indices (see textures.js).
export const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG_SIDE: 5,
  LOG_TOP: 6,
  LEAVES: 7,
  PLANKS: 8,
  GLASS: 9,
  BRICK: 10,
  SNOW: 11,
  COBBLE: 12,
  BEDROCK: 13,
  GRAVEL: 14,
};

// Face order: +X, -X, +Y, -Y, +Z, -Z
const uniform = (tile) => [tile, tile, tile, tile, tile, tile];

export const BLOCKS = [];
BLOCKS[AIR] = { id: AIR, name: 'Air', solid: false, opaque: false };
BLOCKS[GRASS] = {
  id: GRASS,
  name: 'Grass',
  tiles: [TILE.GRASS_SIDE, TILE.GRASS_SIDE, TILE.GRASS_TOP, TILE.DIRT, TILE.GRASS_SIDE, TILE.GRASS_SIDE],
  solid: true,
  opaque: true,
  color: 0x6daa49,
  sound: 'soft',
};
BLOCKS[DIRT] = {
  id: DIRT,
  name: 'Dirt',
  tiles: uniform(TILE.DIRT),
  solid: true,
  opaque: true,
  color: 0x8a5a3b,
  sound: 'soft',
};
BLOCKS[STONE] = {
  id: STONE,
  name: 'Stone',
  tiles: uniform(TILE.STONE),
  solid: true,
  opaque: true,
  color: 0x8b8d90,
  sound: 'hard',
};
BLOCKS[SAND] = {
  id: SAND,
  name: 'Sand',
  tiles: uniform(TILE.SAND),
  solid: true,
  opaque: true,
  color: 0xe2d59f,
  sound: 'soft',
};
BLOCKS[LOG] = {
  id: LOG,
  name: 'Log',
  tiles: [TILE.LOG_SIDE, TILE.LOG_SIDE, TILE.LOG_TOP, TILE.LOG_TOP, TILE.LOG_SIDE, TILE.LOG_SIDE],
  solid: true,
  opaque: true,
  color: 0x7a5432,
  sound: 'wood',
};
BLOCKS[LEAVES] = {
  id: LEAVES,
  name: 'Leaves',
  tiles: uniform(TILE.LEAVES),
  solid: true,
  opaque: false,
  color: 0x447f30,
  sound: 'leaf',
};
BLOCKS[PLANKS] = {
  id: PLANKS,
  name: 'Planks',
  tiles: uniform(TILE.PLANKS),
  solid: true,
  opaque: true,
  color: 0xb98a54,
  sound: 'wood',
};
BLOCKS[GLASS] = {
  id: GLASS,
  name: 'Glass',
  tiles: uniform(TILE.GLASS),
  solid: true,
  opaque: false,
  color: 0xcfe8f2,
  sound: 'glass',
};
BLOCKS[BRICK] = {
  id: BRICK,
  name: 'Brick',
  tiles: uniform(TILE.BRICK),
  solid: true,
  opaque: true,
  color: 0xa9503f,
  sound: 'hard',
};
BLOCKS[SNOW] = {
  id: SNOW,
  name: 'Snow',
  tiles: uniform(TILE.SNOW),
  solid: true,
  opaque: true,
  color: 0xeef4f8,
  sound: 'soft',
};
BLOCKS[COBBLE] = {
  id: COBBLE,
  name: 'Cobblestone',
  tiles: uniform(TILE.COBBLE),
  solid: true,
  opaque: true,
  color: 0x7e8084,
  sound: 'hard',
};
BLOCKS[WATER] = {
  id: WATER,
  name: 'Water',
  solid: false,
  opaque: false,
  liquid: true,
  color: 0x3d8fc4,
};
BLOCKS[BEDROCK] = {
  id: BEDROCK,
  name: 'Bedrock',
  tiles: uniform(TILE.BEDROCK),
  solid: true,
  opaque: true,
  color: 0x3a3a3e,
  sound: 'hard',
  unbreakable: true,
};
BLOCKS[GRAVEL] = {
  id: GRAVEL,
  name: 'Gravel',
  tiles: uniform(TILE.GRAVEL),
  solid: true,
  opaque: true,
  color: 0x8d8880,
  sound: 'soft',
};

export const HOTBAR = [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, GLASS, BRICK];

export function isSolid(id) {
  const b = BLOCKS[id];
  return Boolean(b && b.solid);
}

export function isOpaque(id) {
  const b = BLOCKS[id];
  return Boolean(b && b.opaque);
}

export function isLiquid(id) {
  return id === WATER;
}

export function blockName(id) {
  return BLOCKS[id]?.name ?? 'Unknown';
}
