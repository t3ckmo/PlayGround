import * as THREE from 'three'
import './styles.css'
import { createAtlas } from './textures.js'
import { World, RENDER_DISTANCE } from './world.js'
import { Sky } from './sky.js'
import { Player } from './player.js'
import { SoundKit } from './audio.js'
import { Particles } from './particles.js'
import {
  AIR,
  WATER,
  BEDROCK,
  BLOCKS,
  HOTBAR,
  isLiquid
} from './blocks.js'
import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL } from './worldgen.js'

const SAVE_KEY = 'voxelcraft.save.v1'
const URL_PARAMS = new URLSearchParams(location.search)
const DEFAULT_SEED = 17708808

const canvas = document.getElementById('game')
const menuElement = document.getElementById('menu')
const loadingElement = document.getElementById('loading')
const pauseElement = document.getElementById('pause')
const hudElement = document.getElementById('hud')
const touchElement = document.getElementById('touch-controls')
const progressFill = document.getElementById('progress-fill')
const loadingText = document.querySelector('.loading-text')
const seedValue = document.getElementById('seed-value')
const statsElement = document.getElementById('stats')
const clockText = document.getElementById('clock-text')
const blockLabel = document.getElementById('block-label')
const hotbarElement = document.getElementById('hotbar')
const waterOverlay = document.getElementById('water-overlay')
const modeBadge = document.getElementById('mode-badge')

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setClearColor(0xbfe0f5, 1)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1200)
camera.position.set(0, 60, 0)

const atlas = createAtlas()
const sound = new SoundKit()

let world
let sky
let player
let particles
let started = false
let paused = false
let isTouch = false
let selected = 0
let target = null
let save = null
let labelTimeout = null
let lastBreak = 0
let lastPlace = 0
let mining = false
let building = false
let fps = 60
let statsTimer = 0
let clockTimer = 0
let saveTimer = 0
let lastFrame = performance.now()
let dragLook = null
let lookPointer = null
let touchJumpTimeout = null
let lastJumpTap = 0
let foundSeed = null

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: true })
)
highlight.visible = false
highlight.renderOrder = 3
scene.add(highlight)

const eye = new THREE.Vector3()
const lookDirection = new THREE.Vector3()

init().catch((error) => {
  console.error(error)
  loadingText.textContent = 'Could not start the world. Reload to try again.'
})

async function init() {
  const urlSeed = URL_PARAMS.get('seed')
  save = urlSeed !== null ? null : loadSave()
  const seed = urlSeed !== null ? Number(urlSeed) >>> 0 : save?.seed ?? DEFAULT_SEED
  foundSeed = seed

  world = new World(scene, atlas, seed, save?.edits || [])
  sky = new Sky(scene)
  particles = new Particles(scene)
  player = new Player(world, camera, canvas)
  player.callbacks = {
    onStep: () => sound.step(),
    onJump: () => sound.jump(),
    onLand: () => sound.land(),
    onFly: (flying) => {
      modeBadge.textContent = flying ? 'creative · flying' : 'creative'
      toast(flying ? 'Flying enabled' : 'Flying disabled')
    }
  }

  buildHotbar()
  updateTouchMode()
  window.addEventListener('resize', onResize)
  window.addEventListener('resize', updateTouchMode)
  bindInput()

  if (loadingElement) loadingElement.classList.remove('hidden')
  await world.preload((progress) => {
    progressFill.style.width = `${Math.round(progress)}%`
    if (progress > 56) loadingText.textContent = 'Building chunks…'
    else if (progress > 20) loadingText.textContent = 'Planting forests…'
  })

  const spawn = world.spawn
  const savedPlayer = save?.player
  if (savedPlayer && Number.isFinite(savedPlayer.x) && savedPlayer.y > 0) {
    player.spawn = {
      x: savedPlayer.x,
      y: savedPlayer.y,
      z: savedPlayer.z,
      yaw: savedPlayer.yaw ?? spawn.yaw,
      pitch: savedPlayer.pitch ?? -0.07
    }
    player.respawn()
  } else {
    const feetY = spawn.height + 1
    world.clearSpawnArea(spawn.x, feetY, spawn.z, 5, 10)
    player.setSpawn(spawn.x, feetY, spawn.z, spawn.yaw, spawn.pitch)
  }

  if (save?.time !== undefined) sky.time = save.time
  if (save?.day !== undefined) sky.day = save.day
  if (save?.selected !== undefined) selected = Math.min(HOTBAR.length - 1, Math.max(0, save.selected))

  if (!savedPlayer && window.innerHeight > window.innerWidth) {
    // Portrait screens see more sky with a level camera; tilt down a touch.
    player.pitch = -0.17
  }

  updateSelection(selected, false)
  seedValue.textContent = String(seed)
  sky.update(0, camera.position)
  applySkyTint()
  syncCamera()

  loadingElement.classList.add('hidden')
  menuElement.classList.remove('hidden')
  window.__VOXEL_READY_AT__ = performance.now()

  // A small read-only handle is handy for automated capture and debugging.
  window.__VOXEL__ = {
    world,
    player,
    sky,
    breakTarget,
    placeTarget,
    select: updateSelection,
    get target() {
      return target
    },
    get readyAt() {
      return performance.now()
    }
  }

  if (!save) {
    // Make sure the first frame behind the menu is already lit correctly.
    world.update(player.position.x, player.position.z, 8)
  }

  requestAnimationFrame(loop)
}

