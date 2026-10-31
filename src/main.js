import * as THREE from 'three'
import { createWorld, floorAt } from './world.js'
import { Soundscape } from './audio.js'

const $ = (selector) => document.querySelector(selector)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))

const dom = {
  canvas: $('#scene'),
  loading: $('#loadingScreen'),
  title: $('#titleScreen'),
  start: $('#startBtn'),
  hud: $('#hud'),
  objective: $('#objective'),
  objectiveSub: $('#objectiveSub'),
  health: $('#healthFill'),
  stamina: $('#staminaFill'),
  inventory: $('#inventory'),
  reticle: $('#reticle'),
  prompt: $('#interactPrompt'),
  promptKey: $('#promptKey'),
  promptText: $('#promptText'),
  caption: $('#caption'),
  toast: $('#toast'),
  lightning: $('#lightningFlash'),
  hurt: $('#hurtFlash'),
  white: $('#whiteFade'),
  note: $('#noteOverlay'),
  noteKicker: $('#noteKicker'),
  noteTitle: $('#noteTitle'),
  noteBody: $('#noteBody'),
  noteClose: $('#noteClose'),
  pause: $('#pauseOverlay'),
  pauseBtn: $('#pauseBtn'),
  resume: $('#resumeBtn'),
  pauseRestart: $('#pauseRestartBtn'),
  death: $('#deathOverlay'),
  restart: $('#restartBtn'),
  deathTip: $('#deathTip'),
  win: $('#winOverlay'),
  winRestart: $('#winRestartBtn'),
  winStats: $('#winStats'),
  ammoHud: $('#ammoHud'),
  ammoHudCount: $('#ammoHudCount'),
  fireBtn: $('#fireBtn'),
  ammoCount: $('#ammoCount'),
  interactBtn: $('#interactBtn'),
  lightBtn: $('#lightBtn'),
  runBtn: $('#runBtn'),
  joystick: $('#joystick'),
  joyKnob: $('.joy-knob'),
  deviceHint: $('#deviceHint'),
}

const coarsePointer = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
const touchMode = coarsePointer || window.innerWidth <= 820
const mobileGPU = coarsePointer || window.innerWidth <= 900
document.body.classList.add(touchMode ? 'touch' : 'desktop')
if (dom.deviceHint) dom.deviceHint.textContent = touchMode ? 'TOUCH TO SURVIVE' : 'TOUCH · KEYBOARD · MOUSE'

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({
  canvas: dom.canvas,
  antialias: !mobileGPU,
  powerPreference: 'high-performance',
  alpha: false,
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileGPU ? 1.55 : 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.17

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x040606)
scene.fog = new THREE.FogExp2(0x060909, 0.044)

const camera = new THREE.PerspectiveCamera(window.innerWidth < window.innerHeight ? 80 : 72, window.innerWidth / window.innerHeight, 0.035, 48)
camera.rotation.order = 'YXZ'
scene.add(camera)

const world = createWorld(scene)

// ---------------------------------------------------------------- state
const game = {
  state: 'title',
  fuses: 0,
  hasGun: false,
  hasKey: false,
  powered: false,
  powerLevel: 0,
  doorOpen: false,
  ammo: 0,
  reserve: 0,
  shots: 0,
  reloading: 0,
  startTime: 0,
  elapsed: 0,
  powerTimer: -1,
  enemySpawned: false,
  enemyDead: false,
  lightningTimer: 7,
  flashPower: 0,
  flashTick: 0,
  danger: 0,
  captionTimer: 0,
  toastTimer: 0,
  notesRead: 0,
  pausedFrom: 'playing',
  hasMoved: false,
}

const player = {
  pos: new THREE.Vector3(0, 0, 7.45),
  yaw: 0,
  pitch: -0.045,
  health: 100,
  stamina: 100,
  camY: 1.62,
  bobTime: 0,
  bob: 0,
  moving: false,
  sprinting: false,
  stepAccum: 0,
  shake: 0,
  hurtPulse: 0,
  deadTilt: 0,
  looked: false,
}

const input = {
  keys: {},
  joyX: 0,
  joyZ: 0,
  run: false,
  forward: 0,
  strafe: 0,
}

const audio = new Soundscape()
const raycaster = new THREE.Raycaster()
const tempVec = new THREE.Vector3()
const tempVec2 = new THREE.Vector3()
const tempForward = new THREE.Vector3()
const clock = new THREE.Clock()

// ---------------------------------------------------------------- flashlight
const flashlight = new THREE.SpotLight(0xffe9c8, 52, 22, 0.54, 0.68, 1.35)
flashlight.position.set(0, -0.04, 0.02)
flashlight.castShadow = true
flashlight.shadow.mapSize.set(mobileGPU ? 512 : 1024, mobileGPU ? 512 : 1024)
flashlight.shadow.bias = -0.0006
flashlight.shadow.camera.near = 0.1
flashlight.shadow.camera.far = 20
const flashlightTarget = new THREE.Object3D()
flashlightTarget.position.set(0, 0, -5)
camera.add(flashlight)
camera.add(flashlightTarget)
flashlight.target = flashlightTarget
let flashlightOn = true

const flashlightFill = new THREE.PointLight(0x9a9a83, 0.16, 3.2, 1.4)
flashlightFill.position.set(0, -0.12, -0.2)
camera.add(flashlightFill)

// ---------------------------------------------------------------- view models
function viewBox(w, h, d, material, x, y, z, parent, rot = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2])
  mesh.castShadow = false
  mesh.receiveShadow = false
  parent.add(mesh)
  return mesh
}

const torchModel = new THREE.Group()
torchModel.position.set(-0.31, -0.37, -0.68)
torchModel.rotation.set(-0.05, 0.25, -0.06)
camera.add(torchModel)
const torchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.36, 12), world.materials.metalDark)
torchBody.rotation.x = Math.PI / 2
torchBody.position.z = -0.08
torchModel.add(torchBody)
const torchHead = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.042, 0.09, 12), world.materials.metal)
torchHead.rotation.x = Math.PI / 2
torchHead.position.z = -0.3
torchModel.add(torchHead)
const torchLens = new THREE.Mesh(new THREE.CircleGeometry(0.042, 16), new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0.72 }))
torchLens.position.z = -0.348
torchLens.rotation.y = Math.PI
torchModel.add(torchLens)
viewBox(0.1, 0.12, 0.2, world.materials.porcelain, 0.008, -0.08, 0.07, torchModel, [0.24, 0, 0])
torchModel.visible = false

