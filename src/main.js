import './style.css';
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createAtlas, createWaterTexture } from './textures.js';
import { World, SEA_LEVEL } from './world.js';
import { Player } from './player.js';
import { Environment } from './environment.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Particles } from './effects.js';
import { HOTBAR, BLOCKS, AIR, WATER, GRASS, blockName } from './blocks.js';
import { buildBlockGeometry } from './mesher.js';

const SAVE_KEY = 'blockfall.save.v1';
const MUTE_KEY = 'blockfall.muted';

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const menu = $('menu');
const loading = $('loading');
const loadFill = $('load-fill');
const loadText = $('load-text');
const hud = $('hud');
const touchControls = $('touch-controls');
const hotbarEl = $('hotbar');
const statsEl = $('stats');
const fpsEl = $('fps');
const coordsEl = $('coords');
const toastEl = $('toast');
const hintEl = $('hint');
const underwaterEl = $('underwater');
const seedLabel = $('seed-label');
const pauseSeedLabel = $('pause-seed-label');
const worldStatus = $('world-status');
const pauseOverlay = $('pause');
const soundBtn = $('sound-btn');
const pauseSoundBtn = $('pause-sound-btn');

const isTouchDevice =
  window.matchMedia?.('(pointer: coarse)').matches ||
  navigator.maxTouchPoints > 0 ||
  window.innerWidth <= 820;

const renderRadius = isTouchDevice ? 4 : 6;

/* ------------------------------------------------------------------ */
/* Renderer + scene                                                    */
/* ------------------------------------------------------------------ */

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouchDevice ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.type = PCFSoftShadowMap;

let softwareRenderer = false;
try {
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  softwareRenderer = /swiftshader|llvmpipe|software|basic render/i.test(name);
} catch {
  /* ignore */
}
if (softwareRenderer) renderer.setPixelRatio(1);

const shadows = !isTouchDevice && !softwareRenderer;
renderer.shadowMap.enabled = shadows;

const scene = new Scene();
const camera = new PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 900);
scene.add(camera);

/* ------------------------------------------------------------------ */
/* World, player, environment                                          */
/* ------------------------------------------------------------------ */

const atlas = createAtlas();
atlas.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const waterTexture = createWaterTexture();

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const save = readSave();
let seed = save?.seed >>> 0;
if (!Number.isFinite(seed) || seed === 0) seed = (Math.random() * 0xffffffff) >>> 0;

const world = new World({ scene, seed, atlas, waterTexture });
if (save?.edits) world.loadEdits(save.edits);

const spawn = world.findSpawn();
const player = new Player(world, camera);
let usingSavedPosition = false;
if (
  save?.player &&
  Number.isFinite(save.player.x) &&
  Number.isFinite(save.player.y) &&
  Number.isFinite(save.player.z)
) {
  player.position.set(save.player.x, save.player.y, save.player.z);
  player.yaw = Number.isFinite(save.player.yaw)
    ? save.player.yaw
    : spawn.yaw ?? world.scenicYaw(spawn.x, spawn.z);
  player.pitch = Number.isFinite(save.player.pitch) ? save.player.pitch : -0.1;
  usingSavedPosition = true;
} else {
  player.spawn(spawn.x, spawn.z, spawn.h, spawn.yaw ?? world.scenicYaw(spawn.x, spawn.z));
}

const environment = new Environment(scene, { shadows });
if (Number.isFinite(save?.time)) environment.time = save.time;

const focus = player.position.clone();
world.prime(focus.x, focus.z, 4);

if (usingSavedPosition) {
  const px = Math.floor(player.position.x);
  const py = Math.floor(player.position.y);
  const pz = Math.floor(player.position.z);
  if (world.isSolidAt(px, py + 0.3, pz) || world.isSolidAt(px, py + 1.1, pz)) {
    player.spawn(spawn.x, spawn.z, spawn.h, spawn.yaw ?? world.scenicYaw(spawn.x, spawn.z));
  }
}
player.updateCamera();