function randomSeed() {
  return (Math.random() * 1_000_000_000) | 0
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data.seed !== 'number') return null
    return data
  } catch {
    return null
  }
}

function persist() {
  if (!started || !world || !sky || !player) return
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        seed: world.seed,
        edits: world.serializeEdits(),
        player: {
          x: player.position.x,
          y: player.position.y,
          z: player.position.z,
          yaw: player.yaw,
          pitch: player.pitch
        },
        time: sky.time,
        day: sky.day,
        selected
      })
    )
  } catch {
    // Storage is a nice-to-have; ignore quota or privacy errors.
  }
}

function newWorld() {
  localStorage.removeItem(SAVE_KEY)
  const url = new URL(location.href)
  url.searchParams.set('seed', String(randomSeed()))
  location.href = url.toString()
}

function buildHotbar() {
  hotbarElement.innerHTML = ''
  HOTBAR.forEach((blockId, index) => {
    const slot = document.createElement('button')
    slot.className = 'slot'
    slot.type = 'button'
    slot.setAttribute('aria-label', BLOCKS[blockId].name)
    const icon = atlas.createIcon(blockId, 64)
    slot.appendChild(icon)
    const number = document.createElement('span')
    number.className = 'num'
    number.textContent = String(index + 1)
    slot.appendChild(number)
    slot.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
      event.preventDefault()
      updateSelection(index, true)
    })
    hotbarElement.appendChild(slot)
  })
}

function updateSelection(index, announce = true) {
  selected = ((index % HOTBAR.length) + HOTBAR.length) % HOTBAR.length
  const slots = hotbarElement.children
  for (let i = 0; i < slots.length; i++) slots[i].classList.toggle('selected', i === selected)
  if (announce) toast(BLOCKS[HOTBAR[selected]].name)
}

function toast(text) {
  blockLabel.textContent = text
  blockLabel.classList.add('show')
  clearTimeout(labelTimeout)
  labelTimeout = setTimeout(() => blockLabel.classList.remove('show'), 1400)
}

function updateTouchMode() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  isTouch = Boolean(coarse || navigator.maxTouchPoints > 0 || window.innerWidth <= 820)
  document.body.classList.toggle('touch', isTouch)
  touchElement.classList.toggle('hidden', !(isTouch && started && !paused))
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function syncCamera() {
  camera.position.set(player.position.x, player.position.y + 1.62, player.position.z)
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ')
}

