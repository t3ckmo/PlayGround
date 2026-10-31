import * as THREE from 'three'

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function canvasTexture(size, paint, { repeat = [1, 1], srgb = true } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  paint(ctx, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.anisotropy = 4
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function noise(ctx, size, amount, alpha = 0.1, light = false) {
  const rand = rng(size * 97 + amount * 13)
  for (let i = 0; i < amount; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = rand() * 2 + 0.4
    const value = light ? 210 + rand() * 45 : 5 + rand() * 30
    ctx.fillStyle = `rgba(${value},${value},${value},${alpha * rand()})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function stains(ctx, size, count, color = '45,34,20') {
  const rand = rng(size * 31 + count)
  for (let i = 0; i < count; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 10 + rand() * 45
    const g = ctx.createRadialGradient(x, y, r * 0.05, x, y, r)
    g.addColorStop(0, `rgba(${color},${0.16 + rand() * 0.16})`)
    g.addColorStop(0.55, `rgba(${color},0.06)`)
    g.addColorStop(1, `rgba(${color},0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * (0.5 + rand() * 0.8), rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function woodFloorTexture() {
  return canvasTexture(512, (ctx, s) => {
    const rand = rng(451)
    ctx.fillStyle = '#2e2118'
    ctx.fillRect(0, 0, s, s)
    for (let row = 0; row < 8; row++) {
      const y = row * 64
      const shade = 36 + Math.floor(rand() * 15)
      ctx.fillStyle = `rgb(${shade + 16},${shade + 2},${Math.max(12, shade - 14)})`
      ctx.fillRect(0, y + 1, s, 62)
      ctx.strokeStyle = 'rgba(8,5,3,.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(s, y)
      ctx.stroke()
      for (let g = 0; g < 18; g++) {
        ctx.strokeStyle = `rgba(15,8,4,${0.03 + rand() * 0.08})`
        ctx.lineWidth = 0.7 + rand()
        const gy = y + 5 + rand() * 52
        ctx.beginPath()
        ctx.moveTo(0, gy)
        for (let x = 0; x <= s; x += 32) ctx.lineTo(x, gy + Math.sin(x * 0.03 + g) * 2)
        ctx.stroke()
      }
      const joint = Math.floor(rand() * s)
      ctx.fillStyle = 'rgba(6,4,2,.7)'
      ctx.fillRect(joint, y, 3, 64)
      if (rand() > 0.65) {
        ctx.strokeStyle = 'rgba(15,10,6,.3)'
        ctx.beginPath()
        ctx.ellipse(rand() * s, y + 35, 21, 4, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    stains(ctx, s, 24, '15,8,4')
    noise(ctx, s, 800, 0.06)
  }, { repeat: [4, 4] })
}

export function wallpaperTexture(base = '#42473a', motif = '#5e6451') {
  return canvasTexture(256, (ctx, s) => {
    const rand = rng(s + 71)
    ctx.fillStyle = base
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = 'rgba(255,244,210,.025)'
    for (let x = 0; x < s; x += 32) ctx.fillRect(x, 0, 1, s)
    ctx.strokeStyle = motif
    ctx.globalAlpha = 0.38
    for (let x = 16; x < s; x += 64) {
      for (let y = 18; y < s; y += 64) {
        ctx.beginPath()
        ctx.ellipse(x, y, 9, 17, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y - 11, 4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x - 10, y + 18)
        ctx.quadraticCurveTo(x, y + 30, x + 10, y + 18)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    for (let i = 0; i < 7; i++) {
      const x = rand() * s
      const y = rand() * s
      ctx.fillStyle = `rgba(38,29,15,${0.1 + rand() * 0.12})`
      ctx.beginPath()
      ctx.ellipse(x, y, 20 + rand() * 45, 9 + rand() * 45, rand() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    noise(ctx, s, 1300, 0.065)
  }, { repeat: [2.4, 1.4] })
}

export function plasterTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = rng(139)
    ctx.fillStyle = '#5a5548'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(${25 + rand() * 50},${25 + rand() * 48},${20 + rand() * 38},${0.08 + rand() * 0.08})`
      ctx.fillRect(rand() * s, rand() * s, 10 + rand() * 60, 6 + rand() * 40)
    }
    stains(ctx, s, 12, '38,30,18')
    noise(ctx, s, 1000, 0.08)
  }, { repeat: [2, 1.4] })
}

export function concreteTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = rng(777)
    ctx.fillStyle = '#3f4241'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 900; i++) {
      const v = 40 + rand() * 50
      ctx.fillStyle = `rgba(${v},${v + 2},${v},${0.12 + rand() * 0.2})`
      ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 4, 1 + rand() * 4)
    }
    stains(ctx, s, 18, '14,18,14')
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = `rgba(15,17,16,${0.2 + rand() * 0.3})`
      ctx.beginPath()
      let x = rand() * s
      let y = rand() * s
      ctx.moveTo(x, y)
      for (let j = 0; j < 6; j++) {
        x += (rand() - 0.5) * 40
        y += rand() * 22
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }, { repeat: [3, 3] })
}

export function woodTexture(base = '#3a2618') {
  return canvasTexture(256, (ctx, s) => {
    const rand = rng(88)
    ctx.fillStyle = base
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 130; i++) {
      const y = rand() * s
      ctx.strokeStyle = `rgba(${8 + rand() * 18},${5 + rand() * 12},${2 + rand() * 8},${0.08 + rand() * 0.18})`
      ctx.lineWidth = 0.5 + rand() * 2
      ctx.beginPath()
      ctx.moveTo(0, y)
      for (let x = 0; x <= s; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3)
      ctx.stroke()
    }
    stains(ctx, s, 8, '10,6,3')
    noise(ctx, s, 260, 0.07)
  }, { repeat: [1, 1] })
}

export function ceilingTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = rng(191)
    ctx.fillStyle = '#37352d'
    ctx.fillRect(0, 0, s, s)
    stains(ctx, s, 20, '25,22,16')
    for (let i = 0; i < 15; i++) {
      ctx.strokeStyle = `rgba(20,18,13,${0.18 + rand() * 0.25})`
      ctx.beginPath()
      const x = rand() * s
      const y = rand() * s
      ctx.moveTo(x, y)
      ctx.lineTo(x + (rand() - 0.5) * 80, y + rand() * 50)
      ctx.stroke()
    }
    noise(ctx, s, 700, 0.08)
  }, { repeat: [2, 2] })
}

export function tileTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = rng(421)
    ctx.fillStyle = '#5a5c4f'
    ctx.fillRect(0, 0, s, s)
    for (let y = 0; y < s; y += 32) {
      for (let x = 0; x < s; x += 32) {
        const v = 78 + rand() * 26
        ctx.fillStyle = `rgba(${v},${v + 4},${v - 3},${0.5})`
        ctx.fillRect(x + 1, y + 1, 30, 30)
      }
    }
    ctx.strokeStyle = 'rgba(20,22,17,.7)'
    ctx.lineWidth = 2
    for (let i = 0; i <= s; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke()
    }
    stains(ctx, s, 14, '25,23,14')
    noise(ctx, s, 500, 0.06)
  }, { repeat: [3, 2] })
}

export function rugTexture() {
  return canvasTexture(512, (ctx, s) => {
    const rand = rng(1948)
    ctx.fillStyle = '#4b1f1b'
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = '#80604b'
    ctx.lineWidth = 5
    ctx.strokeRect(18, 18, s - 36, s - 36)
    ctx.strokeStyle = 'rgba(180,151,113,.4)'
    ctx.lineWidth = 2
    ctx.strokeRect(35, 35, s - 70, s - 70)
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        const x = 60 + i * 45
        const y = 60 + j * 45
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(Math.PI / 4)
        ctx.strokeStyle = 'rgba(126,87,62,.35)'
        ctx.strokeRect(-12, -12, 24, 24)
        ctx.restore()
      }
    }
    stains(ctx, s, 22, '18,8,5')
    noise(ctx, s, 1900, 0.06)
  })
}

export function portraitTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = rng(1912)
    const g = ctx.createLinearGradient(0, 0, 0, s)
    g.addColorStop(0, '#6b5b44')
    g.addColorStop(1, '#2a2119')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = 'rgba(29,21,16,.85)'
    ctx.beginPath()
    ctx.ellipse(s / 2, 66, 32, 38, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(60, s)
    ctx.quadraticCurveTo(64, 130, 112, 115)
    ctx.lineTo(144, 115)
    ctx.quadraticCurveTo(192, 130, 196, s)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(196,172,132,.72)'
    ctx.beginPath()
    ctx.ellipse(s / 2, 69, 22, 31, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(24,17,13,.95)'
    ctx.beginPath(); ctx.ellipse(117, 64, 5, 6, -0.18, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(139, 66, 4.5, 5, 0.12, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(52,34,24,.95)'
    ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(119, 86); ctx.quadraticCurveTo(128, 82, 138, 88); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(112, 50); ctx.quadraticCurveTo(128, 44, 143, 51); ctx.stroke()
    ctx.fillStyle = 'rgba(30,20,14,.3)'
    ctx.beginPath(); ctx.ellipse(128, 99, 16, 5, 0, 0, Math.PI * 2); ctx.fill()
    for (let i = 0; i < 45; i++) {
      const x = rand() * s
      const y = rand() * s
      ctx.fillStyle = `rgba(20,15,10,${0.1 + rand() * 0.3})`
      ctx.fillRect(x, y, 1 + rand() * 8, 1 + rand() * 2)
    }
    ctx.strokeStyle = 'rgba(20,14,10,.5)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(60, 220); ctx.lineTo(80, 40); ctx.stroke()
  })
}

export function windowTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = rng(301)
    const g = ctx.createLinearGradient(0, 0, 0, s)
    g.addColorStop(0, '#263342')
    g.addColorStop(0.55, '#11181e')
    g.addColorStop(1, '#070a0b')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = 'rgba(166,191,204,.12)'
    ctx.lineWidth = 1
    for (let i = 0; i < 80; i++) {
      const x = rand() * s
      const y = rand() * s
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 4, y + 14 + rand() * 18)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(3,5,6,.8)'
    ctx.beginPath()
    ctx.moveTo(0, 190)
    ctx.lineTo(40, 155)
    ctx.lineTo(58, 190)
    ctx.lineTo(90, 168)
    ctx.lineTo(120, 195)
    ctx.lineTo(150, 160)
    ctx.lineTo(190, 193)
    ctx.lineTo(256, 170)
    ctx.lineTo(256, 256)
    ctx.lineTo(0, 256)
    ctx.closePath()
    ctx.fill()
  })
}

export function noteTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = rng(617)
    ctx.fillStyle = '#c6b992'
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = 'rgba(66,50,30,.8)'
    ctx.font = '20px Georgia'
    ctx.fillText('IF YOU READ THIS', 24, 42)
    ctx.font = '13px Georgia'
    const lines = ['the generator is dead.', 'two fuses are missing.', '', 'do not go down there.', 'it knows when the lights', 'come on.']
    lines.forEach((line, i) => ctx.fillText(line, 25, 76 + i * 22))
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(70,52,28,${rand() * 0.11})`
      ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 9, 1 + rand() * 3)
    }
    ctx.strokeStyle = 'rgba(85,60,30,.2)'
    ctx.strokeRect(3, 3, s - 6, s - 6)
  })
}

export function bloodTexture() {
  return canvasTexture(256, (ctx, s) => {
    const rand = rng(66)
    ctx.clearRect(0, 0, s, s)
    const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 100)
    g.addColorStop(0, 'rgba(74,10,7,.9)')
    g.addColorStop(0.5, 'rgba(48,5,4,.65)')
    g.addColorStop(1, 'rgba(21,2,2,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(128, 128, 100, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 35; i++) {
      const a = rand() * Math.PI * 2
      const d = 60 + rand() * 80
      ctx.fillStyle = `rgba(58,7,5,${0.3 + rand() * 0.5})`
      ctx.beginPath()
      ctx.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 1 + rand() * 6, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

export function maskTexture() {
  return canvasTexture(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s)
    const shade = ctx.createRadialGradient(104, 92, 12, 128, 136, 118)
    shade.addColorStop(0, '#d6ccb7')
    shade.addColorStop(0.62, '#bdb29b')
    shade.addColorStop(1, '#8e8370')
    ctx.fillStyle = shade
    ctx.beginPath()
    ctx.ellipse(128, 136, 75, 106, 0, 0, Math.PI * 2)
    ctx.fill()

    // Uneven, hollow sockets.
    ctx.fillStyle = '#0d0b09'
    ctx.beginPath(); ctx.ellipse(100, 116, 17, 10, -0.22, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(157, 113, 12, 15, 0.16, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(198,187,164,.5)'
    ctx.beginPath(); ctx.ellipse(155, 108, 3, 2.4, 0.3, 0, Math.PI * 2); ctx.fill()

    // Narrow nasal slit.
    ctx.fillStyle = 'rgba(24,19,14,.9)'
    ctx.beginPath()
    ctx.moveTo(128, 137)
    ctx.lineTo(119, 160)
    ctx.lineTo(135, 159)
    ctx.closePath()
    ctx.fill()

    // Mouth sewn shut with a crooked vertical seam and cross stitches.
    ctx.strokeStyle = '#2b2319'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(128, 174)
    ctx.quadraticCurveTo(121, 200, 130, 230)
    ctx.stroke()
    ctx.strokeStyle = '#6c5d46'
    ctx.lineWidth = 1.4
    for (let y = 178; y <= 224; y += 8) {
      const drift = Math.sin(y * 0.4) * 4
      ctx.beginPath()
      ctx.moveTo(114 + drift, y)
      ctx.lineTo(139 + drift, y + 2)
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgba(50,37,25,.45)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(128, 150); ctx.lineTo(134, 170)
    ctx.moveTo(174, 178); ctx.lineTo(184, 168)
    ctx.moveTo(80, 196); ctx.lineTo(70, 210)
    ctx.stroke()
  })
}

export function glowTexture() {
  return canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62)
    g.addColorStop(0, 'rgba(255,220,160,.95)')
    g.addColorStop(0.2, 'rgba(255,190,100,.55)')
    g.addColorStop(0.6, 'rgba(200,120,40,.12)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  })
}

export function paperTexture() {
  return canvasTexture(128, (ctx, s) => {
    const rand = rng(70)
    ctx.fillStyle = '#c3b58e'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 15; i++) {
      ctx.fillStyle = `rgba(90,70,40,${0.05 + rand() * 0.1})`
      ctx.fillRect(0, rand() * s, s, 1)
    }
  })
}
