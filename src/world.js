import * as THREE from 'three'
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js'
import * as TX from './textures.js'

const lerp = (a, b, t) => a + (b - a) * t

export function floorAt(z) {
  if (z >= -6.15) return 0
  if (z <= -8.1) return -1.8
  return -1.8 * ((-6.15 - z) / 1.95)
}

export function createWorld(scene) {
  const colliders = []
  const occluders = []
  const interactables = []
  const lamps = []
  const textures = {}
  const materials = {}
  const pickups = {}
  const doorRefs = {}

  const rand = (() => {
    let s = 1234567
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    }
  })()

  // ---------------------------------------------------------------- textures
  textures.floor = TX.woodFloorTexture()
  textures.wallLiving = TX.wallpaperTexture('#3f4537', '#59614c')
  textures.wallDining = TX.wallpaperTexture('#463a32', '#695044')
  textures.wallStudy = TX.wallpaperTexture('#494736', '#626047')
  textures.plaster = TX.plasterTexture()
  textures.concrete = TX.concreteTexture()
  textures.wood = TX.woodTexture('#3a2618')
  textures.woodLight = TX.woodTexture('#5b422d')
  textures.ceiling = TX.ceilingTexture()
  textures.tile = TX.tileTexture()
  textures.rug = TX.rugTexture()
  textures.portrait = TX.portraitTexture()
  textures.window = TX.windowTexture()
  textures.note = TX.noteTexture()
  textures.blood = TX.bloodTexture()
  textures.mask = TX.maskTexture()
  textures.glow = TX.glowTexture()
  textures.paper = TX.paperTexture()

  const cloneTex = (texture, x, y) => {
    const t = texture.clone()
    t.needsUpdate = true
    t.repeat.set(x, y)
    return t
  }
  const standard = (options) => new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.03, ...options })

  materials.floorHall = standard({ map: cloneTex(textures.floor, 2.2, 8), roughness: 0.92 })
  materials.floorLiving = standard({ map: cloneTex(textures.floor, 3.5, 4), roughness: 0.92 })
  materials.floorDining = standard({ map: cloneTex(textures.floor, 3.5, 4), roughness: 0.92 })
  materials.floorStudy = standard({ map: cloneTex(textures.floor, 3.5, 3.5), roughness: 0.92 })
  materials.floorKitchen = standard({ map: cloneTex(textures.tile, 4, 4), roughness: 0.86 })
  materials.floorCellar = standard({ map: cloneTex(textures.concrete, 4, 3), roughness: 0.97 })
  materials.wallLiving = standard({ map: cloneTex(textures.wallLiving, 3.2, 1.35), roughness: 0.94 })
  materials.wallDining = standard({ map: cloneTex(textures.wallDining, 3.2, 1.35), roughness: 0.94 })
  materials.wallStudy = standard({ map: cloneTex(textures.wallStudy, 3.2, 1.35), roughness: 0.94 })
  materials.wallPlaster = standard({ map: cloneTex(textures.plaster, 2.5, 1.3), roughness: 0.96 })
  materials.wallKitchen = standard({ map: cloneTex(textures.tile, 3, 1.6), roughness: 0.84 })
  materials.cellarWall = standard({ map: cloneTex(textures.concrete, 4, 1.4), roughness: 0.99 })
  materials.ceiling = standard({ map: cloneTex(textures.ceiling, 6, 5), roughness: 0.98 })
  materials.cellarCeiling = standard({ map: cloneTex(textures.concrete, 3, 2), roughness: 0.99 })
  materials.wood = standard({ map: cloneTex(textures.wood, 1.5, 1.5), roughness: 0.82 })
  materials.woodLight = standard({ map: cloneTex(textures.woodLight, 1.4, 1.4), roughness: 0.8 })
  materials.woodDark = standard({ color: 0x241610, roughness: 0.88 })
  materials.trim = standard({ color: 0x2b2118, roughness: 0.85 })
  materials.metal = standard({ color: 0x333738, metalness: 0.75, roughness: 0.42 })
  materials.metalDark = standard({ color: 0x171b1b, metalness: 0.7, roughness: 0.55 })
  materials.brass = standard({ color: 0x94703d, metalness: 0.8, roughness: 0.34 })
  materials.porcelain = standard({ color: 0xd0c4ac, roughness: 0.62 })
  materials.ceramic = standard({ color: 0xb9a98b, roughness: 0.45 })
  materials.fabricRed = standard({ color: 0x4a2622, roughness: 0.96 })
  materials.fabricDark = standard({ color: 0x252b25, roughness: 0.98 })
  materials.fabricCream = standard({ color: 0x8f856d, roughness: 0.96 })
  materials.mattress = standard({ color: 0x77705f, roughness: 1 })
  materials.black = standard({ color: 0x050606, roughness: 1 })
  materials.ember = new THREE.MeshBasicMaterial({ color: 0xd45a1b })
  materials.paper = standard({ map: textures.note, roughness: 0.95 })
  materials.paperBack = standard({ map: textures.paper, roughness: 0.95 })
  materials.portrait = standard({ map: textures.portrait, roughness: 0.72 })
  materials.window = standard({
    map: textures.window,
    emissive: 0x39556c,
    emissiveMap: textures.window,
    emissiveIntensity: 0.36,
    roughness: 0.35,
    metalness: 0.18,
  })
  materials.blood = new THREE.MeshBasicMaterial({
    map: textures.blood,
    transparent: true,
    depthWrite: false,
    opacity: 0.78,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  materials.plastic = new THREE.MeshStandardMaterial({
    color: 0xbfc1b2,
    transparent: true,
    opacity: 0.18,
    roughness: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  materials.fluorescent = new THREE.MeshStandardMaterial({
    color: 0xcdd8c5,
    emissive: 0xb7d5b2,
    emissiveIntensity: 0,
    roughness: 0.3,
  })
  materials.bulb = new THREE.MeshStandardMaterial({
    color: 0xffe3ae,
    emissive: 0xffc77c,
    emissiveIntensity: 0,
    roughness: 0.2,
  })
  materials.stoveGlow = new THREE.MeshBasicMaterial({ color: 0x87391d })
  materials.lanternGlass = new THREE.MeshStandardMaterial({
    color: 0xffc471,
    emissive: 0xff8c32,
    emissiveIntensity: 2.5,
    transparent: true,
    opacity: 0.7,
  })
  materials.mask = new THREE.MeshStandardMaterial({
    map: textures.mask,
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
    roughness: 0.72,
  })

  // ---------------------------------------------------------------- helpers
  function registerCollider(minX, maxX, minZ, maxZ, options = {}) {
    const collider = { minX, maxX, minZ, maxZ, enabled: true, dynamic: false, ...options }
    colliders.push(collider)
    return collider
  }

  function addBox(w, h, d, material, x, y, z, options = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    if (options.rotY) mesh.rotation.y = options.rotY
    if (options.rotX) mesh.rotation.x = options.rotX
    if (options.rotZ) mesh.rotation.z = options.rotZ
    mesh.castShadow = options.cast !== false
    mesh.receiveShadow = options.receive !== false
    ;(options.parent || scene).add(mesh)
    if (options.collide) {
      const swap = Math.abs(Math.sin(options.rotY || 0)) > 0.7
      const cw = swap ? d : w
      const cd = swap ? w : d
      const collider = registerCollider(x - cw / 2, x + cw / 2, z - cd / 2, z + cd / 2, options.colliderOptions)
      mesh.userData.collider = collider
    }
    return mesh
  }

  function addCylinder(rTop, rBottom, h, segments, material, x, y, z, options = {}) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material)
    mesh.position.set(x, y, z)
    if (options.rotX) mesh.rotation.x = options.rotX
    if (options.rotY) mesh.rotation.y = options.rotY
    if (options.rotZ) mesh.rotation.z = options.rotZ
    mesh.castShadow = options.cast !== false
    mesh.receiveShadow = options.receive !== false
    ;(options.parent || scene).add(mesh)
    if (options.collide) {
      registerCollider(x - Math.max(rTop, rBottom), x + Math.max(rTop, rBottom), z - Math.max(rTop, rBottom), z + Math.max(rTop, rBottom), options.colliderOptions)
    }
    return mesh
  }

  function addPlane(w, h, material, x, y, z, rotY = 0, options = {}) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
    mesh.position.set(x, y, z)
    mesh.rotation.y = rotY
    if (options.rotX) mesh.rotation.x = options.rotX
    if (options.rotZ) mesh.rotation.z = options.rotZ
    mesh.castShadow = false
    mesh.receiveShadow = options.receive !== false
    ;(options.parent || scene).add(mesh)
    return mesh
  }

  function addWall(x1, z1, x2, z2, options = {}) {
    const thickness = options.thickness ?? 0.18
    const height = options.height ?? 3.2
    const base = options.base ?? 0
    const dx = x2 - x1
    const dz = z2 - z1
    const length = Math.hypot(dx, dz) + thickness
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, thickness), options.material || materials.wallPlaster)
    mesh.position.set((x1 + x2) / 2, base + height / 2, (z1 + z2) / 2)
    mesh.rotation.y = -Math.atan2(dz, dx)
    mesh.castShadow = options.cast !== false
    mesh.receiveShadow = options.receive !== false
    scene.add(mesh)
    occluders.push(mesh)
    if (options.collide !== false) {
      if (Math.abs(dx) > Math.abs(dz)) {
        registerCollider(Math.min(x1, x2), Math.max(x1, x2), (z1 + z2) / 2 - thickness / 2, (z1 + z2) / 2 + thickness / 2, options.colliderOptions)
      } else {
        registerCollider((x1 + x2) / 2 - thickness / 2, (x1 + x2) / 2 + thickness / 2, Math.min(z1, z2), Math.max(z1, z2), options.colliderOptions)
      }
    }
    return mesh
  }

  function addFloor(x1, x2, z1, z2, y, material) {
    return addBox(x2 - x1, 0.12, z2 - z1, material, (x1 + x2) / 2, y - 0.06, (z1 + z2) / 2, { cast: false })
  }

  function addCeiling(x1, x2, z1, z2, y, material) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), material)
    mesh.position.set((x1 + x2) / 2, y, (z1 + z2) / 2)
    mesh.rotation.x = Math.PI / 2
    mesh.receiveShadow = true
    scene.add(mesh)
    return mesh
  }

  function addDoorTrim(axis, fixed, a, b, height = 2.3) {
    if (axis === 'x') {
      addBox(0.28, height, 0.13, materials.trim, fixed - 0.04, height / 2, a, { cast: false })
      addBox(0.28, height, 0.13, materials.trim, fixed - 0.04, height / 2, b, { cast: false })
      addBox(0.28, 0.14, b - a, materials.trim, fixed - 0.04, height, (a + b) / 2, { cast: false })
    } else {
      addBox(0.13, height, 0.28, materials.trim, a, height / 2, fixed - 0.04, { cast: false })
      addBox(0.13, height, 0.28, materials.trim, b, height / 2, fixed - 0.04, { cast: false })
      addBox(b - a, 0.14, 0.28, materials.trim, (a + b) / 2, height, fixed - 0.04, { cast: false })
    }
  }

  function addGlow(parent, color = 0xd5a866, scale = 0.34, y = 0) {
    const material = new THREE.SpriteMaterial({
      map: textures.glow,
      color,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(scale, scale, 1)
    sprite.position.y = y
    parent.add(sprite)
    return sprite
  }

  function addInteractable(id, object, label, options = {}) {
    const item = {
      id,
      object,
      label,
      range: options.range ?? 2.55,
      dot: options.dot ?? 0.52,
      enabled: true,
      once: options.once ?? false,
      action: null,
      glow: options.glow || null,
    }
    interactables.push(item)
    return item
  }

  function addPointLight(color, intensity, distance, x, y, z, options = {}) {
    const light = new THREE.PointLight(color, options.powered ? 0 : intensity, distance, 1.5)
    light.position.set(x, y, z)
    if (options.castShadow) {
      light.castShadow = true
      light.shadow.mapSize.set(512, 512)
      light.shadow.bias = -0.002
    }
    scene.add(light)
    if (options.powered) {
      lamps.push({
        light,
        base: intensity,
        powered: true,
        phase: options.phase ?? Math.random() * 10,
        speed: options.speed ?? 1.3,
        flicker: options.flicker ?? 0.08,
        bulbMaterial: options.bulbMaterial || null,
      })
    }
    return light
  }

  // ---------------------------------------------------------------- shell
  addFloor(-2, 2, -6, 9, 0, materials.floorHall)
  addFloor(-9, -2, 1, 9, 0, materials.floorLiving)
  addFloor(2, 9, 1, 9, 0, materials.floorDining)
  addFloor(-9, -2, -6, 1, 0, materials.floorStudy)
  addFloor(2, 9, -6, 1, 0, materials.floorKitchen)
  addFloor(-4, 4, -11, -6, -1.8, materials.floorCellar)
  addCeiling(-9, 9, -6, 9, 3.2, materials.ceiling)
  addCeiling(-4, 4, -11, -8.3, 1.35, materials.cellarCeiling)

  addWall(-9, -6, -9, 9, { material: materials.wallPlaster })
  addWall(9, -6, 9, 9, { material: materials.wallPlaster })
  addWall(-9, 9, -1.05, 9, { material: materials.wallPlaster })
  addWall(1.05, 9, 9, 9, { material: materials.wallPlaster })
  addWall(-9, -6, -1.05, -6, { material: materials.wallPlaster })
  addWall(1.05, -6, 9, -6, { material: materials.wallPlaster })

  // Central hall partitions
  addWall(-2, 1, -2, 3.2, { material: materials.wallLiving })
  addWall(-2, 5.8, -2, 6.7, { material: materials.wallLiving })
  addWall(-2, 8.4, -2, 9, { material: materials.wallLiving })
  addWall(2, 1, 2, 3.0, { material: materials.wallDining })
  addWall(2, 5.6, 2, 6.8, { material: materials.wallDining })
  addWall(2, 8.3, 2, 9, { material: materials.wallDining })
  addWall(-2, -6, -2, -4.8, { material: materials.wallStudy })
  addWall(-2, -2.8, -2, 1, { material: materials.wallStudy })
  addWall(2, -6, 2, -4.5, { material: materials.wallKitchen })
  addWall(2, -2.5, 2, 1, { material: materials.wallKitchen })

  // Cross walls
  addWall(-9, 1, -7.6, 1, { material: materials.wallStudy })
  addWall(-5.6, 1, -2, 1, { material: materials.wallStudy })
  addWall(2, 1, 5.4, 1, { material: materials.wallKitchen })
  addWall(7.4, 1, 9, 1, { material: materials.wallKitchen })

  addDoorTrim('x', -2, 3.2, 5.8)
  addDoorTrim('x', -2, 6.7, 8.4)
  addDoorTrim('x', -2, -4.8, -2.8)
  addDoorTrim('x', 2, 3.0, 5.6)
  addDoorTrim('x', 2, 6.8, 8.3)
  addDoorTrim('x', 2, -4.5, -2.5)
  addDoorTrim('z', 1, -7.6, -5.6)
  addDoorTrim('z', 1, 5.4, 7.4)

  // Cellar walls and stair shaft
  addWall(-4, -11, -4, -6, { material: materials.cellarWall, base: -1.8, height: 3.15 })
  addWall(4, -11, 4, -6, { material: materials.cellarWall, base: -1.8, height: 3.15 })
  addWall(-4, -11, 4, -11, { material: materials.cellarWall, base: -1.8, height: 3.15 })
  addBox(0.18, 5, 2.25, materials.cellarWall, -1.12, 0.7, -7.22, { collide: true })
  addBox(0.18, 5, 2.25, materials.cellarWall, 1.12, 0.7, -7.22, { collide: true })
  occluders.push(...scene.children.slice(-2))

  // Stairs
  for (let i = 0; i < 9; i++) {
    const top = -0.08 - i * 0.21
    addBox(2.02, 0.16, 0.28, materials.woodDark, 0, top - 0.08, -6.24 - i * 0.235, { cast: false })
  }
  addBox(0.05, 1.02, 2.1, materials.metalDark, -1.0, 0.12, -7.2, { rotX: 0.72, cast: false })
  addBox(0.05, 1.02, 2.1, materials.metalDark, 1.0, 0.12, -7.2, { rotX: 0.72, cast: false })

  // ---------------------------------------------------------------- windows & doors
  materials.rug = standard({ map: cloneTex(textures.rug, 1, 1), roughness: 1 })
  materials.runner = standard({ map: cloneTex(textures.rug, 1, 2.7), color: 0x8b7664, roughness: 1 })

  function addWindow(x, z, rotY, width = 1.45, height = 1.65) {
    const group = new THREE.Group()
    group.position.set(x, 1.72, z)
    group.rotation.y = rotY
    scene.add(group)
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), materials.window)
    pane.position.z = 0.035
    group.add(pane)
    const frame = materials.woodDark
    addBox(width + 0.16, 0.09, 0.13, frame, 0, height / 2, 0.03, { parent: group, cast: false })
    addBox(width + 0.16, 0.09, 0.13, frame, 0, -height / 2, 0.03, { parent: group, cast: false })
    addBox(0.09, height, 0.13, frame, -width / 2, 0, 0.03, { parent: group, cast: false })
    addBox(0.09, height, 0.13, frame, width / 2, 0, 0.03, { parent: group, cast: false })
    addBox(0.06, height, 0.06, frame, 0, 0, 0.04, { parent: group, cast: false })
    addBox(width, 0.055, 0.05, frame, 0, 0.13, 0.04, { parent: group, cast: false })
    addBox(width + 0.28, 0.1, 0.26, frame, 0, -height / 2 - 0.08, 0.1, { parent: group, cast: false })
    const boards = [
      { x: -0.04, y: 0.42, rot: -0.18, w: 1.85 },
      { x: 0.03, y: -0.22, rot: 0.25, w: 1.7 },
      { x: 0.0, y: -0.63, rot: -0.08, w: 1.9 },
    ]
    for (const board of boards) {
      addBox(board.w, 0.15, 0.055, materials.wood, board.x, board.y, 0.105, { parent: group, rotZ: board.rot, cast: false })
    }
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.06, height * 0.96), materials.plastic)
    cloth.position.set(-width * 0.54, 0, 0.14)
    group.add(cloth)
    return group
  }

  addWindow(-8.88, 6.9, Math.PI / 2)
  addWindow(-8.88, 3.0, Math.PI / 2, 1.3, 1.4)
  addWindow(8.88, 6.6, -Math.PI / 2)
  addWindow(8.88, 2.6, -Math.PI / 2, 1.25, 1.4)
  addWindow(8.88, -3.55, -Math.PI / 2)
  addWindow(-8.88, -3.4, Math.PI / 2)
  addWindow(-5.7, 8.88, Math.PI, 1.15, 1.55)
  addWindow(5.7, 8.88, Math.PI, 1.15, 1.55)

  function addFrontDoor() {
    addBox(0.18, 2.6, 0.16, materials.trim, -1.12, 1.3, 8.9, { cast: false })
    addBox(0.18, 2.6, 0.16, materials.trim, 1.12, 1.3, 8.9, { cast: false })
    addBox(2.4, 0.2, 0.16, materials.trim, 0, 2.58, 8.9, { cast: false })
    const pivot = new THREE.Group()
    pivot.position.set(-1.05, 0, 8.83)
    scene.add(pivot)
    const door = addBox(2.08, 2.48, 0.13, materials.woodDark, 1.05, 1.24, 0, { parent: pivot })
    for (let i = 0; i < 3; i++) {
      addBox(2.04, 0.12, 0.045, materials.wood, 1.05, 0.72 + i * 0.64, 0.075, { parent: pivot, rotZ: i % 2 ? -0.025 : 0.04, cast: false })
    }
    addBox(0.18, 0.08, 0.08, materials.brass, 1.78, 1.18, 0.12, { parent: pivot, cast: false })
    addBox(0.22, 0.1, 0.06, materials.metalDark, 1.78, 1.05, 0.12, { parent: pivot, cast: false })
    const anchor = new THREE.Object3D()
    anchor.position.set(0, 1.3, 8.55)
    scene.add(anchor)
    const collider = registerCollider(-1.05, 1.05, 8.74, 8.92, { dynamic: true })
    occluders.push(door)
    const item = addInteractable('frontDoor', anchor, 'CHECK DOOR', { range: 2.2, dot: 0.3 })
    doorRefs.front = { pivot, door, collider, anchor, item, angle: 0, target: 0 }
    return item
  }

  function addCellarDoor() {
    addDoorTrim('z', -6, -1.05, 1.05, 2.55)
    const pivot = new THREE.Group()
    pivot.position.set(-1.0, 0, -5.93)
    scene.add(pivot)
    const door = addBox(2.0, 2.42, 0.12, materials.metalDark, 1.0, 1.21, 0, { parent: pivot })
    for (let i = 0; i < 3; i++) {
      addBox(1.7, 0.055, 0.04, materials.metal, 1.0, 0.52 + i * 0.68, 0.085, { parent: pivot, cast: false })
    }
    addBox(0.08, 0.34, 0.06, materials.metal, 1.72, 1.13, 0.1, { parent: pivot, cast: false })
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x5b1511, emissive: 0x9c1f17, emissiveIntensity: 2, roughness: 0.35 })
    addBox(0.24, 0.18, 0.045, materials.metalDark, 1.44, 1.65, 0.09, { parent: pivot, cast: false })
    addCylinder(0.035, 0.035, 0.024, 10, lampMat, 1.48, 1.7, 0.12, { parent: pivot, rotX: Math.PI / 2, cast: false })
    addBox(0.42, 0.15, 0.02, materials.ceramic, 1.35, 1.95, 0.08, { parent: pivot, cast: false })
    const anchor = new THREE.Object3D()
    anchor.position.set(0, 1.35, -5.72)
    scene.add(anchor)
    const collider = registerCollider(-1.0, 1.0, -6.02, -5.84, { dynamic: true })
    occluders.push(door)
    const item = addInteractable('cellarDoor', anchor, 'TRY DOOR', { range: 2.35, dot: 0.35 })
    doorRefs.cellar = { pivot, door, collider, anchor, item, angle: 0, target: 0, ledMaterial: lampMat }
    return item
  }

  addFrontDoor()
  addCellarDoor()

  // ---------------------------------------------------------------- foyer
  addPlane(1.6, 4.8, materials.runner, 0.15, 0.012, 5.1, 0, { rotX: -Math.PI / 2 })
  addBox(0.42, 0.82, 1.32, materials.wood, -1.64, 0.41, 7.75, { collide: true })
  addBox(0.5, 0.06, 1.4, materials.woodLight, -1.61, 0.84, 7.75, { cast: false })
  addBox(0.08, 0.62, 0.08, materials.woodDark, -1.64, 0.25, 7.2, { cast: false })
  const foyerNote = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38), materials.paper)
  foyerNote.rotation.x = -Math.PI / 2
  foyerNote.rotation.z = 0.18
  foyerNote.position.set(-1.64, 0.875, 7.73)
  scene.add(foyerNote)
  addInteractable('noteFoyer', foyerNote, 'READ NOTE', { range: 2.2, dot: 0.35 })

  addPlane(0.82, 1.05, materials.portrait, -1.885, 1.85, 5.0, Math.PI / 2)
  addBox(0.08, 1.25, 1.0, materials.woodDark, -1.93, 1.83, 5.0, { cast: false })
  const coatHooks = new THREE.Group()
  coatHooks.position.set(1.88, 1.72, 7.2)
  scene.add(coatHooks)
  addBox(0.06, 0.9, 0.07, materials.woodDark, 0, 0, 0, { parent: coatHooks, cast: false })
  for (let i = 0; i < 3; i++) {
    addCylinder(0.018, 0.018, 0.16, 6, materials.brass, 0, 0.32 - i * 0.28, -0.08, { parent: coatHooks, rotX: Math.PI / 2.8, cast: false })
  }
  addBox(0.38, 1.15, 0.18, materials.fabricDark, 1.72, 1.12, 7.2, { rotZ: 0.08, cast: false })

  // ---------------------------------------------------------------- living room
  addPlane(4.6, 5.1, materials.rug, -5.6, 0.014, 4.7, 0, { rotX: -Math.PI / 2, rotZ: 0.02 })
  addBox(0.95, 0.82, 2.6, materials.fabricDark, -8.13, 0.42, 4.25, { collide: true })
  addBox(0.72, 0.28, 2.4, materials.fabricDark, -7.82, 0.83, 4.25, { cast: false })
  addBox(0.4, 0.52, 0.32, materials.fabricDark, -7.92, 0.59, 3.03, { cast: false })
  addBox(0.4, 0.52, 0.32, materials.fabricDark, -7.92, 0.59, 5.47, { cast: false })
  addBox(0.65, 0.2, 1.0, materials.fabricCream, -7.82, 0.96, 3.87, { cast: false })
  addBox(0.65, 0.2, 1.0, materials.fabricCream, -7.82, 0.96, 4.73, { cast: false })
  addBox(1.5, 0.09, 0.85, materials.woodLight, -5.55, 0.45, 4.65, { collide: true })
  for (let i = 0; i < 4; i++) {
    addBox(0.07, 0.42, 0.07, materials.woodDark, -6.18 + i * 0.42, 0.21, 4.3, { cast: false })
  }
  addCylinder(0.08, 0.1, 0.1, 12, materials.ceramic, -5.8, 0.55, 4.6, { cast: false })
  addBox(0.92, 0.95, 0.95, materials.fabricRed, -6.7, 0.46, 6.7, { rotY: -0.4, collide: true })
  addBox(0.82, 0.7, 0.22, materials.fabricRed, -6.7, 1.14, 7.0, { rotY: -0.4, cast: false })
  addBox(0.22, 0.44, 0.8, materials.fabricRed, -6.3, 0.7, 6.7, { rotY: -0.4, cast: false })
  addBox(0.22, 0.44, 0.8, materials.fabricRed, -7.1, 0.7, 6.7, { rotY: -0.4, cast: false })

  // Fireplace
  addBox(0.4, 1.6, 2.2, materials.cellarWall, -8.66, 0.8, 7.1, { cast: false })
  addBox(0.14, 1.0, 1.25, materials.black, -8.43, 0.5, 7.1, { cast: false })
  addBox(0.3, 0.16, 2.4, materials.woodDark, -8.52, 1.68, 7.1, { cast: false })
  addBox(0.34, 0.24, 0.22, materials.ember, -8.44, 0.2, 7.0, { cast: false })
  addBox(0.28, 0.16, 0.22, materials.ember, -8.42, 0.18, 7.32, { cast: false })
  const fireLight = addPointLight(0xff7a31, 2.4, 5.5, -8.05, 0.62, 7.1, {})
  fireLight.userData.fire = true

  // Sideboard & painkillers
  addBox(0.52, 0.92, 1.9, materials.wood, -8.58, 0.46, 2.15, { collide: true })
  addBox(0.6, 0.06, 2.0, materials.woodLight, -8.56, 0.95, 2.15, { cast: false })
  const medicine = new THREE.Group()
  medicine.position.set(-8.52, 1.02, 2.35)
  scene.add(medicine)
  addCylinder(0.055, 0.065, 0.18, 10, materials.porcelain, 0, 0.1, 0, { parent: medicine, cast: false })
  addCylinder(0.05, 0.05, 0.03, 10, materials.metalDark, 0, 0.2, 0, { parent: medicine, cast: false })
  addGlow(medicine, 0xa8b58d, 0.22, 0.1)
  addInteractable('painkillers', medicine, 'TAKE PAINKILLERS', { range: 2.2, dot: 0.4 })

  // Living table lamp
  const lampTable = addBox(0.55, 0.55, 0.55, materials.wood, -8.42, 0.28, 8.12, { collide: true })
  addCylinder(0.03, 0.04, 0.68, 10, materials.brass, -8.42, 0.9, 8.12, { cast: false })
  const livingShade = addCylinder(0.22, 0.32, 0.3, 20, materials.fabricCream, -8.42, 1.26, 8.12, { cast: false })
  livingShade.material = new THREE.MeshStandardMaterial({ color: 0x8f846a, roughness: 0.95, emissive: 0x3b2b17, emissiveIntensity: 0.5, side: THREE.DoubleSide })
  const livingLight = addPointLight(0xffbd78, 10, 8, -8.2, 1.34, 8.0, { powered: true, flicker: 0.13, phase: 1.4 })
  const livingBulb = addCylinder(0.035, 0.035, 0.09, 8, materials.bulb, -8.42, 1.22, 8.12, { cast: false })
  livingLight.position.copy(livingBulb.position)
  lamps[lamps.length - 1].bulbMaterial = materials.bulb

  addPlane(0.95, 1.2, materials.portrait, -3.12, 1.85, 4.1, -Math.PI / 2)
  addBox(0.08, 1.42, 1.14, materials.woodDark, -3.06, 1.85, 4.1, { cast: false })

  addPlane(2.6, 3.0, materials.rug, -5.6, 0.02, 4.7, 0, { rotX: -Math.PI / 2, rotZ: 0.02 })

  // ---------------------------------------------------------------- dining room
  addBox(2.9, 0.1, 1.5, materials.woodLight, 5.8, 0.79, 5.0, { collide: true })
  for (let i = 0; i < 4; i++) {
    addBox(0.1, 0.74, 0.1, materials.woodDark, 4.65 + (i % 2) * 2.3, 0.37, 4.45 + Math.floor(i / 2) * 1.1, { cast: false })
  }
  for (const [x, z] of [[4.25, 4.38], [7.35, 4.38], [4.25, 5.62], [7.35, 5.62]]) {
    addBox(0.5, 0.08, 0.48, materials.wood, x, 0.49, z, { cast: false })
    addBox(0.5, 0.65, 0.07, materials.wood, x, 0.82, z + (z > 5 ? 0.23 : -0.23), { cast: false })
    for (const [lx, lz] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) {
      addBox(0.045, 0.48, 0.045, materials.woodDark, x + lx, 0.25, z + lz, { cast: false })
    }
  }
  // Handgun on the table
  function buildPistol(material, scale = 1) {
    const gun = new THREE.Group()
    addBox(0.085, 0.1, 0.42, material, 0, 0.02, -0.06, { parent: gun, cast: false })
    addBox(0.08, 0.07, 0.24, materials.metalDark, 0, -0.015, -0.29, { parent: gun, cast: false })
    addBox(0.075, 0.22, 0.11, materials.woodDark, 0, -0.15, 0.09, { parent: gun, rotX: -0.15, cast: false })
    addBox(0.035, 0.08, 0.04, materials.metalDark, 0, 0.01, 0.18, { parent: gun, cast: false })
    gun.scale.setScalar(scale)
    return gun
  }
  const gunPickup = buildPistol(materials.metal, 1)
  gunPickup.position.set(5.25, 0.91, 5.03)
  gunPickup.rotation.set(0, 0.4, 0.1)
  scene.add(gunPickup)
  addGlow(gunPickup, 0xb9a16e, 0.32, 0.02)
  addInteractable('gun', gunPickup, 'TAKE HANDGUN', { range: 2.3, dot: 0.42 })

  const ammoPickup = new THREE.Group()
  ammoPickup.position.set(8.02, 0.985, -1.18)
  scene.add(ammoPickup)
  for (let i = 0; i < 4; i++) {
    addCylinder(0.02, 0.02, 0.1, 8, materials.brass, (i - 1.5) * 0.04, 0.052, 0.025, { parent: ammoPickup, rotX: Math.PI / 2, cast: false })
  }
  const ammoCanMat = new THREE.MeshStandardMaterial({ color: 0x3e4a3a, roughness: 0.58, metalness: 0.42 })
  addBox(0.22, 0.06, 0.13, ammoCanMat, 0, 0.03, 0, { parent: ammoPickup, cast: false })
  addBox(0.06, 0.014, 0.02, materials.brass, 0, 0.07, -0.04, { parent: ammoPickup, cast: false })
  addGlow(ammoPickup, 0xb9a16e, 0.2, 0.08)
  addInteractable('ammo', ammoPickup, 'TAKE AMMUNITION', { range: 2.2, dot: 0.42 })

  // Dining sideboard and chandelier
  addBox(0.55, 1.0, 2.2, materials.wood, 8.6, 0.5, 7.2, { collide: true })
  addBox(0.62, 0.06, 2.3, materials.woodLight, 8.58, 1.02, 7.2, { cast: false })
  for (let i = 0; i < 5; i++) {
    addCylinder(0.018, 0.018, 0.28, 8, materials.porcelain, 8.28, 1.2, 6.35 + i * 0.27, { cast: false })
  }
  addPlane(1.3, 1.0, materials.portrait, 4.1, 1.72, 8.89, Math.PI)
  addBox(2.5, 1.9, 0.07, materials.woodDark, 4.1, 1.72, 8.94, { cast: false })
  const chandelier = new THREE.Group()
  chandelier.position.set(5.9, 2.55, 5.0)
  scene.add(chandelier)
  addCylinder(0.015, 0.015, 0.48, 8, materials.metalDark, 0, 0.28, 0, { parent: chandelier, cast: false })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.022, 6, 24), materials.brass)
  ring.rotation.x = Math.PI / 2
  chandelier.add(ring)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    addCylinder(0.018, 0.018, 0.2, 8, materials.porcelain, Math.cos(a) * 0.42, 0.1, Math.sin(a) * 0.42, { parent: chandelier, cast: false })
    addCylinder(0.012, 0.012, 0.09, 8, materials.bulb, Math.cos(a) * 0.42, 0.25, Math.sin(a) * 0.42, { parent: chandelier, cast: false })
  }
  addPointLight(0xffbe78, 12, 9, 5.9, 2.45, 5.0, { powered: true, flicker: 0.16, phase: 4.2 })

  // ---------------------------------------------------------------- foyer / hall lamp
  const foyerLamp = new THREE.Group()
  foyerLamp.position.set(0, 2.95, 6.7)
  scene.add(foyerLamp)
  addCylinder(0.008, 0.008, 0.35, 5, materials.metalDark, 0, -0.1, 0, { parent: foyerLamp, cast: false })
  const foyerShade = addCylinder(0.12, 0.24, 0.2, 14, materials.fabricCream, 0, -0.33, 0, { parent: foyerLamp, cast: false })
  foyerShade.material = new THREE.MeshStandardMaterial({ color: 0x5c513f, roughness: 1, side: THREE.DoubleSide })
  addCylinder(0.035, 0.035, 0.09, 8, materials.bulb, 0, -0.42, 0, { parent: foyerLamp, cast: false })
  addPointLight(0xffaa68, 2.6, 8, 0, 2.52, 6.7, { phase: 2.6, speed: 1.9, flicker: 0.18 })

  // ---------------------------------------------------------------- kitchen
  for (let i = 0; i < 3; i++) {
    addBox(0.82, 0.84, 1.45, materials.wood, 8.48, 0.42, -4.5 + i * 1.52, { collide: true })
    addBox(0.94, 0.07, 1.55, materials.woodLight, 8.43, 0.88, -4.5 + i * 1.52, { cast: false })
    addBox(0.03, 0.3, 0.55, materials.brass, 8.04, 0.6, -4.5 + i * 1.52, { cast: false })
  }
  addBox(0.88, 0.92, 1.45, materials.metal, 8.45, 0.46, -1.42, { collide: true })
  addBox(0.92, 0.06, 1.5, materials.metalDark, 8.43, 0.94, -1.42, { cast: false })
  addBox(0.62, 0.03, 0.95, materials.metalDark, 8.4, 0.975, -1.42, { cast: false })
  addCylinder(0.04, 0.04, 0.32, 8, materials.metal, 8.34, 1.08, -1.7, { rotZ: Math.PI / 2, cast: false })
  addBox(0.98, 1.95, 0.95, materials.metal, 8.45, 0.98, -5.35, { collide: true })
  addBox(0.9, 0.04, 0.88, materials.metalDark, 8.43, 1.05, -5.35, { cast: false })
  addBox(0.06, 0.4, 0.06, materials.metalDark, 8.01, 1.3, -5.05, { cast: false })
  addBox(2.35, 0.08, 1.1, materials.woodLight, 5.7, 0.88, -2.45, { collide: true })
  for (let i = 0; i < 4; i++) {
    addBox(0.09, 0.85, 0.09, materials.woodDark, 4.65 + (i % 2) * 2.05, 0.44, -2.95 + Math.floor(i / 2) * 0.95, { cast: false })
  }
  addBox(0.36, 0.16, 0.5, materials.metalDark, 5.6, 1.0, -2.4, { cast: false })
  addCylinder(0.1, 0.1, 0.04, 12, materials.metal, 5.6, 1.09, -2.4, { cast: false })

  // Fuse on counter
  function makeFuse(x, y, z, rot = 0) {
    const group = new THREE.Group()
    group.position.set(x, y, z)
    group.rotation.y = rot
    scene.add(group)
    addCylinder(0.045, 0.045, 0.2, 12, materials.ceramic, 0, 0.085, 0, { parent: group, rotZ: Math.PI / 2, cast: false })
    addCylinder(0.052, 0.052, 0.05, 12, materials.brass, -0.09, 0.085, 0, { parent: group, rotZ: Math.PI / 2, cast: false })
    addCylinder(0.052, 0.052, 0.05, 12, materials.brass, 0.09, 0.085, 0, { parent: group, rotZ: Math.PI / 2, cast: false })
    addGlow(group, 0xd8b875, 0.34, 0.1)
    return group
  }
  const kitchenFuse = makeFuse(8.02, 0.94, -3.35, 0.25)
  addInteractable('fuseKitchen', kitchenFuse, 'TAKE CERAMIC FUSE', { range: 2.45, dot: 0.42 })
  pickups.fuseKitchen = kitchenFuse

  const fluorescent = addBox(1.9, 0.09, 0.2, materials.fluorescent, 5.9, 3.08, -2.5, { cast: false })
  addPointLight(0xbdd7b3, 9, 7.5, 5.9, 2.9, -2.5, { powered: true, phase: 2.2, speed: 2.1, flicker: 0.22 })
  addBox(0.06, 0.4, 0.06, materials.metalDark, 5.9, 3.25, -2.5, { cast: false })

  addBox(0.55, 0.7, 0.35, materials.ceramic, 8.35, 1.25, -3.25, { cast: false })
  addBox(0.42, 0.08, 0.25, materials.woodDark, 8.22, 1.25, -3.25, { cast: false })

  // ---------------------------------------------------------------- study
  for (let i = 0; i < 2; i++) {
    addBox(0.4, 2.15, 1.8, materials.wood, -8.6, 1.08, -2.1 - i * 2.25, { collide: true })
    for (let shelf = 0; shelf < 4; shelf++) {
      addBox(0.34, 0.04, 1.62, materials.woodDark, -8.52, 0.4 + shelf * 0.46, -2.1 - i * 2.25, { cast: false })
      for (let b = 0; b < 9; b++) {
        const colors = [0x4a2b22, 0x28362c, 0x3f3b28, 0x26303a, 0x4a4432]
        const bm = new THREE.MeshStandardMaterial({ color: colors[(b + shelf + i) % colors.length], roughness: 0.9 })
        addBox(0.055 + rand() * 0.05, 0.22 + rand() * 0.12, 0.12, bm, -8.33, 0.55 + shelf * 0.46, -2.75 + b * 0.14 + i * 0.02, { cast: false })
      }
    }
  }
  addBox(2.35, 0.1, 0.92, materials.woodLight, -6.35, 0.8, -4.1, { collide: true })
  addBox(2.15, 0.74, 0.06, materials.woodDark, -6.35, 0.42, -3.68, { cast: false })
  addBox(0.74, 0.42, 0.58, materials.wood, -7.38, 0.42, -4.1, { cast: false })
  addBox(0.68, 0.08, 0.05, materials.brass, -6.4, 0.72, -3.61, { cast: false })
  const studyFuse = makeFuse(-6.55, 0.86, -4.02, -0.35)
  addInteractable('fuseStudy', studyFuse, 'TAKE CERAMIC FUSE', { range: 2.45, dot: 0.42 })
  pickups.fuseStudy = studyFuse
  addBox(0.5, 0.08, 0.5, materials.fabricDark, -6.1, 0.45, -3.1, { rotY: 0.2, cast: false })
  addBox(0.5, 0.72, 0.08, materials.fabricDark, -6.1, 0.8, -2.86, { rotY: 0.2, cast: false })
  for (let i = 0; i < 4; i++) {
    addBox(0.045, 0.42, 0.045, materials.woodDark, -6.34 + (i % 2) * 0.48, 0.22, -3.3 + Math.floor(i / 2) * 0.4, { cast: false })
  }
  addBox(0.72, 0.74, 0.42, materials.woodDark, -7.93, 1.17, -4.1, { cast: false })
  addCylinder(0.03, 0.03, 0.4, 8, materials.brass, -7.93, 1.5, -4.1, { cast: false })
  const studyShade = addCylinder(0.14, 0.22, 0.2, 14, materials.fabricCream, -7.93, 1.72, -4.1, { cast: false })
  studyShade.material = new THREE.MeshStandardMaterial({ color: 0x7c6e52, roughness: 0.95, side: THREE.DoubleSide, emissive: 0x583716, emissiveIntensity: 0.7 })
  addPointLight(0xffc078, 7, 5.5, -7.75, 1.6, -4.0, { powered: true, phase: 5.3, flicker: 0.1 })

  const wardrobe = new THREE.Group()
  wardrobe.position.set(-3.45, 0, -4.8)
  scene.add(wardrobe)
  addBox(1.65, 2.05, 0.75, materials.wood, 0, 1.025, 0, { parent: wardrobe })
  addBox(0.78, 1.9, 0.06, materials.woodDark, -0.41, 1.02, 0.4, { parent: wardrobe, cast: false })
  addBox(0.78, 1.9, 0.06, materials.woodDark, 0.41, 1.02, 0.4, { parent: wardrobe, cast: false })
  addBox(0.03, 0.18, 0.04, materials.brass, -0.06, 1.02, 0.45, { parent: wardrobe, cast: false })
  addBox(0.03, 0.18, 0.04, materials.brass, 0.06, 1.02, 0.45, { parent: wardrobe, cast: false })
  registerCollider(-4.35, -2.55, -5.25, -4.35, {})
  addPlane(0.82, 1.05, materials.portrait, -8.89, 1.75, -0.4, Math.PI / 2)

  // ---------------------------------------------------------------- cellar
  addBox(1.9, 0.1, 0.9, materials.woodDark, 0, -0.85, -9.85, { collide: true })
  for (let i = 0; i < 4; i++) {
    addBox(0.1, 0.78, 0.1, materials.wood, -0.78 + (i % 2) * 1.56, -1.35, -10.18 + Math.floor(i / 2) * 0.65, { cast: false })
  }
  const keyPickup = new THREE.Group()
  keyPickup.position.set(0, -0.77, -9.82)
  keyPickup.rotation.y = 0.5
  scene.add(keyPickup)
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 6, 16), materials.brass)
  bow.rotation.x = Math.PI / 2
  keyPickup.add(bow)
  addBox(0.03, 0.024, 0.24, materials.brass, 0, 0, -0.15, { parent: keyPickup, cast: false })
  addBox(0.07, 0.03, 0.07, materials.brass, 0, 0, -0.26, { parent: keyPickup, cast: false })
  addGlow(keyPickup, 0xe5b55f, 0.55, 0.04)
  addInteractable('ironKey', keyPickup, 'TAKE IRON KEY', { range: 2.5, dot: 0.36 })
  pickups.ironKey = keyPickup

  addBox(0.42, 2.0, 1.7, materials.wood, -3.48, -0.8, -9.0, { collide: true })
  for (let i = 0; i < 3; i++) addBox(0.36, 0.04, 1.5, materials.woodDark, -3.4, -1.6 + i * 0.58, -9.0, { cast: false })
  const cans = [0x4d4b3c, 0x343b30, 0x5c3c2c, 0x423b2a]
  for (let i = 0; i < 8; i++) {
    addCylinder(0.07, 0.07, 0.16, 10, new THREE.MeshStandardMaterial({ color: cans[i % cans.length], roughness: 0.7, metalness: 0.4 }), -3.18, -1.42 + Math.floor(i / 4) * 0.58, -9.55 + (i % 4) * 0.3, { cast: false })
  }
  addBox(0.86, 0.86, 0.86, materials.wood, -2.1, -1.36, -10.3, { rotY: 0.18, collide: true })
  addBox(0.7, 0.7, 0.7, materials.wood, 2.55, -1.45, -9.0, { rotY: -0.2, collide: true })
  addBox(0.7, 0.7, 0.7, materials.wood, 2.15, -1.45, -10.2, { rotY: 0.12, collide: true })

  // Pipes
  for (let i = 0; i < 3; i++) {
    addCylinder(0.045, 0.045, 7.6, 8, materials.metal, -3.7 + i * 0.18, 1.1, -8.5, { rotX: Math.PI / 2, cast: false })
  }
  addCylinder(0.06, 0.06, 5.4, 8, materials.metalDark, 0, 1.08, -10.5, { rotY: Math.PI / 2, cast: false })
  addCylinder(0.12, 0.12, 0.3, 10, materials.metal, 1.5, 0.7, -8.4, { cast: false })

  // Hanging plastic sheeting
  for (let i = 0; i < 4; i++) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.35, 1, 3), materials.plastic)
    sheet.position.set(-2.9 + i * 1.9, -0.58, -8.55 + (i % 2) * 0.4)
    sheet.rotation.y = Math.PI / 2 + (i % 2 ? 0.08 : -0.04)
    sheet.rotation.z = (i - 1.5) * 0.015
    scene.add(sheet)
  }

  // Candle circle
  const candleMat = new THREE.MeshStandardMaterial({ color: 0x9a8c67, roughness: 0.9, emissive: 0x5f2d10, emissiveIntensity: 0.5 })
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    addCylinder(0.04, 0.045, 0.15 + rand() * 0.2, 8, candleMat, Math.cos(a) * 0.65, -1.7 + 0.1, -10.05 + Math.sin(a) * 0.38, { cast: false })
  }
  addPointLight(0xff8a3f, 2.2, 3.5, 0, -1.45, -10.05, { phase: 1.1, speed: 1.8, flicker: 0.2 })

  const cellarBulb = new THREE.Group()
  cellarBulb.position.set(0, 1.18, -9.0)
  scene.add(cellarBulb)
  addCylinder(0.006, 0.006, 0.28, 5, materials.metalDark, 0, -0.12, 0, { parent: cellarBulb, cast: false })
  const cellarGlass = addCylinder(0.055, 0.055, 0.1, 8, materials.bulb, 0, -0.29, 0, { parent: cellarBulb, cast: false })
  addPointLight(0xffa963, 4.2, 6, 0, 0.78, -9.0, { powered: true, phase: 3.7, speed: 2.6, flicker: 0.32 })

  const cellarNote = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38), materials.paper)
  cellarNote.rotation.x = -Math.PI / 2
  cellarNote.rotation.z = -0.25
  cellarNote.position.set(2.55, -0.985, -8.72)
  scene.add(cellarNote)
  addInteractable('noteCellar', cellarNote, 'READ NOTE', { range: 2.2, dot: 0.38 })

  // Blood and grime
  addPlane(1.15, 1.0, materials.blood, 1.86, 1.4, -5.62, Math.PI)
  addPlane(0.8, 0.9, materials.blood, -3.4, 1.2, -8.58, Math.PI / 2)
  addPlane(1.3, 0.9, materials.blood, 3.92, -1.02, -9.5, -Math.PI / 2)

  // ---------------------------------------------------------------- breaker
  const breaker = new THREE.Group()
  breaker.position.set(1.89, 1.5, -1.2)
  scene.add(breaker)
  addBox(0.16, 0.78, 0.56, materials.metal, 0, 0, 0, { parent: breaker, cast: false })
  addBox(0.04, 0.66, 0.46, materials.metalDark, -0.1, 0, 0, { parent: breaker, cast: false })
  addBox(0.02, 0.08, 0.7, materials.metalDark, -0.12, -0.44, 0, { parent: breaker, cast: false })
  addBox(0.04, 0.25, 0.27, materials.woodDark, 0, 0.17, 0, { parent: breaker, cast: false })
  for (let i = 0; i < 2; i++) {
    addCylinder(0.045, 0.045, 0.05, 12, materials.black, -0.14, -0.1 + i * 0.19, 0, { parent: breaker, rotZ: Math.PI / 2, cast: false })
  }
  const breakerLed = new THREE.MeshStandardMaterial({ color: 0x5b1511, emissive: 0x9c1f17, emissiveIntensity: 1.8, roughness: 0.4 })
  addCylinder(0.025, 0.025, 0.02, 8, breakerLed, -0.15, 0.27, 0.17, { parent: breaker, rotZ: Math.PI / 2, cast: false })
  addInteractable('breaker', breaker, 'CHECK BREAKER', { range: 2.35, dot: 0.28 })
  pickups.breaker = breaker
  pickups.breakerLed = breakerLed

  // Hall overhead light (after power)
  addBox(0.34, 0.05, 0.34, materials.metalDark, 0, 3.12, 2.1, { cast: false })
  addCylinder(0.09, 0.11, 0.16, 12, materials.bulb, 0, 2.98, 2.1, { cast: false })
  addPointLight(0xffc186, 7, 8, 0, 2.75, 2.1, { powered: true, phase: 6.0, speed: 1.4, flicker: 0.12 })
  addBox(0.06, 0.1, 0.06, materials.metalDark, 0, 3.02, 2.1, { cast: false })

  // A few wall details
  addPlane(0.7, 0.9, materials.portrait, 1.885, 1.8, 2.35, -Math.PI / 2)
  addBox(0.06, 1.06, 0.86, materials.woodDark, 1.93, 1.8, 2.35, { cast: false })
  addPlane(0.7, 0.9, materials.portrait, -1.885, 1.72, 0.2, Math.PI / 2)
  addBox(0.06, 1.06, 0.86, materials.woodDark, -1.93, 1.72, 0.2, { cast: false })

  // ---------------------------------------------------------------- enemy
  const enemyGroup = new THREE.Group()
  enemyGroup.position.set(0, 0, 8.2)
  enemyGroup.visible = false
  scene.add(enemyGroup)

  const coatMat = new THREE.MeshStandardMaterial({ color: 0x1c1c18, roughness: 0.98 })
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x3d2a22, roughness: 0.96 })
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x9d8c72, roughness: 0.85 })
  const darkSkinMat = new THREE.MeshStandardMaterial({ color: 0x72644f, roughness: 0.9 })
  const enemyParts = { legs: [], arms: [] }

  const torso = addBox(0.6, 0.92, 0.34, coatMat, 0, 1.32, 0, { parent: enemyGroup })
  addBox(0.48, 0.7, 0.08, shirtMat, 0, 1.43, -0.18, { parent: enemyGroup, cast: false })
  addBox(0.7, 0.7, 0.38, coatMat, 0, 0.88, 0.01, { parent: enemyGroup, cast: false })
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skinMat)
  head.scale.set(0.9, 1.08, 0.9)
  head.position.set(0, 1.95, 0)
  head.castShadow = true
  enemyGroup.add(head)
  const mask = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.42), materials.mask)
  mask.position.set(0, 1.94, -0.158)
  mask.rotation.y = Math.PI
  enemyGroup.add(mask)
  for (const sign of [-1, 1]) {
    const leg = new THREE.Group()
    leg.position.set(sign * 0.16, 1.02, 0)
    enemyGroup.add(leg)
    addBox(0.18, 0.88, 0.2, coatMat, 0, -0.44, 0, { parent: leg })
    addBox(0.2, 0.16, 0.33, darkSkinMat, 0, -0.9, -0.06, { parent: leg, cast: false })
    enemyParts.legs.push(leg)
    const arm = new THREE.Group()
    arm.position.set(sign * 0.37, 1.65, 0)
    enemyGroup.add(arm)
    addBox(0.15, 0.76, 0.17, coatMat, 0, -0.35, 0, { parent: arm })
    addBox(0.14, 0.2, 0.14, skinMat, 0, -0.77, 0, { parent: arm, cast: false })
    enemyParts.arms.push(arm)
  }
  const headTilt = new THREE.Group()
  enemyGroup.remove(head)
  enemyGroup.remove(mask)
  headTilt.position.set(0, 1.95, 0)
  headTilt.add(head)
  head.position.set(0, 0, 0)
  mask.position.set(0, -0.01, -0.158)
  headTilt.add(mask)
  enemyGroup.add(headTilt)
  enemyParts.head = headTilt

  const lantern = new THREE.Group()
  lantern.position.set(0, -0.83, -0.03)
  enemyParts.arms[0].add(lantern)
  addBox(0.18, 0.25, 0.18, materials.metalDark, 0, 0, 0, { parent: lantern, cast: false })
  addBox(0.12, 0.16, 0.12, materials.lanternGlass, 0, 0, 0, { parent: lantern, cast: false })
  addCylinder(0.012, 0.012, 0.2, 5, materials.metalDark, 0, 0.2, 0, { parent: lantern, cast: false })
  const lanternLight = new THREE.PointLight(0xff8a3c, 3.4, 6, 1.5)
  lanternLight.position.set(0, 0, 0)
  lantern.add(lanternLight)
  enemyParts.lanternLight = lanternLight
  enemyParts.torso = torso

  // ---------------------------------------------------------------- atmosphere
  const moon = new THREE.DirectionalLight(0x6e8fa9, 0.32)
  moon.position.set(-6, 8, 5)
  scene.add(moon)

  const lightning = new THREE.DirectionalLight(0xb7d3e8, 0)
  lightning.position.set(2, 7, -7)
  scene.add(lightning)

  const dustCount = 520
  const dustPositions = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) {
    const inCellar = i > dustCount * 0.74
    dustPositions[i * 3] = (rand() * 17) - 8.5
    dustPositions[i * 3 + 1] = inCellar ? -1.6 + rand() * 2.6 : 0.18 + rand() * 2.85
    dustPositions[i * 3 + 2] = inCellar ? -10.6 + rand() * 4.2 : -5.7 + rand() * 14.4
  }
  const dustGeometry = new THREE.BufferGeometry()
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
  const dustMaterial = new THREE.PointsMaterial({
    color: 0xb1baa9,
    size: 0.014,
    transparent: true,
    opacity: 0.33,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const dust = new THREE.Points(dustGeometry, dustMaterial)
  scene.add(dust)

  const ambient = new THREE.HemisphereLight(0x415163, 0x1b1610, 0.66)
  scene.add(ambient)

  // Merge static set dressing by material. This keeps the mobile draw count low
  // while preserving dynamic props, doors, lighting, and collision ray targets.
  function mergeStaticGeometry() {
    const keep = new Set()
    const mark = (root) => {
      if (!root) return
      root.traverse((child) => keep.add(child))
    }
    for (const item of interactables) mark(item.object)
    mark(doorRefs.front?.pivot)
    mark(doorRefs.cellar?.pivot)
    mark(enemyGroup)
    mark(scene.getObjectByProperty('type', 'PerspectiveCamera'))
    for (const occluder of occluders) keep.add(occluder)

    scene.updateMatrixWorld(true)
    const groups = new Map()
    const originals = []
    scene.traverse((object) => {
      if (!object.isMesh || object.isSkinnedMesh) return
      if (keep.has(object)) return
      if (Array.isArray(object.material)) return
      if (!object.material || object.material.isSpriteMaterial || object.material.isPointsMaterial) return
      const key = object.material.uuid
      if (!groups.has(key)) groups.set(key, { material: object.material, geometries: [], cast: false, receive: false })
      const entry = groups.get(key)
      const geometry = object.geometry.clone()
      geometry.applyMatrix4(object.matrixWorld)
      entry.geometries.push(geometry)
      entry.cast = entry.cast || object.castShadow
      entry.receive = entry.receive || object.receiveShadow
      originals.push(object)
    })

    for (const object of originals) object.removeFromParent()
    for (const entry of groups.values()) {
      if (!entry.geometries.length) continue
      const merged = mergeGeometries(entry.geometries, false)
      for (const geometry of entry.geometries) geometry.dispose()
      if (!merged) continue
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, entry.material)
      mesh.castShadow = entry.cast
      mesh.receiveShadow = entry.receive
      mesh.frustumCulled = false
      scene.add(mesh)
    }
  }
  mergeStaticGeometry()

  return {
    colliders,
    occluders,
    interactables,
    lamps,
    textures,
    materials,
    pickups,
    doorRefs,
    enemy: { group: enemyGroup, parts: enemyParts },
    lightning,
    moon,
    dust,
    dustPositions,
    windowMaterial: materials.window,
    ambient,
  }
}