const weaponSteel = new THREE.MeshBasicMaterial({ color: 0x5a6063 })
const weaponMid = new THREE.MeshBasicMaterial({ color: 0x3b4144 })
const weaponDark = new THREE.MeshBasicMaterial({ color: 0x202426 })
const weaponGrip = new THREE.MeshBasicMaterial({ color: 0x3f2a1f })
const weapon = new THREE.Group()
const weaponX = touchMode ? 0.195 : 0.26
const weaponY = touchMode ? -0.175 : -0.155
weapon.position.set(weaponX, weaponY, -0.58)
weapon.rotation.set(0.055, 0.06, 0)
weapon.scale.setScalar(touchMode ? 0.68 : 0.74)
camera.add(weapon)
viewBox(0.088, 0.085, 0.31, weaponSteel, 0, 0.02, -0.055, weapon)
viewBox(0.048, 0.012, 0.27, weaponDark, 0, 0.068, -0.055, weapon)
viewBox(0.08, 0.058, 0.26, weaponMid, 0, -0.028, -0.06, weapon)
viewBox(0.07, 0.06, 0.16, weaponDark, 0, -0.014, -0.24, weapon)
viewBox(0.078, 0.2, 0.11, weaponGrip, 0, -0.145, 0.075, weapon, [-0.16, 0, 0])
viewBox(0.02, 0.03, 0.026, weaponDark, 0, 0.092, 0.06, weapon)
viewBox(0.05, 0.02, 0.024, weaponDark, 0, 0.083, -0.19, weapon)
viewBox(0.014, 0.045, 0.004, weaponDark, -0.046, -0.002, -0.03, weapon)
for (let i = 0; i < 4; i++) viewBox(0.004, 0.045, 0.012, weaponDark, -0.046, 0.025, 0.025 + i * 0.026, weapon)
// Trigger guard and trigger.
viewBox(0.014, 0.06, 0.012, weaponMid, 0, -0.088, -0.005, weapon)
viewBox(0.014, 0.012, 0.07, weaponMid, 0, -0.115, 0.02, weapon)
viewBox(0.012, 0.042, 0.014, weaponDark, 0, -0.067, 0.002, weapon, [0.18, 0, 0])
const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.05, 10), weaponDark)
muzzle.rotation.x = Math.PI / 2
muzzle.position.set(0, 0.0, -0.33)
weapon.add(muzzle)
const muzzleLight = new THREE.PointLight(0xffb463, 0, 7, 2)
muzzleLight.position.set(0, 0.02, -0.36)
weapon.add(muzzleLight)
const muzzleSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: world.textures.glow,
  color: 0xffce87,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
}))
muzzleSprite.scale.set(0.55, 0.55, 1)
muzzleSprite.position.set(0, 0.02, -0.37)
weapon.add(muzzleSprite)
weapon.visible = false
let weaponRecoil = 0
let weaponFlash = 0

// ---------------------------------------------------------------- UI helpers
const icons = {
  fuse: '<svg viewBox="0 0 24 24"><path d="M6 8h12M6 16h12M8 5v14M16 5v14" stroke-width="1.5"/><path d="M2 12h4m12 0h4" stroke-width="1.8"/></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="7" cy="9" r="3.4"/><path d="M10 11.5 19 20m-3-3 2.5-2.5M13 17l2-2"/></svg>',
  gun: '<svg viewBox="0 0 24 24"><path d="M4 8h10l2-2h4v3h-2l-1 2v2h-3l-1 4H9v-4H4z"/></svg>',
  pill: '<svg viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="6" rx="3" transform="rotate(-35 12 12)"/><path d="m9 8 6 8"/></svg>',
}

function renderInventory() {
  const items = []
  if (game.fuses > 0) items.push({ icon: icons.fuse, label: 'FUSE', count: game.fuses })
  if (game.hasKey) items.push({ icon: icons.key, label: 'IRON KEY' })
  if (game.hasGun) items.push({ icon: icons.gun, label: '9MM' })
  dom.inventory.innerHTML = items.map((item) => `
    <div class="inv-item">
      <span class="inv-icon">${item.icon}</span>
      <b>${item.label}</b>${item.count ? `<span>×${item.count}</span>` : ''}
    </div>
  `).join('')
}

function setObjective(title, sub) {
  if (dom.objective.textContent === title && dom.objectiveSub.textContent === sub) return
  dom.objective.textContent = title
  dom.objectiveSub.textContent = sub
  dom.objective.animate(
    [{ opacity: 0.35, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 650, easing: 'ease-out' },
  )
  dom.objectiveSub.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease-out' })
}

function showToast(text) {
  dom.toast.textContent = text
  dom.toast.classList.add('show')
  clearTimeout(game.toastTimer)
  game.toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2300)
}

function showCaption(text, sub = '', duration = 5200) {
  dom.caption.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`
  dom.caption.classList.add('show')
  clearTimeout(game.captionTimer)
  if (duration > 0) {
    game.captionTimer = setTimeout(() => dom.caption.classList.remove('show'), duration)
  }
}

function hideCaption() {
  dom.caption.classList.remove('show')
  clearTimeout(game.captionTimer)
}

function updateVitals() {
  dom.health.style.width = `${clamp(player.health, 0, 100)}%`
  dom.stamina.style.width = `${clamp(player.stamina, 0, 100)}%`
}

function updateAmmo() {
  if (game.hasGun) {
    dom.ammoHud.classList.remove('hidden')
    dom.fireBtn.classList.remove('hidden')
    const value = game.reloading > 0 ? '···' : `${game.ammo} / ${game.reserve}`
    dom.ammoHudCount.textContent = value
    dom.ammoCount.textContent = game.reloading > 0 ? '···' : String(game.ammo)
    dom.ammoHud.classList.toggle('empty', game.ammo === 0 && game.reserve === 0)
  } else {
    dom.ammoHud.classList.add('hidden')
    dom.fireBtn.classList.add('hidden')
  }
}

function setPrompt(label) {
  if (label) {
    dom.promptText.textContent = label
    dom.prompt.classList.remove('hidden')
    dom.reticle.classList.add('active')
    dom.interactBtn.classList.remove('disabled')
  } else {
    dom.prompt.classList.add('hidden')
    dom.reticle.classList.remove('active')
    dom.interactBtn.classList.add('disabled')
  }
}

function setDanger(danger) {
  game.danger = clamp(danger, 0, 1)
  audio.update(0, game.danger)
}

// ---------------------------------------------------------------- input
const keys = input.keys
function hasTouchControls() {
  return touchMode
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return
  const code = event.code
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
    if (game.state === 'playing') event.preventDefault()
  }
  keys[code] = true
  if (code === 'KeyE' && game.state === 'playing') interact()
  if (code === 'KeyF' && game.state === 'playing') toggleFlashlight()
  if (code === 'KeyR' && game.state === 'playing') reload()
  if (code === 'Space' && game.state === 'playing') fire()
  if (code === 'Escape') {
    if (game.state === 'playing') pauseGame()
    else if (game.state === 'paused') resumeGame()
  }
  if (code === 'KeyM' && audio.ctx) {
    audio.setMuted(!audio.muted)
    showToast(audio.muted ? 'AUDIO MUTED' : 'AUDIO ON')
  }
})
window.addEventListener('keyup', (event) => {
  keys[event.code] = false
})
window.addEventListener('blur', () => {
  input.keys = {}
  input.run = false
  for (const key of Object.keys(keys)) keys[key] = false
})

let joystickPointer = null
let joystickOrigin = { x: 0, y: 0 }
let lookPointer = null
let lastLook = { x: 0, y: 0 }
let mouseLocked = false

function resetTouch() {
  joystickPointer = null
  lookPointer = null
  input.joyX = 0
  input.joyZ = 0
  input.run = false
  dom.joystick.classList.add('hidden')
  document.getElementById('moveHint')?.classList.remove('hidden')
  dom.runBtn.classList.remove('pressed')
}

dom.canvas.addEventListener('pointerdown', (event) => {
  if (game.state !== 'playing') return
  if (event.pointerType === 'touch') {
    event.preventDefault()
    if (event.clientX < window.innerWidth * 0.48 && joystickPointer === null) {
      joystickPointer = event.pointerId
      joystickOrigin = { x: event.clientX, y: event.clientY }
      dom.joystick.style.left = `${event.clientX}px`
      dom.joystick.style.top = `${event.clientY}px`
      dom.joystick.classList.remove('hidden')
    document.getElementById('moveHint')?.classList.add('hidden')
      dom.joyKnob.style.transform = 'translate(-50%, -50%)'
      dom.canvas.setPointerCapture(event.pointerId)
    } else if (lookPointer === null) {
      lookPointer = event.pointerId
      lastLook = { x: event.clientX, y: event.clientY }
      dom.canvas.setPointerCapture(event.pointerId)
    }
    return
  }
  if (event.button === 0) {
    if (!mouseLocked && document.pointerLockElement !== dom.canvas) {
      dom.canvas.requestPointerLock?.()
    } else {
      fire()
    }
  }
})

dom.canvas.addEventListener('pointermove', (event) => {
  if (game.state !== 'playing') return
  if (event.pointerType === 'touch') {
    if (event.pointerId === joystickPointer) {
      const dx = event.clientX - joystickOrigin.x
      const dy = event.clientY - joystickOrigin.y
      const length = Math.hypot(dx, dy)
      const max = 53
      const scale = length > max ? max / length : 1
      const sx = dx * scale
      const sy = dy * scale
      input.joyX = clamp(sx / max, -1, 1)
      input.joyZ = clamp(-sy / max, -1, 1)
      dom.joyKnob.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`
    } else if (event.pointerId === lookPointer) {
      const dx = event.clientX - lastLook.x
      const dy = event.clientY - lastLook.y
      lastLook = { x: event.clientX, y: event.clientY }
      player.yaw -= dx * 0.0042
      player.pitch = clamp(player.pitch - dy * 0.0034, -1.2, 1.1)
    }
  }
})