const particles = new Particles(scene, world);
const sound = new Sound();
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* ignore */
}
sound.setMuted(muted);

/* ------------------------------------------------------------------ */
/* Selection + held block                                              */
/* ------------------------------------------------------------------ */

const highlightGeometry = new EdgesGeometry(new BoxGeometry(1.004, 1.004, 1.004));
const highlightMaterial = new LineBasicMaterial({
  color: 0x0a0d0a,
  transparent: true,
  opacity: 0.55,
  depthTest: true,
});
const highlight = new LineSegments(highlightGeometry, highlightMaterial);
highlight.visible = false;
highlight.renderOrder = 3;
scene.add(highlight);

const heldMaterial = new MeshLambertMaterial({
  map: atlas.texture,
  alphaTest: 0.45,
  fog: false,
});
let heldMesh = null;
let selected = 0;
let swing = 0;

function updateHeldMesh() {
  if (heldMesh) {
    camera.remove(heldMesh);
    heldMesh.geometry.dispose();
  }
  heldMesh = new Mesh(buildBlockGeometry(HOTBAR[selected], atlas.uv, 0.15), heldMaterial);
  heldMesh.position.set(0.33, -0.28, -0.8);
  heldMesh.rotation.set(0.1, -0.62, 0.16);
  heldMesh.renderOrder = 6;
  camera.add(heldMesh);
  heldMesh.visible = state === 'playing';
}

function selectSlot(index) {
  selected = (index + HOTBAR.length) % HOTBAR.length;
  [...hotbarEl.children].forEach((slot, i) => slot.classList.toggle('selected', i === selected));
  updateHeldMesh();
  if (state === 'playing') sound.click();
}

/* ------------------------------------------------------------------ */
/* Hotbar                                                              */
/* ------------------------------------------------------------------ */

for (let i = 0; i < HOTBAR.length; i++) {
  const id = HOTBAR[i];
  const button = document.createElement('button');
  button.className = 'slot';
  button.type = 'button';
  button.setAttribute('aria-label', blockName(id));
  button.title = blockName(id);
  const icon = atlas.drawIcon(id, 38);
  icon.style.pointerEvents = 'none';
  button.appendChild(icon);
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = String(i + 1);
  button.appendChild(num);
  button.addEventListener('click', () => selectSlot(i));
  hotbarEl.appendChild(button);
}

/* ------------------------------------------------------------------ */
/* State machine                                                       */
/* ------------------------------------------------------------------ */

let state = 'boot';
let menuTime = 0;
let saveDirty = false;
let toastTimer = null;
let hintTimer = null;
let mineCooldown = 0;
let placeCooldown = 0;
let target = null;
let wasInWater = false;
let suppressUnlockUntil = 0;
let fpsAccum = 0;
let fpsFrames = 0;
let statsTimer = 0;
let fpsValue = 60;

const tmpEye = new Vector3();
const tmpDir = new Vector3();
const tmpFocus = new Vector3();
const tmpLook = new Vector3();

menu.classList.add('hidden');
loading.classList.remove('hidden');
loadFill.style.width = '12%';
loadText.textContent = 'shaping terrain…';
seedLabel.textContent = `#${world.seed.toString(16).padStart(8, '0')}`;
pauseSeedLabel.textContent = seedLabel.textContent;
if (save?.edits?.length) worldStatus.textContent = '· saved world';

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

const input = new Input({
  canvas,
  joystick: $('joystick'),
  joystickKnob: $('joystick-knob'),
  mineButton: $('mine-btn'),
  placeButton: $('place-btn'),
  jumpButton: $('jump-btn'),
  onFly: () => {
    if (state !== 'playing') return;
    const flying = player.toggleFly();
    showToast(flying ? 'Flight on — Space to rise, Shift to sink' : 'Flight off');
  },
  onPause: () => {
    if (performance.now() < suppressUnlockUntil) return;
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  },
  onHotbar: (value, relative) => {
    if (state !== 'playing' && state !== 'paused') return;
    if (relative) selectSlot(selected + value);
    else selectSlot(value);
  },
});

