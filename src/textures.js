import {
  CanvasTexture,
  SRGBColorSpace,
  NearestFilter,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
} from 'three';
import { mulberry32 } from './noise.js';
import { BLOCKS, GLASS } from './blocks.js';

const TILE = 32;
const PAD = 4;
const CELL = TILE + PAD * 2;
const COLS = 4;
const ROWS = 4;
const SIZE = CELL * COLS;

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const rect = (ctx, x, y, w, h, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

function speckle(ctx, rng, count, colors, min = 1, max = 2) {
  for (let i = 0; i < count; i++) {
    const s = min + Math.floor(rng() * (max - min + 1));
    rect(ctx, Math.floor(rng() * TILE), Math.floor(rng() * TILE), s, s, pick(rng, colors));
  }
}

function grassTop(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#5a9e3f');
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rng() * TILE);
    const y = Math.floor(rng() * TILE);
    const w = 2 + Math.floor(rng() * 5);
    const h = 2 + Math.floor(rng() * 4);
    rect(ctx, x, y, w, h, pick(rng, ['#67b04a', '#4f8f36', '#73bd53', '#579a3c']));
  }
  speckle(ctx, rng, 150, ['#7ac95a', '#4a8531', '#63a944', '#3f782b'], 1, 2);
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rng() * TILE);
    const y = Math.floor(rng() * TILE);
    rect(ctx, x, y, 1, 2, '#8ad466');
  }
}

function dirtBase(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#8a5a3b');
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(rng() * TILE);
    const y = Math.floor(rng() * TILE);
    const w = 2 + Math.floor(rng() * 5);
    const h = 2 + Math.floor(rng() * 4);
    rect(ctx, x, y, w, h, pick(rng, ['#96633f', '#7c4f33', '#a06a44', '#70472d']));
  }
  speckle(ctx, rng, 130, ['#a06a44', '#70472d', '#b07a52', '#5f3b24'], 1, 2);
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(rng() * TILE);
    const y = Math.floor(rng() * TILE);
    rect(ctx, x, y, 2, 1, '#c08a60');
  }
}

function grassSide(ctx, rng) {
  dirtBase(ctx, rng);
  for (let x = 0; x < TILE; x++) {
    const depth = 5 + Math.floor(rng() * 5) + (rng() < 0.2 ? 2 : 0);
    rect(ctx, x, 0, 1, depth, pick(rng, ['#5a9e3f', '#63a944', '#4f8f36']));
    if (rng() < 0.5) rect(ctx, x, depth, 1, 1 + Math.floor(rng() * 2), '#4a8531');
  }
  for (let i = 0; i < 16; i++) {
    rect(ctx, Math.floor(rng() * TILE), Math.floor(rng() * 4), 1, 1, '#7ac95a');
  }
}

function dirt(ctx, rng) {
  dirtBase(ctx, rng);
}

function stone(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#8b8d90');
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(rng() * TILE);
    const y = Math.floor(rng() * TILE);
    rect(ctx, x, y, 2 + Math.floor(rng() * 6), 2 + Math.floor(rng() * 4), pick(rng, ['#7d7f83', '#989a9d', '#85878a', '#737579']));
  }
  speckle(ctx, rng, 120, ['#a2a4a7', '#6d6f73', '#919396', '#7a7c80'], 1, 2);
  ctx.strokeStyle = 'rgba(80,82,86,0.75)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    let x = Math.floor(rng() * TILE);
    let y = Math.floor(rng() * TILE);
    ctx.moveTo(x + 0.5, y + 0.5);
    for (let j = 0; j < 4; j++) {
      x += Math.floor(rng() * 7) - 3;
      y += Math.floor(rng() * 7) - 3;
      ctx.lineTo(x + 0.5, y + 0.5);
    }
    ctx.stroke();
  }
}

function sand(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#e2d59f');
  speckle(ctx, rng, 180, ['#d6c88e', '#efe4b4', '#cbbc80', '#e8dca8'], 1, 2);
  for (let i = 0; i < 22; i++) {
    rect(ctx, Math.floor(rng() * TILE), Math.floor(rng() * TILE), 1, 1, '#b9a96e');
  }
}