function endPointer(event) {
  if (event.pointerId === joystickPointer) {
    joystickPointer = null
    input.joyX = 0
    input.joyZ = 0
    dom.joystick.classList.add('hidden')
    dom.joyKnob.style.transform = 'translate(-50%, -50%)'
    document.getElementById('moveHint')?.classList.remove('hidden')
  }
  if (event.pointerId === lookPointer) lookPointer = null
}
dom.canvas.addEventListener('pointerup', endPointer)
dom.canvas.addEventListener('pointercancel', endPointer)

dom.canvas.addEventListener('mousedown', (event) => {
  if (event.button !== 0 || touchMode) return
  if (game.state !== 'playing') return
  if (document.pointerLockElement !== dom.canvas) {
    dom.canvas.requestPointerLock?.()
    return
  }
  fire()
})

document.addEventListener('mousemove', (event) => {
  if (game.state !== 'playing' || document.pointerLockElement !== dom.canvas) return
  player.yaw -= event.movementX * 0.0022
  player.pitch = clamp(player.pitch - event.movementY * 0.0021, -1.2, 1.1)
  player.looked = true
})

document.addEventListener('pointerlockchange', () => {
  mouseLocked = document.pointerLockElement === dom.canvas
  if (mouseLocked && game.state === 'playing') showToast('MOUSE CAPTURED · ESC TO RELEASE')
})

dom.canvas.addEventListener('contextmenu', (event) => event.preventDefault())

dom.start.addEventListener('click', startGame)
dom.pauseBtn.addEventListener('click', pauseGame)
dom.resume.addEventListener('click', resumeGame)
dom.restart.addEventListener('click', () => window.location.reload())
dom.pauseRestart.addEventListener('click', () => window.location.reload())
dom.winRestart.addEventListener('click', () => window.location.reload())
dom.noteClose.addEventListener('click', closeNote)
dom.interactBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  if (game.state === 'playing') interact()
})
dom.fireBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  if (game.state === 'playing') fire()
})
dom.lightBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  if (game.state === 'playing') toggleFlashlight()
})
dom.runBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  input.run = true
  dom.runBtn.classList.add('pressed')
})
const releaseRun = () => {
  input.run = false
  dom.runBtn.classList.remove('pressed')
}
dom.runBtn.addEventListener('pointerup', releaseRun)
dom.runBtn.addEventListener('pointercancel', releaseRun)
dom.runBtn.addEventListener('pointerleave', releaseRun)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.fov = window.innerWidth < window.innerHeight ? 80 : 72
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileGPU ? 1.55 : 2))
})

// ---------------------------------------------------------------- movement
function blockedAt(x, z, radius = 0.27) {
  for (const c of world.colliders) {
    if (!c.enabled) continue
    if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) return true
  }
  return false
}

function tryMove(dx, dz) {
  if (!blockedAt(player.pos.x + dx, player.pos.z)) player.pos.x += dx
  if (!blockedAt(player.pos.x, player.pos.z + dz)) player.pos.z += dz
}

function toggleFlashlight() {
  flashlightOn = !flashlightOn
  dom.lightBtn.classList.toggle('active', flashlightOn)
  audio.click()
}

function updatePlayer(dt) {
  const forwardInput = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + input.joyZ
  const strafeInput = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + input.joyX
  const magnitude = Math.min(1, Math.hypot(forwardInput, strafeInput))
  player.moving = magnitude > 0.08
  if (player.moving) game.hasMoved = true

  const wantSprint = (keys.ShiftLeft || keys.ShiftRight || input.run) && player.stamina > 1 && player.moving
  player.sprinting = wantSprint
  if (wantSprint) player.stamina = Math.max(0, player.stamina - dt * 24)
  else player.stamina = Math.min(100, player.stamina + dt * 16)

  const speed = wantSprint ? 4.15 : 2.45
  const forward = tempVec.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw))
  const right = tempVec2.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw))
  let dx = 0
  let dz = 0
  if (player.moving) {
    const norm = Math.max(1, Math.hypot(forwardInput, strafeInput))
    dx = (right.x * strafeInput + forward.x * forwardInput) / norm * speed * dt
    dz = (right.z * strafeInput + forward.z * forwardInput) / norm * speed * dt
    tryMove(dx, dz)
  }

  const actualSpeed = player.moving ? speed * magnitude : 0
  player.bobTime += dt * (wantSprint ? 11.5 : 7.2) * magnitude
  const bobTarget = player.moving ? Math.sin(player.bobTime) * (wantSprint ? 0.042 : 0.024) : 0
  player.bob = damp(player.bob, bobTarget, 14, dt)
  player.stepAccum += actualSpeed * dt
  const stepLength = wantSprint ? 0.68 : 0.78
  if (player.stepAccum > stepLength && player.moving) {
    player.stepAccum = 0
    audio.step(player.pos.z < -6.1)
  }

  const targetY = floorAt(player.pos.z) + 1.62 + player.bob
  player.camY = damp(player.camY, targetY, 13, dt)
  player.shake = Math.max(0, player.shake - dt * 2.3)
  player.hurtPulse = Math.max(0, player.hurtPulse - dt)
  const shakeX = (Math.random() - 0.5) * player.shake * 0.02
  const shakeY = (Math.random() - 0.5) * player.shake * 0.02
  camera.position.set(player.pos.x + shakeX, player.camY + shakeY, player.pos.z)
  camera.rotation.set(player.pitch + shakeY * 0.25, player.yaw + shakeX * 0.25, Math.sin(player.bobTime * 0.5) * 0.002 * magnitude)
  player.pos.y = floorAt(player.pos.z)
  updateVitals()
}

