/**
 * Layers.ts
 *
 * Four independent timbral layers for the Leelulz Drone Manufacturing Plant.
 *
 *  1. SubLayer           – sine bass, slow pitch drift, subtle saturation
 *  2. MidCinematicLayer  – detuned saws, LPF, fast envelope
 *  3. IndustrialTextureLayer – pink noise, BPF, distortion, AM
 *  4. SciFiAirLayer      – triangle shimmer, slow panning, algorithmic reverb
 *
 * Design: oscillators/sources are started ONCE and never stopped.
 * stop() only ramps the layer gain to 0; start() ramps it back up.
 * This allows instant, click-free stop/start cycling.
 */

import * as Tone from 'tone'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Sub Layer
// ─────────────────────────────────────────────────────────────────────────────

export class SubLayer {
  private readonly osc: Tone.Oscillator
  private readonly saturation: Tone.Distortion
  private readonly levelGain: Tone.Gain
  private readonly pitchLFO: Tone.LFO

  private baseFreq = 42
  private _started = false

  constructor() {
    this.osc = new Tone.Oscillator({ type: 'sine', frequency: this.baseFreq })
    this.saturation = new Tone.Distortion({ distortion: 0.04, oversample: '4x' })
    this.levelGain = new Tone.Gain(0)
    this.pitchLFO = new Tone.LFO({ frequency: 0.01, min: -6, max: 6, type: 'sine' })

    this.osc.connect(this.saturation)
    this.saturation.connect(this.levelGain)
    this.pitchLFO.connect(this.osc.frequency as unknown as Tone.InputNode)
  }

  connect(destination: Tone.InputNode): this {
    this.levelGain.connect(destination)
    return this
  }

  start(): void {
    if (!this._started) {
      this.osc.start()
      this.pitchLFO.start()
      this._started = true
    }
    this.levelGain.gain.rampTo(0.32, 0.6)
  }

  stop(): void {
    // Only mute – oscillators keep running so restart is instant
    this.levelGain.gain.rampTo(0, 0.35)
  }

  // ── Parameter controls ────────────────────────────────────────────────────

  setBaseFrequency(hz: number, ramp = 4): void {
    this.baseFreq = Math.max(1, hz)
    this.osc.frequency.rampTo(this.baseFreq, ramp)
  }

  setLevel(value: number, ramp = 1): void {
    this.levelGain.gain.rampTo(Math.max(0, value), ramp)
  }

  setPitchLFORate(hz: number): void {
    this.pitchLFO.frequency.rampTo(Math.max(0.005, Math.min(0.1, hz)), 2)
  }

  setPitchLFODepth(halfRange: number): void {
    this.pitchLFO.min = -halfRange
    this.pitchLFO.max = halfRange
  }

  /** Saturation/distortion amount 0–1 (maps to 0–0.9). */
  setDistortionAmount(amount: number): void {
    this.saturation.distortion = Math.max(0, Math.min(0.9, amount * 0.9))
  }