function logSide(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#6b4a2b');
  for (let x = 0; x < TILE; x += 4) {
    const color = pick(rng, ['#7a5432', '#5f4025', '#845c37', '#6f4b2c']);
    rect(ctx, x, 0, 3, TILE, color);
    rect(ctx, x + 3, 0, 1, TILE, '#513622');
  }
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(rng() * TILE);
    const y = Math.floor(rng() * TILE);
    rect(ctx, x, y, 1, 3 + Math.floor(rng() * 8), pick(rng, ['#8f643a', '#5a3c22', '#966b40']));
  }
  for (let i = 0; i < 3; i++) {
    const x = 4 + Math.floor(rng() * 22);
    const y = 6 + Math.floor(rng() * 20);
    ctx.strokeStyle = '#4a311e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.5, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    rect(ctx, x, y, 2, 2, '#3d2818');
  }
}

function logTop(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#b18a58');
  const cx = 16;
  const cy = 16;
  for (let r = 15; r > 1; r -= 2) {
    ctx.strokeStyle = r % 4 === 1 ? '#9a7444' : '#c39d69';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.96, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  rect(ctx, 14, 14, 4, 4, '#7c5a34');
  rect(ctx, 15, 15, 2, 2, '#5e4227');
  speckle(ctx, rng, 30, ['#c9a570', '#8f6a3d', '#d6b57f'], 1, 1);
}

function leaves(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#3f7d2e');
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(rng() * TILE);
    const y = Math.floor(rng() * TILE);
    const w = 3 + Math.floor(rng() * 6);
    const h = 3 + Math.floor(rng() * 6);
    rect(ctx, x, y, w, h, pick(rng, ['#4f9438', '#326a25', '#5fa843', '#468a32']));
  }
  speckle(ctx, rng, 110, ['#6bb84b', '#2e6222', '#549c3a'], 1, 2);
  for (let i = 0; i < 26; i++) {
    const s = 1 + Math.floor(rng() * 3);
    ctx.clearRect(Math.floor(rng() * TILE), Math.floor(rng() * TILE), s, s);
  }
  for (let i = 0; i < 12; i++) {
    rect(ctx, Math.floor(rng() * TILE), Math.floor(rng() * TILE), 1, 1, '#7cc95a');
  }
}

function planks(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#b98a54');
  for (let row = 0; row < 4; row++) {
    const y = row * 8;
    const base = pick(rng, ['#bd8f58', '#b2834d', '#c49660', '#ad7d47']);
    rect(ctx, 0, y, TILE, 8, base);
    rect(ctx, 0, y + 7, TILE, 1, '#7d5a34');
    rect(ctx, 0, y, TILE, 1, '#cfa36c');
    for (let i = 0; i < 9; i++) {
      rect(ctx, Math.floor(rng() * TILE), y + 1 + Math.floor(rng() * 5), 2 + Math.floor(rng() * 6), 1, pick(rng, ['#a57845', '#c99a63', '#9c6f3e']));
    }
    if (rng() < 0.6) {
      const kx = 4 + Math.floor(rng() * 24);
      rect(ctx, kx, y + 3, 2, 2, '#8a6236');
      rect(ctx, kx + 2, y + 2, 1, 4, '#8a6236');
    }
    const seam = 6 + Math.floor(rng() * 20);
    rect(ctx, seam, y, 1, 7, '#8f6639');
  }
}