// ---------------------------------------------------------------- game state
function startGame() {
  if (game.state !== 'title') return
  audio.init()
  audio.click()
  game.state = 'playing'
  game.startTime = performance.now()
  dom.title.classList.add('hidden')
  dom.hud.classList.remove('hidden')
  dom.loading.classList.add('hidden')
  torchModel.visible = false
  player.pos.set(0, 0, 7.45)
  player.yaw = 0
  player.pitch = -0.045
  player.health = 100
  player.stamina = 100
  updateVitals()
  setObjective('FIND A WAY OUT', 'The front door is nailed shut. Search the house.')
  renderInventory()
  updateAmmo()
  showCaption('The road was gone. The door was already open.', 'OCTOBER 14 · 3:12 AM', 6200)
  setTimeout(() => {
    if (game.state === 'playing' && !game.hasMoved) {
      showToast(touchMode ? 'LOOK AROUND · WALK FORWARD' : 'CLICK TO CAPTURE MOUSE · WASD TO MOVE')
    }
  }, 3800)
}

function pauseGame() {
  if (game.state !== 'playing') return
  game.pausedFrom = game.state
  game.state = 'paused'
  dom.pause.classList.remove('hidden')
  dom.hud.classList.add('hidden')
  resetTouch()
  if (document.pointerLockElement) document.exitPointerLock?.()
  audio.setMuted(true)
}

function resumeGame() {
  if (game.state !== 'paused') return
  game.state = 'playing'
  dom.pause.classList.add('hidden')
  dom.hud.classList.remove('hidden')
  audio.setMuted(false)
}

function openNote(kicker, title, body) {
  if (game.state !== 'playing') return
  game.state = 'note'
  game.notesRead++
  dom.noteKicker.textContent = kicker
  dom.noteTitle.textContent = title
  dom.noteBody.textContent = body
  dom.note.classList.remove('hidden')
  dom.hud.classList.add('hidden')
  resetTouch()
  if (document.pointerLockElement) document.exitPointerLock?.()
  audio.click()
}

function closeNote() {
  if (game.state !== 'note') return
  game.state = 'playing'
  dom.note.classList.add('hidden')
  dom.hud.classList.remove('hidden')
  audio.click()
}

function die(tip = 'You can stagger it with the handgun.') {
  if (game.state === 'dead' || game.state === 'won') return
  game.state = 'dead'
  dom.hud.classList.add('hidden')
  dom.death.classList.add('hidden')
  dom.deathTip.textContent = tip
  audio.death()
  resetTouch()
  if (document.pointerLockElement) document.exitPointerLock?.()
  setTimeout(() => {
    if (game.state === 'dead') dom.death.classList.remove('hidden')
  }, 950)
}

function win() {
  if (game.state === 'won') return
  game.state = 'won'
  game.elapsed = (performance.now() - game.startTime) / 1000
  dom.hud.classList.add('hidden')
  audio.victory()
  resetTouch()
  if (document.pointerLockElement) document.exitPointerLock?.()
  dom.white.classList.add('on')
  const minutes = Math.floor(game.elapsed / 60).toString().padStart(2, '0')
  const seconds = Math.floor(game.elapsed % 60).toString().padStart(2, '0')
  dom.winStats.textContent = `TIME ${minutes}:${seconds} · SHOTS FIRED ${game.shots} · NOTES READ ${game.notesRead}`
  setTimeout(() => {
    if (game.state === 'won') dom.win.classList.remove('hidden')
  }, 1500)
}

// ---------------------------------------------------------------- title camera
let titleTime = 0
function updateTitle(dt) {
  titleTime += dt
  camera.position.set(Math.sin(titleTime * 0.12) * 0.11, 1.63 + Math.sin(titleTime * 0.35) * 0.008, 7.36 + Math.sin(titleTime * 0.09) * 0.05)
  camera.rotation.set(-0.055 + Math.sin(titleTime * 0.19) * 0.009, 0.035 + Math.sin(titleTime * 0.1) * 0.018, Math.sin(titleTime * 0.07) * 0.003)
}

// ---------------------------------------------------------------- interactions
let currentInteractable = null
let lastPrompt = ''
let fireCooldown = 0
let enemyStepTimer = 0

function setupInteractions() {
  for (const item of world.interactables) {
    if (item.id === 'noteFoyer') {
      item.action = () => openNote(
        'A NOTE, LEFT BEHIND',
        'If you read this',
        'The generator is dead. Two ceramic fuses are missing — one in the study, one in the kitchen. Put them in the breaker box in the hall. Do not go down there. It knows when the lights come on.',
      )
    }
    if (item.id === 'noteCellar') {
      item.action = () => openNote(
        'TORN FROM A LEDGER',
        'The Tenant',
        'It wore my husband\'s coat for a week before I noticed. The iron key opens the front door. Don\'t look at its face. Don\'t let it hear you run.',
      )
    }
    if (item.id === 'fuseKitchen' || item.id === 'fuseStudy') {
      item.action = () => takeFuse(item)
    }
    if (item.id === 'gun') item.action = takeGun
    if (item.id === 'ammo') item.action = takeAmmo
    if (item.id === 'painkillers') item.action = takePainkillers
    if (item.id === 'breaker') item.action = useBreaker
    if (item.id === 'cellarDoor') item.action = useCellarDoor
    if (item.id === 'frontDoor') item.action = useFrontDoor
    if (item.id === 'ironKey') item.action = takeKey
  }
}

function takeFuse(item) {
  if (!item.enabled) return
  item.enabled = false
  item.object.visible = false
  game.fuses++
  audio.pickup()
  renderInventory()
  showToast(`CERAMIC FUSE · ${game.fuses} / 2`)
  if (game.fuses >= 2) {
    setObjective('RESTORE THE POWER', 'Both fuses found. The breaker is in the central hall.')
    showCaption('Two fuses. The breaker is in the hall.', 'RESTORE THE POWER', 4200)
  } else {
    setObjective('SEARCH THE HOUSE', `Ceramic fuses found: ${game.fuses} / 2. The breaker is in the hall.`)
    showCaption('One fuse. There is another nearby.', '', 3000)
  }
}