  dispose(): void {
    this.osc.dispose()
    this.saturation.dispose()
    this.levelGain.dispose()
    this.pitchLFO.dispose()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Mid Cinematic Layer
// ─────────────────────────────────────────────────────────────────────────────

export class MidCinematicLayer {
  private readonly osc1: Tone.Oscillator
  private readonly osc2: Tone.Oscillator
  private readonly filter: Tone.Filter
  private readonly envelope: Tone.AmplitudeEnvelope
  private readonly levelGain: Tone.Gain
  private readonly filterLFO: Tone.LFO

  private baseFreq = 80
  private _started = false

  constructor() {
    this.osc1 = new Tone.Oscillator({ type: 'sawtooth', frequency: this.baseFreq })
    this.osc2 = new Tone.Oscillator({ type: 'sawtooth', frequency: this.baseFreq })

    this.osc1.detune.value = -8
    this.osc2.detune.value = 8

    this.filter = new Tone.Filter({ type: 'lowpass', frequency: 500, Q: 1.2 })

    // Shorter envelope for responsive stop/start
    this.envelope = new Tone.AmplitudeEnvelope({
      attack: 1.5,
      attackCurve: 'linear',
      decay: 0.1,
      sustain: 1,
      release: 2.5,
      releaseCurve: 'exponential',
    })

    this.levelGain = new Tone.Gain(0.42)
    this.filterLFO = new Tone.LFO({ frequency: 0.03, min: -120, max: 120, type: 'sine' })

    this.osc1.connect(this.filter)
    this.osc2.connect(this.filter)
    this.filter.connect(this.envelope)
    this.envelope.connect(this.levelGain)
    this.filterLFO.connect(this.filter.frequency as unknown as Tone.InputNode)
  }

  connect(destination: Tone.InputNode): this {
    this.levelGain.connect(destination)
    return this
  }

  start(): void {
    if (!this._started) {
      this.osc1.start()
      this.osc2.start()
      this.filterLFO.start()
      this._started = true
    }
    this.envelope.triggerAttack()
  }

  stop(): void {
    this.envelope.triggerRelease()
    // Oscillators stay running for fast restart
  }

  // ── Parameter controls ────────────────────────────────────────────────────

  setBaseFrequency(hz: number, ramp = 4): void {
    this.baseFreq = Math.max(1, hz)
    this.osc1.frequency.rampTo(this.baseFreq, ramp)
    this.osc2.frequency.rampTo(this.baseFreq, ramp)
  }

  setDetune(cents: number, ramp = 2): void {
    const half = cents / 2
    this.osc1.detune.rampTo(-half, ramp)
    this.osc2.detune.rampTo(half, ramp)
  }

  setFilterFrequency(hz: number, ramp = 2): void {
    const safeHz = Math.max(20, hz)
    const safeRamp = Math.max(0.05, ramp)
    this.filter.frequency.rampTo(safeHz, safeRamp)
  }

  setFilterLFORate(hz: number): void {
    this.filterLFO.frequency.rampTo(Math.max(0.005, Math.min(0.1, hz)), 2)
  }

  setFilterLFODepth(halfRange: number): void {
    this.filterLFO.min = -halfRange
    this.filterLFO.max = halfRange
  }

  dispose(): void {
    this.osc1.dispose()
    this.osc2.dispose()
    this.filter.dispose()
    this.envelope.dispose()
    this.levelGain.dispose()
    this.filterLFO.dispose()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Industrial Texture Layer
// ─────────────────────────────────────────────────────────────────────────────

export class IndustrialTextureLayer {
  private readonly noise: Tone.Noise
  private readonly bpFilter: Tone.Filter
  private readonly distortion: Tone.Distortion
  private readonly amGain: Tone.Gain
  private readonly levelGain: Tone.Gain
  private readonly amLFO: Tone.LFO

  private _started = false

  constructor() {
    this.noise = new Tone.Noise({ type: 'pink' })
    this.bpFilter = new Tone.Filter({ type: 'bandpass', frequency: 700, Q: 2.5 })
    this.distortion = new Tone.Distortion({ distortion: 0.18, oversample: '2x' })
    this.amGain = new Tone.Gain(0.6)
    this.levelGain = new Tone.Gain(0)
    this.amLFO = new Tone.LFO({ frequency: 0.02, min: -0.25, max: 0.25, type: 'sine' })

    this.noise.connect(this.bpFilter)
    this.bpFilter.connect(this.distortion)
    this.distortion.connect(this.amGain)
    this.amGain.connect(this.levelGain)
    this.amLFO.connect(this.amGain.gain as unknown as Tone.InputNode)
  }

  connect(destination: Tone.InputNode): this {
    this.levelGain.connect(destination)
    return this
  }

  start(): void {
    if (!this._started) {
      this.noise.start()
      this.amLFO.start()
      this._started = true
    }
    this.levelGain.gain.rampTo(0.06, 0.8)
  }

  stop(): void {
    this.levelGain.gain.rampTo(0, 0.35)
  }

  // ── Parameter controls ────────────────────────────────────────────────────

  setLevel(value: number, ramp = 1): void {
    this.levelGain.gain.rampTo(Math.max(0, value), ramp)
  }

  setBandFrequency(hz: number, ramp = 2): void {
    this.bpFilter.frequency.rampTo(Math.max(20, hz), ramp)
  }

  setAMLFORate(hz: number): void {
    this.amLFO.frequency.rampTo(Math.max(0.005, Math.min(0.1, hz)), 2)
  }

  /** Distortion grit amount 0–1. */
  setDistortionAmount(amount: number): void {
    this.distortion.distortion = Math.max(0, Math.min(1, amount))
  }

  /** Band-pass Q factor. Higher = more resonant/aggressive. */
  setBandQ(q: number): void {
    this.bpFilter.Q.rampTo(Math.max(0.5, Math.min(12, q)), 2)
  }

  dispose(): void {
    this.noise.dispose()
    this.bpFilter.dispose()
    this.distortion.dispose()
    this.amGain.dispose()
    this.levelGain.dispose()
    this.amLFO.dispose()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Sci-Fi Air Layer
// ─────────────────────────────────────────────────────────────────────────────

export class SciFiAirLayer {
  private readonly osc: Tone.Oscillator
  private readonly panner: Tone.Panner
  // Freeverb: instant init (algorithmic, no IR generation)
  private readonly layerReverb: Tone.Freeverb
  private readonly levelGain: Tone.Gain
  private readonly panLFO: Tone.LFO
  private readonly shimmerLFO: Tone.LFO

  private _started = false

  constructor() {
    this.osc = new Tone.Oscillator({ type: 'triangle', frequency: 320 })
    this.panner = new Tone.Panner(0)
    this.layerReverb = new Tone.Freeverb({ roomSize: 0.9, dampening: 1800, wet: 0.72 })
    this.levelGain = new Tone.Gain(0)

    this.panLFO = new Tone.LFO({ frequency: 0.018, min: -0.85, max: 0.85, type: 'sine' })
    this.shimmerLFO = new Tone.LFO({ frequency: 0.05, min: -3, max: 3, type: 'sine' })

    this.osc.connect(this.panner)
    this.panner.connect(this.layerReverb)
    this.layerReverb.connect(this.levelGain)

    this.panLFO.connect(this.panner.pan as unknown as Tone.InputNode)
    this.shimmerLFO.connect(this.osc.frequency as unknown as Tone.InputNode)
  }

  connect(destination: Tone.InputNode): this {
    this.levelGain.connect(destination)
    return this
  }

  start(): void {
    if (!this._started) {
      this.osc.start()
      this.panLFO.start()
      this.shimmerLFO.start()
      this._started = true
    }
    this.levelGain.gain.rampTo(0.16, 0.8)
  }

  stop(): void {
    this.levelGain.gain.rampTo(0, 0.35)
  }

  // ── Parameter controls ────────────────────────────────────────────────────

  setBaseFrequency(hz: number, ramp = 4): void {
    this.osc.frequency.rampTo(Math.max(1, hz), ramp)
  }

  setLevel(value: number, ramp = 1): void {
    this.levelGain.gain.rampTo(Math.max(0, value), ramp)
  }

  setPanLFORate(hz: number): void {
    this.panLFO.frequency.rampTo(Math.max(0.005, Math.min(0.1, hz)), 2)
  }

  setShimmerDepth(halfRange: number): void {
    this.shimmerLFO.min = -halfRange
    this.shimmerLFO.max = halfRange
  }

  /** Per-layer reverb wet mix 0–1. */
  setReverbWet(wet: number): void {
    this.layerReverb.wet.rampTo(Math.max(0, Math.min(1, wet)), 2)
  }

  dispose(): void {
    this.osc.dispose()
    this.panner.dispose()
    this.layerReverb.dispose()
    this.levelGain.dispose()
    this.panLFO.dispose()
    this.shimmerLFO.dispose()
  }
}