/* ------------------------------------------------------------------ */
/* UI actions                                                          */
/* ------------------------------------------------------------------ */

function showToast(message, duration = 2400) {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden', 'fade');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.add('fade');
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 450);
  }, duration);
}

function updateSoundUI() {
  soundBtn.classList.toggle('muted', muted);
  soundBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  pauseSoundBtn.textContent = `Sound: ${muted ? 'Off' : 'On'}`;
}

function toggleSound() {
  muted = !muted;
  sound.setMuted(muted);
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  updateSoundUI();
  if (!muted) {
    sound.ensure();
    sound.click();
  }
}

function saveWorld() {
  try {
    const data = {
      v: 1,
      seed: world.seed,
      edits: world.serializeEdits(),
      time: environment.time,
      player: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        yaw: player.yaw,
        pitch: player.pitch,
      },
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    saveDirty = false;
    worldStatus.textContent = '· saved';
  } catch {
    /* storage may be unavailable */
  }
}

function startPlaying() {
  if (state !== 'menu') return;
  state = 'playing';
  sound.ensure();
  sound.click();
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  if (input.isTouch) touchControls.classList.remove('hidden');
  pauseOverlay.classList.add('hidden');
  player.updateCamera();
  input.requestLock();
  updateHeldMesh();
  showToast(
    input.isTouch
      ? 'Drag to look · tap to mine · use the buttons to build'
      : 'Left click to mine · right click to place',
    4200,
  );
  hintEl.style.opacity = '1';
  hintEl.textContent = input.isTouch ? 'Tap to mine · drag to look' : '1–9 pick a block · F to fly · Esc to pause';
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => (hintEl.style.opacity = '0'), 9000);
  wasInWater = player.inWater;
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  suppressUnlockUntil = performance.now() + 320;
  input.releaseLock();
  pauseOverlay.classList.remove('hidden');
  hud.classList.add('hidden');
  touchControls.classList.add('hidden');
  updateSoundUI();
  saveWorld();
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  pauseOverlay.classList.add('hidden');
  hud.classList.remove('hidden');
  if (input.isTouch) touchControls.classList.remove('hidden');
  player.updateCamera();
  input.requestLock();
  updateHeldMesh();
}

function quitToTitle() {
  if (state === 'paused' || state === 'playing') saveWorld();
  state = 'menu';
  suppressUnlockUntil = performance.now() + 320;
  input.releaseLock();
  pauseOverlay.classList.add('hidden');
  hud.classList.add('hidden');
  touchControls.classList.add('hidden');
  menu.classList.remove('hidden');
  menuTime = 0;
  underwaterEl.classList.remove('active');
  environment.underwater = false;
  updateHeldMesh();
}

function newWorld() {
  const hasEdits = world.edits.size > 0;
  if (hasEdits && !window.confirm('Start a new world? Your current build will be replaced.')) return;
  const nextSeed = (Math.random() * 0xffffffff) >>> 0;
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, seed: nextSeed, edits: [], time: 0.34, player: null }),
    );
  } catch {
    /* ignore */
  }
  window.location.reload();
}

$('play-btn').addEventListener('click', startPlaying);
$('new-btn').addEventListener('click', newWorld);
$('pause-new-btn').addEventListener('click', newWorld);
$('resume-btn').addEventListener('click', resumeGame);
$('quit-btn').addEventListener('click', quitToTitle);
$('pause-btn').addEventListener('click', pauseGame);
soundBtn.addEventListener('click', toggleSound);
pauseSoundBtn.addEventListener('click', toggleSound);
updateSoundUI();

window.addEventListener('keydown', (event) => {
  if (event.code === 'Enter' && state === 'menu') startPlaying();
});

window.addEventListener('beforeunload', () => {
  if (state === 'playing' || state === 'paused') saveWorld();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pauseGame();
});

/* ------------------------------------------------------------------ */
/* Interaction                                                         */
/* ------------------------------------------------------------------ */