function glass(ctx, rng) {
  ctx.clearRect(0, 0, TILE, TILE);
  rect(ctx, 0, 0, TILE, 2, '#cfe8f2');
  rect(ctx, 0, TILE - 2, TILE, 2, '#b9d9e6');
  rect(ctx, 0, 0, 2, TILE, '#d9eef7');
  rect(ctx, TILE - 2, 0, 2, TILE, '#b0d2e0');
  rect(ctx, 0, 0, TILE, 1, '#ffffff');
  rect(ctx, 0, 0, 1, TILE, '#ffffff');
  ctx.globalAlpha = 0.55;
  rect(ctx, 5, 6, 1, 13, '#eaf8ff');
  rect(ctx, 8, 4, 1, 8, '#eaf8ff');
  rect(ctx, 22, 18, 1, 9, '#eaf8ff');
  ctx.globalAlpha = 0.18;
  rect(ctx, 3, 3, 26, 26, '#bfe2ef');
  ctx.globalAlpha = 1;
}

function brick(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#cbb9a3');
  const bh = 7;
  const bw = 15;
  for (let row = 0; row < 5; row++) {
    const y = row * 7;
    const offset = row % 2 === 0 ? 0 : -8;
    for (let x = offset; x < TILE; x += bw + 2) {
      const color = pick(rng, ['#a9503f', '#b45a47', '#9c4839', '#b05a45']);
      rect(ctx, x, y, bw, bh, color);
      rect(ctx, x, y, bw, 1, '#c16a55');
      rect(ctx, x, y + bh - 1, bw, 1, '#8d3e31');
      rect(ctx, x, y, 1, bh, '#b96150');
    }
  }
  speckle(ctx, rng, 40, ['#8d3e31', '#c16a55', '#d0c0a9'], 1, 1);
}

function snow(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#eef4f8');
  speckle(ctx, rng, 130, ['#dbe7ef', '#ffffff', '#c9d9e4', '#e4eef4'], 1, 2);
  for (let i = 0; i < 16; i++) {
    rect(ctx, Math.floor(rng() * TILE), Math.floor(rng() * TILE), 1, 1, '#ffffff');
  }
  for (let i = 0; i < 8; i++) {
    rect(ctx, Math.floor(rng() * TILE), Math.floor(rng() * TILE), 1, 2, '#c2d5e2');
  }
}

function cobble(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#5f6165');
  const stones = [];
  for (let y = 0; y < TILE; y += 8) {
    for (let x = 0; x < TILE; x += 8) {
      stones.push([x + 4 + Math.floor(rng() * 3) - 1, y + 4 + Math.floor(rng() * 3) - 1]);
    }
  }
  for (const [cx, cy] of stones) {
    const w = 6 + Math.floor(rng() * 3);
    const h = 6 + Math.floor(rng() * 3);
    const color = pick(rng, ['#8a8c90', '#7c7e82', '#96989c', '#85878b', '#727478']);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(cx - w / 2 + 1, cy - h / 2 + 1, w - 2, 1);
  }
  speckle(ctx, rng, 50, ['#a3a5a9', '#6a6c70', '#8f9195'], 1, 1);
}

function bedrock(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#3a3a3e');
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(rng() * TILE);
    const y = Math.floor(rng() * TILE);
    rect(ctx, x, y, 3 + Math.floor(rng() * 7), 3 + Math.floor(rng() * 6), pick(rng, ['#2b2b2f', '#4a4a4f', '#333337', '#56565b']));
  }
  speckle(ctx, rng, 90, ['#232326', '#5a5a60', '#45454a', '#1d1d20'], 1, 2);
}

function gravel(ctx, rng) {
  rect(ctx, 0, 0, TILE, TILE, '#7f7a72');
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rng() * TILE);
    const y = Math.floor(rng() * TILE);
    const s = 1 + Math.floor(rng() * 3);
    rect(ctx, x, y, s, s, pick(rng, ['#a8a39a', '#726d66', '#b7b1a7', '#5f5b55', '#918c83']));
  }
}

const PAINTERS = [
  grassTop,
  grassSide,
  dirt,
  stone,
  sand,
  logSide,
  logTop,
  leaves,
  planks,
  glass,
  brick,
  snow,
  cobble,
  bedrock,
  gravel,
  // Spare tile: a soft grey stone so the atlas is always full.
  (ctx, rng) => {
    rect(ctx, 0, 0, TILE, TILE, '#83858a');
    speckle(ctx, rng, 90, ['#77797e', '#8e9095', '#6d6f74'], 1, 2);
  },
];