function takeGun() {
  const item = world.interactables.find((entry) => entry.id === 'gun')
  if (!item || !item.enabled) return
  item.enabled = false
  item.object.visible = false
  game.hasGun = true
  game.ammo = 6
  game.reserve = 0
  weapon.visible = true
  audio.pickup()
  renderInventory()
  updateAmmo()
  showToast('HANDGUN · 6 ROUNDS')
  showCaption('A service pistol. Six in the magazine.', 'IT WILL ONLY BUY YOU TIME', 4600)
}

function takeAmmo() {
  const item = world.interactables.find((entry) => entry.id === 'ammo')
  if (!item || !item.enabled) return
  item.enabled = false
  item.object.visible = false
  game.reserve += 6
  audio.pickup()
  updateAmmo()
  showToast('9MM AMMUNITION · +6')
}

function takePainkillers() {
  const item = world.interactables.find((entry) => entry.id === 'painkillers')
  if (!item || !item.enabled) return
  item.enabled = false
  item.object.visible = false
  player.health = Math.min(100, player.health + 45)
  updateVitals()
  audio.pickup()
  showToast('PAINKILLERS · HEALTH RESTORED')
}

function takeKey() {
  const item = world.interactables.find((entry) => entry.id === 'ironKey')
  if (!item || !item.enabled) return
  item.enabled = false
  item.object.visible = false
  game.hasKey = true
  audio.pickup()
  renderInventory()
  setObjective('GET OUT', 'The iron key fits the front door. Run.')
  showCaption('The iron key. It is warm.', 'GET BACK TO THE FRONT DOOR', 4200)
  player.shake = Math.max(player.shake, 0.3)
}

function useBreaker() {
  if (game.powered) {
    audio.deny()
    showToast('BREAKER ONLINE')
    return
  }
  if (game.fuses < 2) {
    audio.deny()
    showCaption('Two empty sockets. The fuses are in the study and the kitchen.', '', 3400)
    setObjective('FIND TWO CERAMIC FUSES', `Fuses found: ${game.fuses} / 2. The breaker is in the hall.`)
    return
  }
  powerOn()
}

function powerOn() {
  if (game.powered) return
  game.powered = true
  game.fuses = 0
  audio.power()
  player.shake = 0.6
  renderInventory()
  world.pickups.breakerLed.color.setHex(0x1e6b35)
  world.pickups.breakerLed.emissive.setHex(0x39c55f)
  world.doorRefs.cellar.ledMaterial.color.setHex(0x1e6b35)
  world.doorRefs.cellar.ledMaterial.emissive.setHex(0x39c55f)
  setObjective('GO DOWN TO THE CELLAR', 'The iron key is in the root cellar. Get back to the front door.')
  showCaption('The house wakes up.', 'FIND THE IRON KEY · LEAVE', 4600)
  game.powerTimer = 2.1
}

function useCellarDoor() {
  const door = world.doorRefs.cellar
  if (game.doorOpen) return
  if (!game.powered) {
    audio.deny()
    showCaption('The magnetic lock is dead. The breaker needs two fuses.', '', 3600)
    return
  }
  game.doorOpen = true
  door.target = 1.95
  door.collider.enabled = false
  door.item.enabled = false
  audio.door()
  showToast('CELLAR DOOR OPEN')
  setObjective('DESCEND', 'The key is below. Do not stop moving.')
  showCaption('The stairs go down farther than they should.', '', 3400)
}

function useFrontDoor() {
  const door = world.doorRefs.front
  if (game.hasKey) {
    door.target = -1.55
    door.collider.enabled = false
    audio.door()
    setObjective('GET OUT', 'The door is open.')
    setTimeout(() => win(), 700)
    return
  }
  audio.deny()
  showCaption('Nailed shut from the outside. The iron key is in the cellar.', '', 3800)
  setObjective('FIND A WAY OUT', 'The front door needs an iron key. The cellar is below.')
}

function interact() {
  if (game.state !== 'playing' || !currentInteractable) return
  const item = currentInteractable
  if (typeof item.action === 'function') {
    audio.click()
    item.action()
  }
}

function refreshLabels() {
  for (const item of world.interactables) {
    if (item.id === 'breaker') item.label = game.powered ? 'BREAKER ONLINE' : (game.fuses >= 2 ? 'INSERT FUSES' : 'CHECK BREAKER')
    if (item.id === 'cellarDoor') {
      item.label = game.powered ? 'OPEN CELLAR DOOR' : 'TRY CELLAR DOOR'
      if (game.doorOpen) item.enabled = false
    }
    if (item.id === 'frontDoor') item.label = game.hasKey ? 'USE IRON KEY' : 'CHECK DOOR'
  }
}

function findInteractable() {
  const forward = camera.getWorldDirection(tempForward)
  let best = null
  let bestScore = Infinity
  for (const item of world.interactables) {
    if (!item.enabled) continue
    if (!item.object.visible) continue
    item.object.getWorldPosition(tempVec)
    const dist = camera.position.distanceTo(tempVec)
    if (dist > item.range) continue
    const dir = tempVec2.copy(tempVec).sub(camera.position).normalize()
    const dot = forward.dot(dir)
    if (dot < item.dot && dist > 0.95) continue
    const score = dist - dot * 1.15
    if (score >= bestScore) continue
    raycaster.set(camera.position, dir)
    raycaster.far = dist - 0.08
    const hit = raycaster.intersectObjects(world.occluders, false)
    if (hit.length && hit[0].distance < dist - 0.22) continue
    best = item
    bestScore = score
  }
  return best
}

function updateInteraction() {
  refreshLabels()
  const found = findInteractable()
  currentInteractable = found
  const label = found ? (typeof found.label === 'function' ? found.label() : found.label) : ''
  if (label !== lastPrompt) {
    lastPrompt = label
    setPrompt(label)
  }
}

// ---------------------------------------------------------------- navigation
const nav = {
  minX: -8.65,
  maxX: 8.65,
  minZ: -10.65,
  maxZ: 8.65,
  cell: 0.46,
  cols: 0,
  rows: 0,
  blocked: null,
}
nav.cols = Math.floor((nav.maxX - nav.minX) / nav.cell) + 1
nav.rows = Math.floor((nav.maxZ - nav.minZ) / nav.cell) + 1
nav.blocked = new Uint8Array(nav.cols * nav.rows)

function buildNav() {
  const r = 0.36
  for (let row = 0; row < nav.rows; row++) {
    for (let col = 0; col < nav.cols; col++) {
      const x = nav.minX + col * nav.cell
      const z = nav.minZ + row * nav.cell
      let blocked = false
      for (const c of world.colliders) {
        if (!c.enabled || c.dynamic) continue
        if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) {
          blocked = true
          break
        }
      }
      nav.blocked[row * nav.cols + col] = blocked ? 1 : 0
    }
  }
}

