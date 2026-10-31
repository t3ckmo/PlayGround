import { BufferGeometry, BufferAttribute } from 'three';
import { BLOCKS, GLASS, LEAVES, WATER, isOpaque } from './blocks.js';

// Face order: +X, -X, +Y, -Y, +Z, -Z
const FACES = [
  { n: [1, 0, 0], verts: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], t1: [0, 1, 0], t2: [0, 0, -1], shade: 0.84 },
  { n: [-1, 0, 0], verts: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], t1: [0, 1, 0], t2: [0, 0, 1], shade: 0.78 },
  { n: [0, 1, 0], verts: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], t1: [1, 0, 0], t2: [0, 0, -1], shade: 1.0 },
  { n: [0, -1, 0], verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], t1: [1, 0, 0], t2: [0, 0, 1], shade: 0.55 },
  { n: [0, 0, 1], verts: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], t1: [1, 0, 0], t2: [0, 1, 0], shade: 0.92 },
  { n: [0, 0, -1], verts: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], t1: [-1, 0, 0], t2: [0, 1, 0], shade: 0.86 },
];

const FACE_UV = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

for (const face of FACES) {
  const origin = face.verts[0];
  face.ao = face.verts.map((v) => {
    const dx = v[0] - origin[0];
    const dy = v[1] - origin[1];
    const dz = v[2] - origin[2];
    const a = dx * face.t1[0] + dy * face.t1[1] + dz * face.t1[2] > 0.5 ? 1 : -1;
    const b = dx * face.t2[0] + dy * face.t2[1] + dz * face.t2[2] > 0.5 ? 1 : -1;
    const n = face.n;
    return [
      [n[0] + face.t1[0] * a, n[1] + face.t1[1] * a, n[2] + face.t1[2] * a],
      [n[0] + face.t2[0] * b, n[1] + face.t2[1] * b, n[2] + face.t2[2] * b],
      [n[0] + face.t1[0] * a + face.t2[0] * b, n[1] + face.t1[1] * a + face.t2[1] * b, n[2] + face.t1[2] * a + face.t2[2] * b],
    ];
  });
}

const AO_LEVELS = [0.5, 0.68, 0.84, 1.0];

function toLinear(value) {
  return Math.pow(value, 2.2);
}

function pushQuad(positions, normals, uvs, colors, indices, verts, normal, tileUv, shade, aoLevels, origin = [0, 0, 0]) {
  const base = positions.length / 3;
  for (let i = 0; i < 4; i++) {
    const v = verts[i];
    positions.push(v[0] + origin[0], v[1] + origin[1], v[2] + origin[2]);
    normals.push(normal[0], normal[1], normal[2]);
    uvs.push(
      FACE_UV[i][0] === 0 ? tileUv.u0 : tileUv.u1,
      FACE_UV[i][1] === 0 ? tileUv.v0 : tileUv.v1,
    );
    const c = toLinear(shade * (aoLevels ? AO_LEVELS[aoLevels[i]] : 1));
    colors.push(c, c, c);
  }
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

export function buildChunkGeometry(world, chunk, uvFn) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const waterPositions = [];
  const waterNormals = [];
  const waterUvs = [];
  const waterColors = [];
  const waterIndices = [];

  const ox = chunk.cx * 16;
  const oz = chunk.cz * 16;
  const data = chunk.data;

  for (let y = 0; y < world.height; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const id = data[x + z * 16 + y * 256];
        if (id === 0) continue;

        if (id === WATER) {
          buildWaterFaces(world, waterPositions, waterNormals, waterUvs, waterColors, waterIndices, ox + x, y, oz + z);
          continue;
        }

        const block = BLOCKS[id];
        if (!block) continue;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = x + face.n[0];
          const ny = y + face.n[1];
          const nz = z + face.n[2];
          const neighbor = world.getBlock(ox + nx, ny, oz + nz);

          if (isOpaque(neighbor)) continue;
          if (id === GLASS && neighbor === GLASS) continue;
          if (id === LEAVES && neighbor === LEAVES) continue;

          const aoLevels = [];
          for (let i = 0; i < 4; i++) {
            const [s1, s2, c] = face.ao[i];
            const a = isOpaque(world.getBlock(ox + x + s1[0], y + s1[1], oz + z + s1[2])) ? 1 : 0;
            const b = isOpaque(world.getBlock(ox + x + s2[0], y + s2[1], oz + z + s2[2])) ? 1 : 0;
            const corner = isOpaque(world.getBlock(ox + x + c[0], y + c[1], oz + z + c[2])) ? 1 : 0;
            aoLevels.push(a && b ? 0 : 3 - (a + b + corner));
          }

          pushQuad(
            positions,
            normals,
            uvs,
            colors,
            indices,
            face.verts,
            face.n,
            uvFn(block.tiles[f]),
            face.shade,
            aoLevels,
            [x, y, z],
          );
        }
      }
    }
  }

  const solid = makeGeometry(positions, normals, uvs, colors, indices);
  const water = makeGeometry(waterPositions, waterNormals, waterUvs, waterColors, waterIndices);
  return { solid, water };
}

