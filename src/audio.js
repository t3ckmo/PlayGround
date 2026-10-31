export class Soundscape {
  constructor() {
    this.ctx = null
    this.master = null
    this.started = false
    this.creakTimer = 8
    this.heartTimer = 0
    this.danger = 0
    this.enemyGain = null
    this.muted = false
  }

  init() {
    if (this.started) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    const ctx = this.ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.62
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -22
    compressor.knee.value = 18
    compressor.ratio.value = 5
    compressor.attack.value = 0.005
    compressor.release.value = 0.35
    this.master.connect(compressor)
    compressor.connect(ctx.destination)
    this.started = true

    this.noiseBuffer = this.makeNoise(2.2, 'brown')
    this.whiteBuffer = this.makeNoise(1.2, 'white')

    this.startAmbient()
  }

  makeNoise(seconds, color = 'white') {
    const ctx = this.ctx
    const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let last = 0
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1
        if (color === 'brown') {
          last = (last + 0.018 * white) / 1.018
          data[i] = last * 3.2
        } else {
          data[i] = white * 0.7
        }
      }
    }
    return buffer
  }

  loopNoise(volume, type, frequency, q = 1) {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = frequency
    filter.Q.value = q
    const gain = ctx.createGain()
    gain.gain.value = volume
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start()
    return { src, gain, filter }
  }

  startAmbient() {
    const ctx = this.ctx
    this.rain = this.loopNoise(0.045, 'highpass', 950)
    this.wind = this.loopNoise(0.045, 'bandpass', 420, 0.6)
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.055
    lfoGain.gain.value = 170
    lfo.connect(lfoGain)
    lfoGain.connect(this.wind.filter.frequency)
    lfo.start()

    const droneGain = ctx.createGain()
    droneGain.gain.value = 0.033
    droneGain.connect(this.master)
    for (const [freq, detune] of [[43, 0], [55.5, 7], [82, -5]]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = detune
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 160
      filter.Q.value = 2
      const gain = ctx.createGain()
      gain.gain.value = 0.26
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(droneGain)
      osc.start()
    }

    this.enemyGrowlGain = ctx.createGain()
    this.enemyGrowlGain.gain.value = 0
    this.enemyGrowlGain.connect(this.master)
    const growl = ctx.createBufferSource()
    growl.buffer = this.noiseBuffer
    growl.loop = true
    const growlFilter = ctx.createBiquadFilter()
    growlFilter.type = 'lowpass'
    growlFilter.frequency.value = 190
    growlFilter.Q.value = 2.5
    const growlOsc = ctx.createOscillator()
    growlOsc.type = 'sawtooth'
    growlOsc.frequency.value = 47
    const oscGain = ctx.createGain()
    oscGain.gain.value = 0.15
    growl.connect(growlFilter)
    growlFilter.connect(this.enemyGrowlGain)
    growlOsc.connect(oscGain)
    oscGain.connect(this.enemyGrowlGain)
    growl.start()
    growlOsc.start()
    this.enemyGrowlOsc = growlOsc
  }

  setMuted(value) {
    if (!this.ctx) return
    this.muted = value
    this.master.gain.setTargetAtTime(value ? 0 : 0.62, this.ctx.currentTime, 0.08)
  }

  pulse(duration, frequency, volume, type = 'sine') {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  }

  noiseBurst(duration, frequency, volume, type = 'lowpass', q = 1) {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.whiteBuffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = frequency
    filter.Q.value = q
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start(now)
    src.stop(now + duration + 0.05)
  }

  click() {
    this.pulse(0.04, 880, 0.035, 'triangle')
  }

  pickup() {
    if (!this.ctx) return
    this.pulse(0.25, 420, 0.06, 'sine')
    setTimeout(() => this.pulse(0.4, 640, 0.045, 'sine'), 80)
    this.noiseBurst(0.12, 2600, 0.025, 'bandpass', 1.5)
  }

  deny() {
    this.pulse(0.12, 105, 0.09, 'square')
    this.pulse(0.18, 78, 0.07, 'sawtooth')
  }

  door() {
    this.noiseBurst(0.9, 430, 0.07, 'bandpass', 4)
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(68, now)
    osc.frequency.exponentialRampToValueAtTime(37, now + 1.1)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.15)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start()
    osc.stop(now + 1.3)
  }

  power() {
    if (!this.ctx) return
    this.noiseBurst(0.4, 1800, 0.09, 'highpass')
    this.pulse(0.7, 52, 0.13, 'sawtooth')
    setTimeout(() => this.noiseBurst(3.3, 120, 0.02, 'bandpass', 1.2), 220)
  }

  gunshot() {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    this.noiseBurst(0.36, 1500, 0.42, 'lowpass')
    this.noiseBurst(0.16, 3800, 0.16, 'highpass')
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(44, now + 0.28)
    gain.gain.setValueAtTime(0.28, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start()
    osc.stop(now + 0.34)
  }

  reload() {
    this.noiseBurst(0.06, 2300, 0.05, 'bandpass', 2)
    setTimeout(() => this.noiseBurst(0.08, 1400, 0.05, 'bandpass', 3), 230)
    setTimeout(() => this.noiseBurst(0.05, 2800, 0.06, 'bandpass', 2), 620)
  }

  empty() {
    this.noiseBurst(0.04, 2800, 0.045, 'bandpass', 3)
  }

  step(concrete = false) {
    if (!this.ctx) return
    this.noiseBurst(0.13, concrete ? 380 : 220, 0.055, 'lowpass')
    this.noiseBurst(0.06, concrete ? 1700 : 850, 0.018, 'bandpass', 1.4)
  }

  heartbeat(strength = 0.5) {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    for (const [delay, vol] of [[0, 0.025 + strength * 0.06], [0.18, 0.014 + strength * 0.03]]) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(72, now + delay)
      osc.frequency.exponentialRampToValueAtTime(36, now + delay + 0.16)
      gain.gain.setValueAtTime(vol, now + delay)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.2)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(now + delay)
      osc.stop(now + delay + 0.22)
    }
  }

  stinger() {
    if (!this.ctx) return
    this.noiseBurst(1.8, 560, 0.2, 'bandpass', 1.1)
    this.pulse(2.2, 38, 0.17, 'sawtooth')
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(360, now)
    osc.frequency.exponentialRampToValueAtTime(42, now + 1.4)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start()
    osc.stop(now + 1.7)
  }

  enemyHit() {
    this.noiseBurst(0.18, 320, 0.17, 'lowpass')
    this.pulse(0.24, 66, 0.12, 'sawtooth')
  }

  playerHit() {
    this.noiseBurst(0.32, 260, 0.2, 'lowpass')
    this.pulse(0.4, 47, 0.16, 'sawtooth')
  }

  death() {
    if (!this.ctx) return
    this.noiseBurst(2.4, 340, 0.2, 'lowpass')
    this.pulse(3.4, 30, 0.2, 'sawtooth')
  }

  victory() {
    if (!this.ctx) return
    const notes = [196, 246.94, 293.66, 392]
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.pulse(2.8, freq, 0.035, 'sine')
        this.pulse(2.8, freq * 2, 0.012, 'triangle')
      }, i * 260)
    })
  }

  creak() {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(85 + Math.random() * 70, now)
    osc.frequency.linearRampToValueAtTime(45 + Math.random() * 40, now + 1.4)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.022, now + 0.2)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start()
    osc.stop(now + 1.7)
    this.noiseBurst(0.7, 900, 0.012, 'bandpass', 4)
  }

  update(dt, danger) {
    if (!this.ctx) return
    this.danger += (danger - this.danger) * Math.min(1, dt * 2)
    this.heartTimer -= dt
    if (this.danger > 0.16 && this.heartTimer <= 0) {
      this.heartbeat(Math.min(1, this.danger))
      this.heartTimer = 1.25 - this.danger * 0.65
    }
    if (this.enemyGrowlGain) {
      const target = this.danger > 0.05 ? Math.min(0.13, 0.02 + this.danger * 0.13) : 0
      this.enemyGrowlGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25)
    }
    if (this.enemyGrowlOsc) {
      this.enemyGrowlOsc.frequency.setTargetAtTime(44 + Math.sin(performance.now() * 0.001) * 3, this.ctx.currentTime, 0.2)
    }
    this.creakTimer -= dt
    if (this.creakTimer <= 0) {
      this.creak()
      this.creakTimer = 13 + Math.random() * 18
    }
  }
}