function navIndex(x, z) {
  const col = clamp(Math.round((x - nav.minX) / nav.cell), 0, nav.cols - 1)
  const row = clamp(Math.round((z - nav.minZ) / nav.cell), 0, nav.rows - 1)
  return row * nav.cols + col
}

function nearestOpen(index, maxRadius = 7) {
  if (!nav.blocked[index]) return index
  const startCol = index % nav.cols
  const startRow = Math.floor(index / nav.cols)
  for (let r = 1; r <= maxRadius; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue
        const col = startCol + dx
        const row = startRow + dz
        if (col < 0 || row < 0 || col >= nav.cols || row >= nav.rows) continue
        const i = row * nav.cols + col
        if (!nav.blocked[i]) return i
      }
    }
  }
  return -1
}

function findPath(start, goal) {
  const startIndex = nearestOpen(navIndex(start.x, start.z))
  const goalIndex = nearestOpen(navIndex(goal.x, goal.z))
  if (startIndex < 0 || goalIndex < 0) return []
  if (startIndex === goalIndex) return [goal.clone()]
  const total = nav.cols * nav.rows
  const g = new Float32Array(total).fill(Infinity)
  const f = new Float32Array(total).fill(Infinity)
  const came = new Int32Array(total).fill(-1)
  const closed = new Uint8Array(total)
  const open = [startIndex]
  g[startIndex] = 0
  f[startIndex] = 0
  const goalCol = goalIndex % nav.cols
  const goalRow = Math.floor(goalIndex / nav.cols)
  const heuristic = (index) => {
    const col = index % nav.cols
    const row = Math.floor(index / nav.cols)
    const dx = Math.abs(col - goalCol)
    const dz = Math.abs(row - goalRow)
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)
  }
  let iterations = 0
  while (open.length && iterations++ < 9000) {
    let bestIndex = 0
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bestIndex]]) bestIndex = i
    const current = open.splice(bestIndex, 1)[0]
    if (current === goalIndex) {
      const path = []
      let node = current
      while (node !== -1) {
        const col = node % nav.cols
        const row = Math.floor(node / nav.cols)
        path.push(new THREE.Vector3(nav.minX + col * nav.cell, 0, nav.minZ + row * nav.cell))
        node = came[node]
      }
      return path.reverse()
    }
    closed[current] = 1
    const col = current % nav.cols
    const row = Math.floor(current / nav.cols)
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue
        const nc = col + dx
        const nr = row + dz
        if (nc < 0 || nr < 0 || nc >= nav.cols || nr >= nav.rows) continue
        const ni = nr * nav.cols + nc
        if (nav.blocked[ni] || closed[ni]) continue
        if (dx !== 0 && dz !== 0) {
          if (nav.blocked[row * nav.cols + nc] || nav.blocked[nr * nav.cols + col]) continue
        }
        const cost = dx !== 0 && dz !== 0 ? Math.SQRT2 : 1
        const tentative = g[current] + cost
        if (tentative >= g[ni]) continue
        came[ni] = current
        g[ni] = tentative
        f[ni] = tentative + heuristic(ni)
        if (!open.includes(ni)) open.push(ni)
      }
    }
  }
  return []
}

// ---------------------------------------------------------------- enemy
const enemy = {
  active: false,
  hp: 100,
  stunned: 0,
  dead: false,
  deadTimer: 0,
  attackTimer: 0,
  attackCooldown: 0,
  walkPhase: 0,
  path: [],
  pathIndex: 0,
  pathTimer: 0,
  lastSeen: new THREE.Vector3(),
  search: 0,
  patrol: null,
  patrolWait: 0,
  speed: 0,
}

function lineOfSight(from, to) {
  const dir = tempVec.copy(to).sub(from)
  const dist = dir.length()
  if (dist < 0.01) return true
  dir.normalize()
  raycaster.set(from, dir)
  raycaster.far = dist - 0.12
  const hit = raycaster.intersectObjects(world.occluders, false)
  return hit.length === 0
}

function spawnEnemy() {
  if (game.enemySpawned || game.state === 'dead' || game.state === 'won') return
  game.enemySpawned = true
  enemy.active = true
  const group = world.enemy.group
  group.position.set(0, floorAt(8.2), 8.2)
  group.visible = true
  enemy.lastSeen.set(player.pos.x, 0, player.pos.z)
  enemy.search = 9
  enemy.pathTimer = 0
  player.shake = 0.8
  audio.stinger()
  showCaption('IT HEARD YOU.', 'RUN.', 3800)
  showToast('THE TENANT IS AWAKE')
  dom.hurt.classList.remove('hit')
  void dom.hurt.offsetWidth
  dom.hurt.classList.add('hit')
}

function angleLerp(a, b, t) {
  let delta = (b - a + Math.PI) % (Math.PI * 2) - Math.PI
  if (delta < -Math.PI) delta += Math.PI * 2
  return a + delta * t
}

function damagePlayer(amount) {
  if (game.state !== 'playing') return
  player.health = Math.max(0, player.health - amount)
  player.shake = 0.9
  player.hurtPulse = 0.8
  updateVitals()
  audio.playerHit()
  dom.hurt.classList.remove('hit')
  void dom.hurt.offsetWidth
  dom.hurt.classList.add('hit')
  if (player.health <= 0) {
    die(player.health <= 0 && game.enemyDead ? 'The house is quiet now. Almost.' : 'Break line of sight. You can stagger it with the handgun.')
  }
}

function hitEnemy(damage) {
  if (!enemy.active || enemy.dead) return
  enemy.hp -= damage
  enemy.stunned = 0.9
  enemy.lastSeen.set(player.pos.x, 0, player.pos.z)
  enemy.search = 9
  audio.enemyHit()
  dom.reticle.classList.add('hit')
  setTimeout(() => dom.reticle.classList.remove('hit'), 150)
  if (enemy.hp <= 0) {
    enemy.dead = true
    game.enemyDead = true
    enemy.deadTimer = 0
    enemy.stunned = 0
    showCaption('It is down. Not dead. Do not wait.', '', 3800)
    showToast('THE TENANT IS DOWN')
    audio.stinger()
  }
}