function updateTarget() {
  player.getEyePosition(tmpEye);
  player.getDirection(tmpDir);
  target = world.raycast(tmpEye, tmpDir, 6.4);
  if (target) {
    highlight.visible = true;
    highlight.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
  } else {
    highlight.visible = false;
  }
}

function mineBlock() {
  if (!target) return;
  const block = BLOCKS[target.id];
  if (!block) return;
  if (block.unbreakable) {
    showToast('Bedrock is unbreakable');
    return;
  }
  const { x, y, z, id } = target;
  if (world.setBlock(x, y, z, AIR)) {
    particles.burst(x, y, z, block.color, 15, 1);
    sound.breakBlock(block.sound);
    swing = 1;
    saveDirty = true;
    target = null;
    highlight.visible = false;
  }
}

function placeBlock() {
  if (!target) return;
  const id = HOTBAR[selected];
  const x = target.x + target.normal[0];
  const y = target.y + target.normal[1];
  const z = target.z + target.normal[2];
  if (y < 0 || y >= world.height) return;
  const existing = world.getBlock(x, y, z);
  if (existing !== AIR && existing !== WATER) return;
  if (player.intersectsBlock(x, y, z)) return;
  if (world.setBlock(x, y, z, id)) {
    particles.burst(x, y, z, BLOCKS[id].color, 5, 0.45);
    sound.placeBlock(BLOCKS[id].sound);
    swing = 1;
    saveDirty = true;
  }
}

function updateInteraction(dt) {
  mineCooldown -= dt;
  placeCooldown -= dt;
  const tap = input.consumeTapMine();
  if (tap) {
    updateTarget();
    mineBlock();
    mineCooldown = 0.24;
    return;
  }
  if (input.mineHeld && mineCooldown <= 0) {
    updateTarget();
    mineBlock();
    mineCooldown = 0.2;
  } else if (input.placeHeld && placeCooldown <= 0) {
    updateTarget();
    placeBlock();
    placeCooldown = 0.2;
  }
}

/* ------------------------------------------------------------------ */
/* Camera + per-state update                                           */
/* ------------------------------------------------------------------ */

function updateMenuCamera(dt) {
  menuTime += dt;
  const yaw = player.yaw;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);

  // Aerial establishing shot: hover above and just behind the spawn,
  // looking out along the scenic direction the player will face.
  const sway = Math.sin(menuTime * 0.11) * 2.4;
  const back = 16 + Math.sin(menuTime * 0.07) * 2;
  const desiredX = player.position.x - fx * back + rx * sway;
  const desiredZ = player.position.z - fz * back + rz * sway;

  const lookAhead = 58;
  const lookX = player.position.x + fx * lookAhead;
  const lookZ = player.position.z + fz * lookAhead;
  const lookGround = Math.max(
    world.heightAt(Math.floor(lookX), Math.floor(lookZ)),
    SEA_LEVEL,
  );

  const terrainHere = Math.max(
    world.heightAt(Math.floor(desiredX), Math.floor(desiredZ)),
    world.heightAt(
      Math.floor((desiredX + player.position.x) / 2),
      Math.floor((desiredZ + player.position.z) / 2),
    ),
  );

  const desiredY = Math.max(
    player.position.y + 28,
    terrainHere + 15,
    lookGround + 19,
  ) + Math.sin(menuTime * 0.17) * 0.9;

  camera.position.set(desiredX, desiredY, desiredZ);
  tmpLook.set(lookX, lookGround + 13, lookZ);
  camera.lookAt(tmpLook);
  if (Math.abs(camera.fov - 64) > 0.01) {
    camera.fov = 64;
    camera.updateProjectionMatrix();
  }
}

