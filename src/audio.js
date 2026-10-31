// Tiny procedural sound engine — no audio files required.

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.lastStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.42;
    this.master.connect(this.ctx.destination);

    const length = Math.floor(this.ctx.sampleRate * 1.2);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.05);
    }
  }

  tone({ freq = 220, endFreq = freq, duration = 0.2, type = 'sine', gain = 0.3, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noise({ duration = 0.2, freq = 800, q = 0.8, gain = 0.3, delay = 0, type = 'bandpass' }) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  breakBlock(kind = 'soft') {
    this.ensure();
    const table = {
      soft: { freq: 620, q: 0.7, gain: 0.26, thump: 90 },
      hard: { freq: 1500, q: 1.1, gain: 0.24, thump: 140 },
      wood: { freq: 900, q: 1.4, gain: 0.28, thump: 110 },
      leaf: { freq: 2600, q: 0.5, gain: 0.16, thump: 0 },
      glass: { freq: 3200, q: 2.2, gain: 0.2, thump: 0 },
    };
    const s = table[kind] ?? table.soft;
    this.noise({ duration: 0.16, freq: s.freq, q: s.q, gain: s.gain });
    if (s.thump) this.tone({ freq: s.thump, endFreq: s.thump * 0.55, duration: 0.12, gain: 0.16, type: 'sine' });
    if (kind === 'glass') {
      this.tone({ freq: 2400, endFreq: 1800, duration: 0.12, gain: 0.06, type: 'triangle' });
    }
  }

  placeBlock(kind = 'soft') {
    this.ensure();
    const freq = kind === 'wood' ? 320 : kind === 'hard' ? 480 : 260;
    this.noise({ duration: 0.09, freq: 900, q: 0.9, gain: 0.12 });
    this.tone({ freq, endFreq: freq * 0.7, duration: 0.08, gain: 0.1, type: 'sine' });
  }

  step(kind = 'soft') {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.currentTime - this.lastStep < 0.16) return;
    this.lastStep = this.ctx.currentTime;
    const freq = kind === 'hard' ? 900 : kind === 'wood' ? 600 : 420;
    this.noise({ duration: 0.055, freq, q: 0.6, gain: 0.055 });
  }

  jump() {
    this.ensure();
    this.tone({ freq: 180, endFreq: 260, duration: 0.1, gain: 0.05, type: 'sine' });
  }

  splash() {
    this.ensure();
    this.noise({ duration: 0.35, freq: 700, q: 0.4, gain: 0.14, type: 'lowpass' });
  }

  click() {
    this.ensure();
    this.tone({ freq: 520, endFreq: 760, duration: 0.06, gain: 0.05, type: 'triangle' });
  }
}