function updateEnemy(dt) {
  if (!enemy.active) return
  const group = world.enemy.group
  const parts = world.enemy.parts
  const time = performance.now() * 0.001

  if (enemy.dead) {
    enemy.deadTimer += dt
    group.rotation.z = damp(group.rotation.z, 1.35, 3, dt)
    group.position.y = damp(group.position.y, floorAt(group.position.z) - 0.5, 2.5, dt)
    parts.lanternLight.intensity = damp(parts.lanternLight.intensity, 0, 1.5, dt)
    parts.arms[0].rotation.x = damp(parts.arms[0].rotation.x, -0.6, 2, dt)
    parts.arms[1].rotation.x = damp(parts.arms[1].rotation.x, 0.4, 2, dt)
    parts.head.rotation.z = damp(parts.head.rotation.z, 0.7, 1.5, dt)
    return
  }

  if (enemy.stunned > 0) {
    enemy.stunned -= dt
    group.rotation.z = Math.sin(time * 28) * 0.07
    parts.head.rotation.z = Math.sin(time * 19) * 0.1
    parts.arms[1].rotation.x = damp(parts.arms[1].rotation.x, -0.3, 8, dt)
    parts.lanternLight.intensity = 2 + Math.sin(time * 20) * 1.2
    return
  }
  group.rotation.z = damp(group.rotation.z, 0, 8, dt)

  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt)
  enemy.attackTimer = Math.max(0, enemy.attackTimer - dt)
  const chest = tempVec.set(group.position.x, group.position.y + 1.45, group.position.z)
  const playerChest = tempVec2.set(player.pos.x, player.camY - 0.12, player.pos.z)
  const distance = chest.distanceTo(playerChest)
  const los = lineOfSight(chest, playerChest)
  if (los) {
    enemy.lastSeen.set(player.pos.x, 0, player.pos.z)
    enemy.search = 7
  } else {
    enemy.search = Math.max(0, enemy.search - dt)
  }

  if (distance < 1.55 && los && enemy.attackCooldown <= 0) {
    enemy.attackCooldown = 1.25
    enemy.attackTimer = 0.42
    damagePlayer(34)
    parts.arms[1].rotation.x = -1.45
    parts.arms[1].rotation.z = -0.2
  }

  let target
  if (los && distance < 14) target = player.pos
  else if (enemy.search > 0) target = enemy.lastSeen
  else {
    if (!enemy.patrol) {
      const patrols = [
        new THREE.Vector3(-5.0, 0, 5.8),
        new THREE.Vector3(5.8, 0, 3.5),
        new THREE.Vector3(5.6, 0, -3.8),
        new THREE.Vector3(-5.6, 0, -2.3),
        new THREE.Vector3(0, 0, 2.8),
        new THREE.Vector3(0, 0, -8.3),
      ]
      enemy.patrol = patrols[Math.floor(Math.random() * patrols.length)]
    }
    target = enemy.patrol
  }

  enemy.pathTimer -= dt
  if (enemy.pathTimer <= 0 || enemy.path.length === 0) {
    enemy.pathTimer = 0.55
    enemy.path = findPath(group.position, target)
    enemy.pathIndex = 0
  }

  let moveX = 0
  let moveZ = 0
  const direct = distance < 3.8 && los
  if (direct) {
    moveX = player.pos.x - group.position.x
    moveZ = player.pos.z - group.position.z
  } else {
    while (enemy.pathIndex < enemy.path.length) {
      const node = enemy.path[enemy.pathIndex]
      const dx = node.x - group.position.x
      const dz = node.z - group.position.z
      if (Math.hypot(dx, dz) < 0.34) {
        enemy.pathIndex++
        continue
      }
      moveX = dx
      moveZ = dz
      break
    }
  }

  const moveLength = Math.hypot(moveX, moveZ)
  if (moveLength > 0.04) {
    moveX /= moveLength
    moveZ /= moveLength
    const speed = los ? 2.28 : 1.75
    enemy.speed = speed
    group.position.x += moveX * speed * dt
    group.position.z += moveZ * speed * dt
    const targetAngle = Math.atan2(-moveX, -moveZ)
    group.rotation.y = angleLerp(group.rotation.y, targetAngle, 1 - Math.exp(-7 * dt))
    enemy.walkPhase += dt * speed * 3.5
    const swing = Math.sin(enemy.walkPhase) * 0.66
    parts.legs[0].rotation.x = swing
    parts.legs[1].rotation.x = -swing
    parts.arms[0].rotation.x = -swing * 0.45
    parts.arms[1].rotation.x = swing * 0.72
    parts.arms[1].rotation.z = Math.sin(enemy.walkPhase * 0.5) * 0.04
    parts.head.rotation.z = Math.sin(enemy.walkPhase * 0.35) * 0.08
    group.position.y = floorAt(group.position.z) + Math.abs(Math.sin(enemy.walkPhase)) * 0.025
    enemyStepTimer -= dt
    if (distance < 9 && enemyStepTimer <= 0) {
      audio.step(true)
      enemyStepTimer = 0.55
    }
  } else {
    enemy.speed = 0
    parts.legs[0].rotation.x = damp(parts.legs[0].rotation.x, 0, 7, dt)
    parts.legs[1].rotation.x = damp(parts.legs[1].rotation.x, 0, 7, dt)
    parts.arms[0].rotation.x = damp(parts.arms[0].rotation.x, 0.1, 3, dt)
    parts.arms[1].rotation.x = damp(parts.arms[1].rotation.x, 0, 3, dt)
    group.position.y = damp(group.position.y, floorAt(group.position.z), 7, dt)
    if (!los && enemy.search <= 0) {
      enemy.patrolWait -= dt
      if (enemy.patrolWait <= 0) {
        enemy.patrol = null
        enemy.patrolWait = 2.5
      }
    }
  }

  parts.lanternLight.intensity = 2.8 + Math.sin(time * 11 + 0.5) * 0.35 + Math.random() * 0.16
  const danger = clamp((14 - distance) / 14, 0, 1) * (los ? 1 : 0.55)
  game.danger = Math.max(game.danger, danger)
}

// ---------------------------------------------------------------- gunplay
function fire() {
  if (game.state !== 'playing' || !game.hasGun || game.reloading > 0 || fireCooldown > 0) return
  if (game.ammo <= 0) {
    if (game.reserve > 0) {
      reload()
    } else {
      audio.empty()
      showToast('EMPTY')
    }
    return
  }
  game.ammo--
  game.shots++
  fireCooldown = 0.3
  weaponRecoil = 1
  weaponFlash = 0.065
  muzzleLight.intensity = 18
  audio.gunshot()
  player.shake = Math.max(player.shake, 0.32)
  player.pitch = clamp(player.pitch + 0.027, -1.2, 1.1)
  updateAmmo()

  if (enemy.active && !enemy.dead) {
    const chest = tempVec.set(world.enemy.group.position.x, world.enemy.group.position.y + 1.35, world.enemy.group.position.z)
    const toEnemy = tempVec2.copy(chest).sub(camera.position)
    const dist = toEnemy.length()
    const forward = camera.getWorldDirection(tempForward)
    const angle = forward.angleTo(toEnemy.normalize())
    if (dist < 22 && angle < 0.13) {
      const dir = tempVec.copy(chest).sub(camera.position).normalize()
      raycaster.set(camera.position, dir)
      raycaster.far = dist - 0.1
      const wallHit = raycaster.intersectObjects(world.occluders, false)
      if (!wallHit.length) hitEnemy(34)
    }
  }
}

function reload() {
  if (game.state !== 'playing' || !game.hasGun || game.reloading > 0) return
  if (game.ammo >= 6 || game.reserve <= 0) {
    if (game.reserve <= 0) showToast('NO SPARE ROUNDS')
    return
  }
  game.reloading = 1.55
  audio.reload()
  updateAmmo()
}