function updatePlaying(dt) {
  input.update();
  const look = input.takeLook();
  player.look(look.dx, look.dy, input.isTouch ? 0.0034 : 0.0022);
  player.update(dt, {
    moveX: input.move.x,
    moveY: input.move.y,
    jump: input.jump,
    sprint: input.sprint,
    descend: input.descend,
  });

  world.update(player.position.x, player.position.z, renderRadius, {
    genBudget: 3,
    meshBudget: 6,
  });

  environment.underwater = player.headInWater;
  environment.update(dt, camera, player.position);
  underwaterEl.classList.toggle('active', player.headInWater);

  if (player.inWater && !wasInWater) {
    sound.splash();
    particles.splash(player.position.x, player.position.y + 0.2, player.position.z);
  }
  wasInWater = player.inWater;

  if (player.onGround && player.stepDistance > 2.1) {
    player.stepDistance = 0;
    const below = world.getBlock(
      Math.floor(player.position.x),
      Math.floor(player.position.y - 0.3),
      Math.floor(player.position.z),
    );
    sound.step(BLOCKS[below]?.sound ?? 'soft');
  }

  updateTarget();
  updateInteraction(dt);
  particles.update(dt);

  swing = Math.max(0, swing - dt * 4.2);
  if (heldMesh) {
    const bob = Math.sin(player.walkTime * 2) * 0.007;
    heldMesh.position.set(0.33, -0.28 + bob - swing * 0.04, -0.8 - swing * 0.08);
    heldMesh.rotation.set(0.1 - swing * 0.55, -0.62 + swing * 0.18, 0.16);
  }

  const targetFov = 72 + player.fovKick;
  if (Math.abs(camera.fov - targetFov) > 0.02) {
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
  }

  fpsAccum += dt;
  fpsFrames++;
  statsTimer += dt;
  if (statsTimer > 0.35) {
    fpsValue = Math.round(fpsFrames / Math.max(fpsAccum, 0.001));
    fpsEl.textContent = String(fpsValue);
    coordsEl.textContent = `${Math.floor(player.position.x)} ${Math.floor(player.position.y)} ${Math.floor(player.position.z)}`;
    statsTimer = 0;
    fpsAccum = 0;
    fpsFrames = 0;
  }

  saveDirty = true;
}

function updateMenu(dt) {
  updateMenuCamera(dt);
  world.update(player.position.x, player.position.z, renderRadius, {
    genBudget: 5,
    meshBudget: 8,
  });
  environment.underwater = false;
  environment.update(dt, camera, player.position);
  underwaterEl.classList.remove('active');
  particles.update(dt);
  if (heldMesh) heldMesh.visible = false;
  highlight.visible = false;
}

/* ------------------------------------------------------------------ */
/* Main loop                                                           */
/* ------------------------------------------------------------------ */

const clock = { last: performance.now() };
let started = false;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - clock.last) / 1000, 0.05);
  clock.last = now;

  if (state === 'playing') {
    updatePlaying(dt);
    if (heldMesh) heldMesh.visible = true;
  } else if (state === 'paused') {
    if (heldMesh) heldMesh.visible = false;
    highlight.visible = false;
  } else if (state === 'menu') {
    updateMenu(dt);
  } else {
    // boot: keep the sky alive behind the loading card
    environment.update(dt, camera, player.position);
    world.update(player.position.x, player.position.z, renderRadius, { genBudget: 2, meshBudget: 3 });
  }

  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, softwareRenderer ? 1 : isTouchDevice ? 1.5 : 2),
  );
}

window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 120));

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

loadFill.style.width = '100%';
loadText.textContent = 'ready';
saveWorld();
updateSoundUI();
selectSlot(0);
updateMenuCamera(0);
environment.update(0.016, camera, player.position);
renderer.render(scene, camera);

setTimeout(() => {
  loading.classList.add('hidden');
  menu.classList.remove('hidden');
  state = 'menu';
  started = true;
  requestAnimationFrame(frame);
}, 180);

setInterval(() => {
  if (saveDirty && (state === 'playing' || state === 'paused')) saveWorld();
}, 8000);

// Keep the module alive for debugging in the console.
window.blockfall = {
  world,
  player,
  environment,
  renderer,
  scene,
  camera,
  get state() {
    return state;
  },
  get target() {
    return target;
  },
};