function startGame() {
  if (started) return
  started = true
  sound.init()
  menuElement.classList.add('hidden')
  hudElement.classList.remove('hidden')
  player.enabled = true
  updateTouchMode()
  syncCamera()
  requestPointerLock()
  toast('Welcome to VoxelCraft')
  // Prime the target ray so the first click feels immediate.
  updateTarget()
}

function requestPointerLock() {
  if (isTouch || paused) return
  try {
    const result = canvas.requestPointerLock?.()
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch {
    // Pointer lock can be denied; drag-to-look still works.
  }
}

function pauseGame() {
  if (!started || paused) return
  paused = true
  player.enabled = false
  mining = false
  building = false
  document.exitPointerLock?.()
  pauseElement.classList.remove('hidden')
  touchElement.classList.add('hidden')
  persist()
}

function resumeGame() {
  if (!started || !paused) return
  paused = false
  player.enabled = true
  pauseElement.classList.add('hidden')
  updateTouchMode()
  sound.init()
  requestPointerLock()
}

function setSelectedByWheel(direction) {
  updateSelection(selected + direction, true)
}

function bindInput() {
  document.getElementById('play-btn').addEventListener('click', startGame)
  document.getElementById('newworld-btn').addEventListener('click', newWorld)
  document.getElementById('newworld-btn-2').addEventListener('click', newWorld)
  document.getElementById('resume-btn').addEventListener('click', resumeGame)

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
      if (started) {
        if (paused) resumeGame()
        else pauseGame()
      }
      return
    }
    if (!started || paused) return

    if (event.code.startsWith('Digit')) {
      const digit = Number(event.code.slice(5))
      if (digit >= 1 && digit <= HOTBAR.length) updateSelection(digit - 1)
    }
    if (event.code === 'KeyM') {
      const muted = sound.toggleMute()
      toast(muted ? 'Sound muted' : 'Sound on')
    }
  })

  window.addEventListener('wheel', (event) => {
    if (!started || paused) return
    if (Math.abs(event.deltaY) < 2) return
    setSelectedByWheel(event.deltaY > 0 ? 1 : -1)
  }, { passive: true })

  canvas.addEventListener('contextmenu', (event) => event.preventDefault())

  canvas.addEventListener('pointerdown', (event) => {
    if (!started || paused) return
    sound.init()

    if (event.pointerType === 'touch') {
      lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
      canvas.setPointerCapture?.(event.pointerId)
      event.preventDefault()
      return
    }

    if (document.pointerLockElement === canvas) {
      if (event.button === 0) {
        mining = true
        breakTarget()
      } else if (event.button === 2) {
        building = true
        placeTarget()
      }
      return
    }

    dragLook = {
      button: event.button,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false
    }
  })

  canvas.addEventListener('pointermove', (event) => {
    if (!started || paused) return
    if (event.pointerType === 'touch') {
      if (lookPointer && lookPointer.id === event.pointerId) {
        const dx = event.clientX - lookPointer.x
        const dy = event.clientY - lookPointer.y
        lookPointer.x = event.clientX
        lookPointer.y = event.clientY
        player.look(dx, dy, 0.0042)
      }
      return
    }

    if (document.pointerLockElement === canvas) {
      player.look(event.movementX || 0, event.movementY || 0, 0.0022)
      return
    }

    if (dragLook) {
      const dx = event.clientX - dragLook.lastX
      const dy = event.clientY - dragLook.lastY
      if (Math.abs(event.clientX - dragLook.x) + Math.abs(event.clientY - dragLook.y) > 4) {
        dragLook.moved = true
      }
      if (dragLook.moved) player.look(dx, dy, 0.0032)
      dragLook.lastX = event.clientX
      dragLook.lastY = event.clientY
    }
  })

  const endPointer = (event) => {
    if (event.pointerType === 'touch') {
      if (lookPointer && lookPointer.id === event.pointerId) lookPointer = null
      return
    }
    if (document.pointerLockElement === canvas) {
      if (event.button === 0) mining = false
      if (event.button === 2) building = false
      return
    }
    if (dragLook) {
      const wasDrag = dragLook
      dragLook = null
      if (!wasDrag.moved) {
        if (wasDrag.button === 0) breakTarget()
        else if (wasDrag.button === 2) placeTarget()
      }
    }
  }
  canvas.addEventListener('pointerup', endPointer)
  canvas.addEventListener('pointercancel', endPointer)

  document.addEventListener('pointerlockchange', () => {
    if (!started || paused) return
    if (document.pointerLockElement !== canvas && !isTouch) {
      // Clicking the canvas returns to mouse-look when the lock was lost.
      mining = false
      building = false
    }
  })

  // Touch controls ------------------------------------------------------
  const joystick = document.getElementById('joystick')
  const knob = document.getElementById('joystick-knob')
  const jumpButton = document.getElementById('btn-jump')
  const breakButton = document.getElementById('btn-break')
  const placeButton = document.getElementById('btn-place')
  let joyPointer = null
  let joyCenter = { x: 0, y: 0, radius: 1 }

  joystick.addEventListener('pointerdown', (event) => {
    if (!started || paused) return
    event.preventDefault()
    event.stopPropagation()
    joystick.classList.add('active')
    const rect = joystick.getBoundingClientRect()
    joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: rect.width * 0.34 }
    joyPointer = event.pointerId
    joystick.setPointerCapture?.(event.pointerId)
    updateJoystick(event)
  })

  function updateJoystick(event) {
    if (joyPointer !== event.pointerId) return
    let dx = event.clientX - joyCenter.x
    let dy = event.clientY - joyCenter.y
    const length = Math.hypot(dx, dy)
    if (length > joyCenter.radius) {
      dx = (dx / length) * joyCenter.radius
      dy = (dy / length) * joyCenter.radius
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`
    player.setJoystick(dx / joyCenter.radius, -dy / joyCenter.radius)
  }

  joystick.addEventListener('pointermove', updateJoystick)
  const endJoystick = (event) => {
    if (joyPointer !== event.pointerId) return
    joyPointer = null
    joystick.classList.remove('active')
    knob.style.transform = 'translate(0px, 0px)'
    player.setJoystick(0, 0)
  }
  joystick.addEventListener('pointerup', endJoystick)
  joystick.addEventListener('pointercancel', endJoystick)

  jumpButton.addEventListener('pointerdown', (event) => {
    if (!started || paused) return
    event.preventDefault()
    sound.init()
    player.touchJump = true
    jumpButton.classList.add('pressed')
    const now = performance.now()
    if (now - lastJumpTap < 300) {
      player.toggleFly()
      lastJumpTap = 0
    } else {
      lastJumpTap = now
    }
    clearTimeout(touchJumpTimeout)
    touchJumpTimeout = setTimeout(() => {
      player.touchJump = false
      jumpButton.classList.remove('pressed')
    }, 180)
  })
  const stopJump = () => {
    player.touchJump = false
    jumpButton.classList.remove('pressed')
  }
  jumpButton.addEventListener('pointerup', stopJump)
  jumpButton.addEventListener('pointercancel', stopJump)
  jumpButton.addEventListener('pointerleave', stopJump)

  breakButton.addEventListener('pointerdown', () => {
    if (!started || paused) return
    mining = true
    breakButton.classList.add('pressed', 'holding')
    breakTarget()
  })
  const stopBreak = () => {
    mining = false
    breakButton.classList.remove('pressed', 'holding')
  }
  breakButton.addEventListener('pointerup', stopBreak)
  breakButton.addEventListener('pointercancel', stopBreak)
  breakButton.addEventListener('pointerleave', stopBreak)

  placeButton.addEventListener('pointerdown', () => {
    if (!started || paused) return
    building = true
    placeButton.classList.add('pressed')
    placeTarget()
  })
  const stopPlace = () => {
    building = false
    placeButton.classList.remove('pressed')
  }
  placeButton.addEventListener('pointerup', stopPlace)
  placeButton.addEventListener('pointercancel', stopPlace)
  placeButton.addEventListener('pointerleave', stopPlace)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist()
  })
  window.addEventListener('beforeunload', persist)

  setInterval(persist, 12000)
}

function updateTarget() {
  if (!started || paused) {
    highlight.visible = false
    return
  }
  player.getEyePosition(eye)
  player.getLookDirection(lookDirection)
  target = world.raycast(eye, lookDirection, 7)
  if (target) {
    highlight.visible = true
    highlight.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
  } else {
    highlight.visible = false
  }
}

function breakTarget() {
  const now = performance.now()
  if (now - lastBreak < 170) return
  updateTarget()
  if (!target) return
  const { x, y, z, block } = target
  if (block === BEDROCK) {
    toast('Bedrock is unbreakable')
    return
  }
  lastBreak = now
  world.setBlock(x, y, z, AIR)
  const def = BLOCKS[block]
  if (def) {
    particles.spawn(x, y, z, def.color, 18)
    sound.breakBlock(def)
  }
  updateTarget()
}

function placeTarget() {
  const now = performance.now()
  if (now - lastPlace < 200) return
  updateTarget()
  if (!target) return
  const px = target.x + target.normal[0]
  const py = target.y + target.normal[1]
  const pz = target.z + target.normal[2]
  if (py < 0 || py >= WORLD_HEIGHT) return
  const current = world.getBlock(px, py, pz)
  if (current !== AIR && !isLiquid(current)) return
  if (player.playerBoxIntersects(px, py, pz)) return

  const blockId = HOTBAR[selected]
  if (!world.setBlock(px, py, pz, blockId)) return
  lastPlace = now
  const def = BLOCKS[blockId]
  sound.placeBlock()
  particles.spawn(px, py, pz, def.color, 5)
  updateTarget()
}

function applySkyTint() {
  world.solidMaterial.color.copy(sky.blockTint)
  world.waterMaterial.color.copy(sky.waterTint)
  highlight.material.color.setRGB(
    0.85 + sky.daylight * 0.15,
    0.9 + sky.daylight * 0.1,
    0.85 + sky.daylight * 0.15
  )
}

function updateHud(dt) {
  statsTimer += dt
  clockTimer += dt
  if (statsTimer > 0.2) {
    statsTimer = 0
    const x = Math.floor(player.position.x)
    const y = Math.floor(player.position.y)
    const z = Math.floor(player.position.z)
    const mode = player.flying ? 'flying' : 'creative'
    statsElement.textContent = `x ${x}   y ${y}   z ${z}   ·   ${Math.round(fps)} fps   ·   ${mode}`
    modeBadge.textContent = player.flying ? 'creative · flying' : 'creative'
  }
  if (clockTimer > 0.6) {
    clockTimer = 0
    clockText.textContent = sky.clockLabel
  }
  const underwater = started && !paused && player.headInWater
  waterOverlay.classList.toggle('active', Boolean(underwater))
}

function loop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000))
  lastFrame = now
  fps = fps * 0.92 + (1 / Math.max(dt, 0.0001)) * 0.08

  if (started && !paused) {
    player.update(dt)
  }

  if (started && !paused) {
    sky.update(dt, camera.position)
    world.update(player.position.x, player.position.z, 6)
    applySkyTint()
    updateTarget()

    if (mining && performance.now() - lastBreak >= 190) breakTarget()
    if (building && performance.now() - lastPlace >= 220) placeTarget()

    particles.update(dt)
    updateHud(dt)
  } else {
    // Keep the world warmed up behind the menu and pause screen.
    world.update(player.position.x, player.position.z, 5)
    particles.update(dt)
    if (!started) sky.update(0, camera.position)
  }

  renderer.render(scene, camera)
  requestAnimationFrame(loop)
}

window.addEventListener('error', (event) => {
  if (loadingElement && !loadingElement.classList.contains('hidden')) {
    console.error(event.error || event.message)
  }
})