function updateWeapon(dt) {
  fireCooldown = Math.max(0, fireCooldown - dt)
  if (game.reloading > 0) {
    game.reloading -= dt
    if (game.reloading <= 0) {
      game.reloading = 0
      const loaded = Math.min(6 - game.ammo, game.reserve)
      game.ammo += loaded
      game.reserve -= loaded
      updateAmmo()
    }
  }
  weaponFlash = Math.max(0, weaponFlash - dt)
  muzzleLight.intensity = weaponFlash > 0 ? 18 : 0
  muzzleSprite.material.opacity = weaponFlash > 0 ? 0.95 : 0
  weaponRecoil = Math.max(0, weaponRecoil - dt * 6)
  const bob = Math.sin(player.bobTime) * (player.moving ? 0.006 : 0.0018)
  weapon.position.set(weaponX, weaponY + bob + weaponRecoil * 0.035, -0.58 + weaponRecoil * 0.07)
  weapon.rotation.set(0.055 + weaponRecoil * 0.22, 0.06 + Math.sin(player.bobTime * 0.5) * 0.004, weaponRecoil * 0.025)
  torchModel.position.set(-0.31, -0.37 + bob * 0.7, -0.68)
  torchModel.rotation.z = -0.05 + Math.sin(player.bobTime) * 0.006 * (player.moving ? 1 : 0.2)
}

// ---------------------------------------------------------------- world animation
function updateDoors(dt) {
  for (const key of ['front', 'cellar']) {
    const door = world.doorRefs[key]
    if (!door) continue
    door.angle = damp(door.angle, door.target, 4, dt)
    door.pivot.rotation.y = door.angle
  }
}

function updateLights(dt) {
  const time = performance.now() * 0.001
  game.powerLevel = damp(game.powerLevel, game.powered ? 1 : 0, 1.2, dt)
  for (const lamp of world.lamps) {
    const power = lamp.powered ? game.powerLevel : 1
    let flicker = 1 + Math.sin(time * lamp.speed * 1.7 + lamp.phase) * lamp.flicker * 0.3
    flicker += (Math.random() - 0.5) * lamp.flicker * 0.22
    if (lamp.powered && game.powerLevel < 0.98 && Math.random() > 0.16) flicker *= 0.14
    if (game.danger > 0.55 && lamp.powered) flicker *= 0.85 + Math.sin(time * 23 + lamp.phase) * 0.12
    lamp.light.intensity = lamp.base * power * flicker
    if (lamp.bulbMaterial) {
      lamp.bulbMaterial.emissiveIntensity = lamp.powered ? game.powerLevel * 2.3 * flicker : 2.3 * flicker
    }
  }
  world.materials.fluorescent.emissiveIntensity = game.powerLevel * (1.9 + Math.sin(time * 7.2) * 0.22)
  const flick = flashlightOn ? (game.danger > 0.72 && Math.random() > 0.9 ? 0.22 : 1) : 0
  flashlight.intensity = 52 * flick
  flashlightFill.intensity = 0.16 * (flashlightOn ? 1 : 0)
}

function updateLightning(dt) {
  game.lightningTimer -= dt
  if (game.lightningTimer <= 0) {
    game.lightningTimer = 13 + Math.random() * 16
    game.flashPower = 1
    game.flashTick = 0
    if (audio.ctx) {
      setTimeout(() => {
        audio.noiseBurst(2.6, 260, 0.11, 'lowpass')
        audio.pulse(2.8, 31, 0.08, 'sawtooth')
      }, 500)
    }
  }
  if (game.flashPower > 0) {
    game.flashTick += dt
    game.flashPower = Math.max(0, game.flashPower - dt * 5.5)
    const strobe = game.flashTick < 0.34 ? (Math.sin(game.flashTick * 75) > -0.2 ? 1 : 0.2) : 0.35
    const value = game.flashPower * strobe
    world.lightning.intensity = value * 5
    world.windowMaterial.emissiveIntensity = 0.36 + value * 2.7
    dom.lightning.style.opacity = String(value * 0.36)
  } else {
    world.lightning.intensity = 0
    world.windowMaterial.emissiveIntensity = 0.36
    dom.lightning.style.opacity = '0'
  }
}

function updateDust(dt) {
  const positions = world.dust.geometry.attributes.position.array
  const time = performance.now() * 0.001
  for (let i = 0; i < positions.length / 3; i++) {
    const index = i * 3
    positions[index] += Math.sin(time * 0.35 + i) * dt * 0.004
    positions[index + 1] -= dt * 0.014 * (0.4 + (i % 5) * 0.13)
    if (positions[index + 1] < (positions[index + 2] < -6 ? -1.75 : 0.05)) {
      positions[index + 1] = positions[index + 2] < -6 ? 1.1 : 3.1
    }
  }
  world.dust.geometry.attributes.position.needsUpdate = true
}

function updateCameraDead() {
  player.deadTilt = damp(player.deadTilt, 1.15, 2, 1 / 60)
  camera.rotation.z = player.deadTilt
  camera.position.y = damp(camera.position.y, floorAt(player.pos.z) + 0.48, 2.5, 1 / 60)
}

// ---------------------------------------------------------------- loop
let lastDanger = 0
function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const state = game.state

  if (state === 'title') {
    updateTitle(dt)
    updateLights(dt)
    updateLightning(dt)
    updateDust(dt)
    updateDoors(dt)
  } else if (state === 'playing') {
    game.danger = 0
    updatePlayer(dt)
    updateInteraction()
    updateEnemy(dt)
    updateWeapon(dt)
    updateDoors(dt)
    updateLights(dt)
    updateLightning(dt)
    updateDust(dt)
    if (game.powerTimer > 0) {
      game.powerTimer -= dt
      if (game.powerTimer <= 0) spawnEnemy()
    }
    audio.update(dt, game.danger)
  } else {
    if (state === 'dead') updateCameraDead()
    updateLights(dt)
    updateLightning(dt)
    updateDust(dt)
    updateDoors(dt)
    updateWeapon(dt)
    audio.update(dt, 0)
  }

  lastDanger = game.danger
  renderer.render(scene, camera)
}

// ---------------------------------------------------------------- boot
setupInteractions()
buildNav()
updateVitals()
renderInventory()
updateAmmo()
camera.position.set(0, 1.63, 7.36)
camera.rotation.set(-0.055, 0.035, 0)

setTimeout(() => {
  dom.loading.classList.add('hidden')
  dom.title.classList.remove('hidden')
}, 550)

window.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') pauseGame()
})

window.__BLACKWATER__ = {
  game,
  player,
  world,
  enemy,
  scene,
  camera,
  renderer,
  startGame,
  powerOn,
  spawnEnemy,
  fire,
  interact,
  nav,
  findPath,
  teleport(x, z, yaw = player.yaw) {
    player.pos.x = x
    player.pos.z = z
    player.pos.y = floorAt(z)
    player.yaw = yaw
    player.camY = floorAt(z) + 1.62
  },
  giveAll() {
    game.fuses = 2
    renderInventory()
    weapon.visible = true
    game.hasGun = true
    game.ammo = 6
    game.reserve = 6
    updateAmmo()
  },
}

animate()