function buildWaterFaces(world, positions, normals, uvs, colors, indices, x, y, z) {
  const above = world.getBlock(x, y + 1, z);
  const topOffset = above === WATER ? 0 : -0.12;
  const surface = 1 + topOffset;
  const tile = 1 / 8;

  if (!isOpaque(above)) {
    // top
    const base = positions.length / 3;
    const verts = [
      [0, surface, 1],
      [1, surface, 1],
      [1, surface, 0],
      [0, surface, 0],
    ];
    for (let i = 0; i < 4; i++) {
      positions.push(x + verts[i][0], y + verts[i][1], z + verts[i][2]);
      normals.push(0, 1, 0);
      uvs.push((x + verts[i][0]) * tile, (z + verts[i][2]) * tile);
      colors.push(1, 1, 1);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const sides = [
    { n: [1, 0, 0], verts: [[1, 0, 1], [1, 0, 0], [1, surface, 0], [1, surface, 1]] },
    { n: [-1, 0, 0], verts: [[0, 0, 0], [0, 0, 1], [0, surface, 1], [0, surface, 0]] },
    { n: [0, 0, 1], verts: [[0, 0, 1], [1, 0, 1], [1, surface, 1], [0, surface, 1]] },
    { n: [0, 0, -1], verts: [[1, 0, 0], [0, 0, 0], [0, surface, 0], [1, surface, 0]] },
  ];

  for (const side of sides) {
    const neighbor = world.getBlock(x + side.n[0], y, z + side.n[2]);
    if (neighbor !== 0) continue;
    const base = positions.length / 3;
    for (let i = 0; i < 4; i++) {
      const v = side.verts[i];
      positions.push(x + v[0], y + v[1], z + v[2]);
      normals.push(side.n[0], side.n[1], side.n[2]);
      const u = side.n[0] !== 0 ? z + v[2] : x + v[0];
      uvs.push(u * tile, (y + v[1]) * tile);
      colors.push(0.82, 0.86, 0.9);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function makeGeometry(positions, normals, uvs, colors, indices) {
  if (positions.length === 0) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildBlockGeometry(blockId, uvFn, size = 1) {
  const block = BLOCKS[blockId];
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const half = size / 2;

  for (let f = 0; f < 6; f++) {
    const face = FACES[f];
    const tileUv = uvFn(block.tiles[f]);
    const base = positions.length / 3;
    for (let i = 0; i < 4; i++) {
      const v = face.verts[i];
      positions.push(v[0] * size - half, v[1] * size - half, v[2] * size - half);
      normals.push(face.n[0], face.n[1], face.n[2]);
      uvs.push(FACE_UV[i][0] === 0 ? tileUv.u0 : tileUv.u1, FACE_UV[i][1] === 0 ? tileUv.v0 : tileUv.v1);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