function createTileCanvas(painter, index) {
  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  painter(ctx, mulberry32(0x9e3779b1 ^ (index * 2654435761)));
  return canvas;
}

export function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const tileCanvases = PAINTERS.map((painter, index) => createTileCanvas(painter, index));

  for (let i = 0; i < tileCanvases.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cellX = col * CELL;
    const cellY = row * CELL;
    // Stretched copy fills the bleed padding with roughly the right edge colours.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tileCanvases[i], 0, 0, TILE, TILE, cellX, cellY, CELL, CELL);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tileCanvases[i], 0, 0, TILE, TILE, cellX + PAD, cellY + PAD, TILE, TILE);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;

  const inset = 0.75;
  const uv = (index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = col * CELL + PAD;
    const y = row * CELL + PAD;
    return {
      u0: (x + inset) / SIZE,
      v0: 1 - (y + TILE - inset) / SIZE,
      u1: (x + TILE - inset) / SIZE,
      v1: 1 - (y + inset) / SIZE,
    };
  };

  function drawIcon(blockId, size) {
    const dpr = 2;
    const canvas = document.createElement('canvas');
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    const block = BLOCKS[blockId];
    if (!block || !block.tiles) return canvas;
    const S = size * dpr;
    const top = tileCanvases[block.tiles[2]];
    const left = tileCanvases[block.tiles[0]];
    const right = tileCanvases[block.tiles[4]];

    const face = (tile, a, b, cc, d, e, f, shade) => {
      c.save();
      c.setTransform(a, b, cc, d, e, f);
      c.drawImage(tile, 0, 0, TILE, TILE, 0, 0, 1, 1);
      c.fillStyle = shade;
      c.fillRect(0, 0, 1, 1);
      c.restore();
    };

    if (blockId === GLASS) {
      c.fillStyle = 'rgba(180, 222, 238, 0.16)';
      c.beginPath();
      c.moveTo(0.5 * S, 0.06 * S);
      c.lineTo(0.94 * S, 0.29 * S);
      c.lineTo(0.94 * S, 0.73 * S);
      c.lineTo(0.5 * S, 0.96 * S);
      c.lineTo(0.06 * S, 0.73 * S);
      c.lineTo(0.06 * S, 0.29 * S);
      c.closePath();
      c.fill();
    }

    face(left, 0.44 * S, 0.23 * S, 0, 0.44 * S, 0.06 * S, 0.29 * S, 'rgba(0,0,0,0.20)');
    face(right, 0.44 * S, -0.23 * S, 0, 0.44 * S, 0.5 * S, 0.52 * S, 'rgba(0,0,0,0.06)');
    face(top, 0.44 * S, 0.23 * S, 0.44 * S, -0.23 * S, 0.06 * S, 0.29 * S, 'rgba(255,255,255,0.08)');
    return canvas;
  }

  return { canvas, texture, uv, tiles: tileCanvases, drawIcon };
}

export function createWaterTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(0x51ed270b);

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#3f95cb');
  grad.addColorStop(0.55, '#2f7fb8');
  grad.addColorStop(1, '#276d9f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.lineCap = 'round';
  for (let band = 0; band < 7; band++) {
    const baseY = band * 20 + 8;
    ctx.strokeStyle = band % 2 ? 'rgba(150, 218, 245, 0.28)' : 'rgba(24, 82, 122, 0.28)';
    ctx.lineWidth = 2 + (band % 3);
    ctx.beginPath();
    for (let x = -4; x <= size + 4; x += 4) {
      const y = baseY + Math.sin((x / size) * Math.PI * 4 + band * 1.7) * 3.4;
      if (x === -4) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    const w = 2 + Math.floor(rng() * 6);
    ctx.fillStyle = `rgba(190, 236, 255, ${0.06 + rng() * 0.16})`;
    ctx.fillRect(x, y, w, 1);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}
