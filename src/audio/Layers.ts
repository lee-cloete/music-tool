/**
 * Layers.ts
 *
 * Four independent timbral layers for the Cinematic Drone Engine:
 *
 *  1. SubLayer           – sine bass, slow pitch drift, subtle saturation
 *  2. MidCinematicLayer  – detuned saws, LPF, long envelope
 *  3. IndustrialTextureLayer – pink noise, BPF, distortion, AM
 *  4. SciFiAirLayer      – triangle shimmer, slow panning, extra reverb
 *
 * Each layer exposes connect(), start(), stop(), and dispose().
 * Gain control is split into two nodes so that a level-control ramp
 * and an LFO (where applicable) never interfere.
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

  // Keep base freq so modulation can offset it
  private baseFreq = 42

  constructor() {
    this.osc = new Tone.Oscillator({ type: 'sine', frequency: this.baseFreq })

    // Very subtle saturation (tape-warm character)
    this.saturation = new Tone.Distortion({ distortion: 0.04, oversample: '4x' })

    this.levelGain = new Tone.Gain(0)

    // Pitch drift: 0.01 Hz, ±6 Hz around centre
    this.pitchLFO = new Tone.LFO({ frequency: 0.01, min: -6, max: 6, type: 'sine' })

    // Signal chain
    this.osc.connect(this.saturation)
    this.saturation.connect(this.levelGain)

    // Additive LFO on frequency signal
    this.pitchLFO.connect(this.osc.frequency as unknown as Tone.InputNode)
  }

  connect(destination: Tone.InputNode): this {
    this.levelGain.connect(destination)
    return this
  }

  start(): void {
    this.osc.start()
    this.pitchLFO.start()
    this.levelGain.gain.rampTo(0.28, 3)
  }

  stop(): void {
    this.levelGain.gain.rampTo(0, 3)
    // Stop sources after fade
    const stopTime = Tone.now() + 3.5
    this.osc.stop(stopTime)
    this.pitchLFO.stop(stopTime)
  }

  // ── Parameter controls ────────────────────────────────────────────────────

  setBaseFrequency(hz: number, ramp = 6): void {
    this.baseFreq = hz
    this.osc.frequency.rampTo(hz, ramp)
  }

  setLevel(value: number, ramp = 2): void {
    this.levelGain.gain.rampTo(value, ramp)
  }

  /** Set LFO rate (Hz) – must stay 0.005–0.1 */
  setPitchLFORate(hz: number): void {
    this.pitchLFO.frequency.rampTo(Math.max(0.005, Math.min(0.1, hz)), 4)
  }

  /** Depth: half-range in Hz (e.g. 10 → ±10 Hz) */
  setPitchLFODepth(halfRange: number): void {
    this.pitchLFO.min = -halfRange
    this.pitchLFO.max = halfRange
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

  constructor() {
    this.osc1 = new Tone.Oscillator({ type: 'sawtooth', frequency: this.baseFreq })
    this.osc2 = new Tone.Oscillator({ type: 'sawtooth', frequency: this.baseFreq })

    // Default detune ±8 cents
    this.osc1.detune.value = -8
    this.osc2.detune.value = 8

    this.filter = new Tone.Filter({ type: 'lowpass', frequency: 500, Q: 1.2 })

    // Long cinematic envelope
    this.envelope = new Tone.AmplitudeEnvelope({
      attack: 6,
      attackCurve: 'linear',
      decay: 0.1,
      sustain: 1,
      release: 10,
      releaseCurve: 'exponential',
    })

    this.levelGain = new Tone.Gain(0.38)

    // Slow filter sweep: 0.03 Hz, ±120 Hz around centre
    this.filterLFO = new Tone.LFO({ frequency: 0.03, min: -120, max: 120, type: 'sine' })

    // Signal chain
    this.osc1.connect(this.filter)
    this.osc2.connect(this.filter)
    this.filter.connect(this.envelope)
    this.envelope.connect(this.levelGain)

    // Additive LFO on filter frequency
    this.filterLFO.connect(this.filter.frequency as unknown as Tone.InputNode)
  }

  connect(destination: Tone.InputNode): this {
    this.levelGain.connect(destination)
    return this
  }

  start(): void {
    this.osc1.start()
    this.osc2.start()
    this.filterLFO.start()
    this.envelope.triggerAttack()
  }

  stop(): void {
    this.envelope.triggerRelease()
    // Give the release time to complete before cutting sources
    const stopTime = Tone.now() + 12
    this.osc1.stop(stopTime)
    this.osc2.stop(stopTime)
    this.filterLFO.stop(stopTime)
  }

  // ── Parameter controls ────────────────────────────────────────────────────

  setBaseFrequency(hz: number, ramp = 6): void {
    this.baseFreq = hz
    this.osc1.frequency.rampTo(hz, ramp)
    this.osc2.frequency.rampTo(hz, ramp)
  }

  /** Amount in cents (applied symmetrically ±cents/2 each oscillator) */
  setDetune(cents: number, ramp = 4): void {
    const half = cents / 2
    this.osc1.detune.rampTo(-half, ramp)
    this.osc2.detune.rampTo(half, ramp)
  }

  setFilterFrequency(hz: number, ramp = 4): void {
    this.filter.frequency.rampTo(hz, ramp)
  }

  setFilterLFORate(hz: number): void {
    this.filterLFO.frequency.rampTo(Math.max(0.005, Math.min(0.1, hz)), 4)
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
  // amGain is modulated by the LFO (additive), levelGain controls fade in/out
  private readonly amGain: Tone.Gain
  private readonly levelGain: Tone.Gain
  private readonly amLFO: Tone.LFO

  constructor() {
    this.noise = new Tone.Noise({ type: 'pink' })

    this.bpFilter = new Tone.Filter({ type: 'bandpass', frequency: 700, Q: 2.5 })

    // Light grit
    this.distortion = new Tone.Distortion({ distortion: 0.18, oversample: '2x' })

    // amGain base 0.6; LFO adds ±0.25 → oscillates 0.35–0.85
    this.amGain = new Tone.Gain(0.6)

    // Overall level (very low – texture only)
    this.levelGain = new Tone.Gain(0)

    // AM: 0.02 Hz sine
    this.amLFO = new Tone.LFO({ frequency: 0.02, min: -0.25, max: 0.25, type: 'sine' })

    // Signal chain
    this.noise.connect(this.bpFilter)
    this.bpFilter.connect(this.distortion)
    this.distortion.connect(this.amGain)
    this.amGain.connect(this.levelGain)

    // Additive AM LFO on inner gain
    this.amLFO.connect(this.amGain.gain as unknown as Tone.InputNode)
  }

  connect(destination: Tone.InputNode): this {
    this.levelGain.connect(destination)
    return this
  }

  start(): void {
    this.noise.start()
    this.amLFO.start()
    this.levelGain.gain.rampTo(0.06, 4)
  }

  stop(): void {
    this.levelGain.gain.rampTo(0, 2)
    const stopTime = Tone.now() + 2.5
    this.noise.stop(stopTime)
    this.amLFO.stop(stopTime)
  }

  // ── Parameter controls ────────────────────────────────────────────────────

  setLevel(value: number, ramp = 2): void {
    this.levelGain.gain.rampTo(value, ramp)
  }

  setBandFrequency(hz: number, ramp = 4): void {
    this.bpFilter.frequency.rampTo(hz, ramp)
  }

  setAMLFORate(hz: number): void {
    this.amLFO.frequency.rampTo(Math.max(0.005, Math.min(0.1, hz)), 4)
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
  // Per-layer long reverb – makes this layer noticeably more spacious
  private readonly layerReverb: Tone.Reverb
  private readonly levelGain: Tone.Gain
  private readonly panLFO: Tone.LFO
  private readonly shimmerLFO: Tone.LFO

  /** Promise that resolves when the impulse response is ready. */
  readonly ready: Promise<void>

  constructor() {
    this.osc = new Tone.Oscillator({ type: 'triangle', frequency: 320 })

    this.panner = new Tone.Panner(0)

    this.layerReverb = new Tone.Reverb({ decay: 14, wet: 0.75, preDelay: 0.05 })

    this.levelGain = new Tone.Gain(0)

    // Pan LFO: 0.02 Hz, full stereo sweep
    this.panLFO = new Tone.LFO({ frequency: 0.018, min: -0.85, max: 0.85, type: 'sine' })

    // Shimmer: 0.05 Hz, ±3 Hz frequency detune
    this.shimmerLFO = new Tone.LFO({ frequency: 0.05, min: -3, max: 3, type: 'sine' })

    // Signal chain: osc → panner → reverb → levelGain → [output]
    this.osc.connect(this.panner)
    this.panner.connect(this.layerReverb)
    this.layerReverb.connect(this.levelGain)

    // LFOs
    this.panLFO.connect(this.panner.pan as unknown as Tone.InputNode)
    this.shimmerLFO.connect(this.osc.frequency as unknown as Tone.InputNode)

    this.ready = this.layerReverb.ready
  }

  connect(destination: Tone.InputNode): this {
    this.levelGain.connect(destination)
    return this
  }

  start(): void {
    this.osc.start()
    this.panLFO.start()
    this.shimmerLFO.start()
    this.levelGain.gain.rampTo(0.14, 6)
  }

  stop(): void {
    this.levelGain.gain.rampTo(0, 5)
    const stopTime = Tone.now() + 5.5
    this.osc.stop(stopTime)
    this.panLFO.stop(stopTime)
    this.shimmerLFO.stop(stopTime)
  }

  // ── Parameter controls ────────────────────────────────────────────────────

  setBaseFrequency(hz: number, ramp = 8): void {
    this.osc.frequency.rampTo(hz, ramp)
  }

  setLevel(value: number, ramp = 4): void {
    this.levelGain.gain.rampTo(value, ramp)
  }

  setPanLFORate(hz: number): void {
    this.panLFO.frequency.rampTo(Math.max(0.005, Math.min(0.1, hz)), 4)
  }

  setShimmerDepth(halfRange: number): void {
    this.shimmerLFO.min = -halfRange
    this.shimmerLFO.max = halfRange
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
