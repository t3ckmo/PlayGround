// Tiny procedural sound kit. Everything is synthesized with WebAudio so the
// game ships with zero audio assets.
export class SoundKit {
  constructor() {
    this.ctx = null
    this.master = null
    this.noise = null
    this.muted = false
    this.lastStep = 0
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
      return
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    try {
      this.ctx = new AudioContextClass()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.22
      this.master.connect(this.ctx.destination)
      const length = Math.floor(this.ctx.sampleRate * 0.35)
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    } catch {
      this.ctx = null
    }
  }

  toggleMute() {
    this.muted = !this.muted
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.22
    return this.muted
  }

  _ready() {
    return this.ctx && !this.muted && this.ctx.state === 'running'
  }

  _noiseBurst({ duration = 0.12, frequency = 900, q = 1.2, volume = 0.5, filterType = 'bandpass' }) {
    if (!this._ready()) return
    const now = this.ctx.currentTime
    const source = this.ctx.createBufferSource()
    source.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = filterType
    filter.frequency.setValueAtTime(frequency, now)
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.35), now + duration)
    filter.Q.value = q
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start(now)
    source.stop(now + duration + 0.02)
  }

  _tone({ frequency = 220, endFrequency = 120, duration = 0.12, volume = 0.2, type = 'triangle' }) {
    if (!this._ready()) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), now + duration)
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  }

  breakBlock(block) {
    const hardness = block?.liquid ? 0.2 : 1
    this._noiseBurst({
      duration: 0.12 + hardness * 0.05,
      frequency: 700 + Math.random() * 500,
      q: 0.9,
      volume: 0.45
    })
    this._tone({ frequency: 150 + Math.random() * 60, endFrequency: 70, duration: 0.1, volume: 0.22 })
  }

  placeBlock() {
    this._tone({ frequency: 240, endFrequency: 140, duration: 0.07, volume: 0.2, type: 'square' })
    this._noiseBurst({ duration: 0.06, frequency: 1200, q: 1.5, volume: 0.18 })
  }

  step() {
    const now = performance.now()
    if (now - this.lastStep < 150) return
    this.lastStep = now
    this._noiseBurst({ duration: 0.05, frequency: 340 + Math.random() * 220, q: 0.8, volume: 0.12, filterType: 'lowpass' })
  }

  jump() {
    this._tone({ frequency: 320, endFrequency: 180, duration: 0.09, volume: 0.1 })
  }

  land() {
    this._noiseBurst({ duration: 0.09, frequency: 220, q: 0.7, volume: 0.2, filterType: 'lowpass' })
  }
}
