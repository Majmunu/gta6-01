// All sound is synthesised with WebAudio — no audio files, no network.
// Engine hum, sirens, gunshots, punches, pickups and mission jingles.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.muted = false;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // Looping engine: two detuned saws through a lowpass, gain by speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 28;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();

    // Two-tone police siren.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this._sirenPhase = 0;
  }

  setEngine(speedRatio, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speedRatio * 0.09 : 0, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + speedRatio * 165, t, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(26 + speedRatio * 82, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(380 + speedRatio * 1400, t, 0.1);
  }

  setSiren(on, dt) {
    if (!this.ctx) return;
    this.sirenOn = on;
    if (!on) {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    this._sirenPhase += dt;
    const hi = Math.sin(this._sirenPhase * Math.PI * 2 * 0.9) > 0;
    this.sirenOsc.frequency.setTargetAtTime(hi ? 880 : 620, this.ctx.currentTime, 0.03);
    this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.1);
  }

  _noiseBurst(duration, filterFreq, gain) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }

  _tone(freq, duration, type, gain, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + duration + 0.02);
  }

  shot() { this._noiseBurst(0.14, 2400, 0.5); this._tone(160, 0.1, 'square', 0.25, 60); }
  punch() { this._noiseBurst(0.09, 500, 0.45); this._tone(90, 0.08, 'sine', 0.3, 50); }
  pickup() { this._tone(660, 0.09, 'sine', 0.25); this._tone(990, 0.12, 'sine', 0.22); }
  cash() { this._tone(880, 0.08, 'triangle', 0.25); this._tone(1320, 0.14, 'triangle', 0.2); }
  click() { this._tone(520, 0.05, 'square', 0.12); }
  door() { this._noiseBurst(0.08, 900, 0.25); }
  crash() { this._noiseBurst(0.25, 700, 0.6); this._tone(70, 0.2, 'sine', 0.4, 40); }
  busted() { this._tone(440, 0.25, 'sawtooth', 0.2, 220); this._tone(330, 0.4, 'sawtooth', 0.2, 165); }
  missionDone() {
    if (!this.ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.22, 'triangle', 0.28), i * 110);
    });
  }
  missionFail() { this._tone(392, 0.3, 'sawtooth', 0.2, 196); }
}
