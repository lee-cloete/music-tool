/**
 * DroneEngine.ts
 *
 * Central orchestrator for the Cinematic Drone Engine.
 *
 * Signal chain:
 *   All Layers → masterGain → masterFilter → masterReverb → masterLimiter → Destination
 *
 * Public API:
 *   start()                  – resume AudioContext + begin all layers
 *   stop()                   – graceful fade of all layers
 *   setVolume(0–1)           – master output level
 *   setDarkness(0–1)         – filter cutoff (0=bright, 1=dark)
 *   setMotion(0–1)           – modulation depth & speed
 *   setDensity(0–1)          – detuning, layer richness
 *   randomize()              – smooth-randomise all timbral parameters
 *   savePreset(name)         – persist current state to localStorage
 *   loadPreset(name) → bool  – restore state from localStorage
 *   getPresetNames() → str[] – list saved presets
 *   deletePreset(name)       – remove from localStorage
 *   isRunning → boolean
 *
 * Recording API (real-time capture → browser download):
 *   startRecording()         – tap post-limiter signal into MediaRecorder
 *   stopRecording() → blob  – finalise and auto-download timestamped file
 *   isRecording → boolean
 */

import * as Tone from 'tone'
import { SubLayer, MidCinematicLayer, IndustrialTextureLayer, SciFiAirLayer } from './Layers'
import { RandomWalkModulator } from './Modulators'
import { RecordingEngine } from './RecordingEngine'

// ─────────────────────────────────────────────────────────────────────────────
// Preset schema
// ─────────────────────────────────────────────────────────────────────────────

export interface DronePreset {
  name: string
  volume: number
  darkness: number
  motion: number
  density: number
  subFreq: number
  midFreq: number
  airFreq: number
}

const PRESET_STORAGE_KEY = 'drone-engine-presets'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map darkness (0–1) to a filter cutoff frequency in Hz.
 * Uses a logarithmic scale for perceptually uniform adjustment.
 * darkness=0 → 2 400 Hz (bright)
 * darkness=1 → 60 Hz   (very dark)
 */
function darknessToCutoff(d: number): number {
  const brightHz = 2400
  const darkHz = 60
  // Exponential interpolation
  return brightHz * Math.pow(darkHz / brightHz, d)
}

/**
 * Map motion (0–1) to an LFO rate within 0.005–0.08 Hz.
 * Higher motion → faster modulation (still non-rhythmic).
 */
function motionToRate(m: number): number {
  return 0.005 + m * 0.075
}

/** Clamp a number to [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ─────────────────────────────────────────────────────────────────────────────
// DroneEngine
// ─────────────────────────────────────────────────────────────────────────────

export class DroneEngine {
  // ── State ─────────────────────────────────────────────────────────────────
  private _initialized = false
  private _running = false

  private _volume = 0.7
  private _darkness = 0.45
  private _motion = 0.4
  private _density = 0.45

  // ── Master chain nodes (created lazily in _initialize) ────────────────────
  private masterGain!: Tone.Gain
  private masterFilter!: Tone.Filter
  private masterReverb!: Tone.Reverb
  private masterLimiter!: Tone.Limiter

  // ── Layers ────────────────────────────────────────────────────────────────
  private subLayer!: SubLayer
  private midLayer!: MidCinematicLayer
  private industrialLayer!: IndustrialTextureLayer
  private sciFiLayer!: SciFiAirLayer

  // ── Modulators (random-walk) ──────────────────────────────────────────────
  private subPitchWalker!: RandomWalkModulator
  private airFreqWalker!: RandomWalkModulator
  private industrialBandWalker!: RandomWalkModulator

  // ── Recording ─────────────────────────────────────────────────────────────
  private readonly recEngine = new RecordingEngine()

  // ── Per-parameter cache for preset/randomize ──────────────────────────────
  private _subFreq = 42
  private _midFreq = 80
  private _airFreq = 320

  // ── Public read-only state ────────────────────────────────────────────────
  get isRunning(): boolean {
    return this._running
  }
  get isInitialized(): boolean {
    return this._initialized
  }

  get isRecording(): boolean {
    return this.recEngine.isRecording
  }

  get recordingElapsed(): number {
    return this.recEngine.elapsedSeconds
  }

  get currentParams() {
    return {
      volume: this._volume,
      darkness: this._darkness,
      motion: this._motion,
      density: this._density,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create all Tone.js nodes and wire the signal graph.
   * Must be called after a user gesture (inside start() is fine).
   * Safe to call multiple times – only runs once.
   */
  private async _initialize(): Promise<void> {
    if (this._initialized) return

    // ── Master signal chain ────────────────────────────────────────────────
    this.masterGain = new Tone.Gain(this._volume)
    this.masterFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: darknessToCutoff(this._darkness),
      Q: 0.8,
    })
    this.masterReverb = new Tone.Reverb({ decay: 12, wet: 0.42, preDelay: 0.08 })
    this.masterLimiter = new Tone.Limiter(-2)

    // ── Layers ──────────────────────────────────────────────────────────────
    this.subLayer = new SubLayer()
    this.midLayer = new MidCinematicLayer()
    this.industrialLayer = new IndustrialTextureLayer()
    this.sciFiLayer = new SciFiAirLayer()

    // ── Connect layers → master chain → destination ────────────────────────
    this.subLayer.connect(this.masterGain)
    this.midLayer.connect(this.masterGain)
    this.industrialLayer.connect(this.masterGain)
    this.sciFiLayer.connect(this.masterGain)

    this.masterGain
      .connect(this.masterFilter)
    this.masterFilter
      .connect(this.masterReverb)
    this.masterReverb
      .connect(this.masterLimiter)
    this.masterLimiter
      .toDestination()

    // ── Random-walk modulators ─────────────────────────────────────────────
    this.subPitchWalker = new RandomWalkModulator({
      min: 30,
      max: 60,
      initial: this._subFreq,
      stepFraction: 0.04,
      rateHz: 0.01,
      onValue: (hz) => {
        this._subFreq = hz
        this.subLayer.setBaseFrequency(hz, 8)
      },
    })

    this.airFreqWalker = new RandomWalkModulator({
      min: 260,
      max: 420,
      initial: this._airFreq,
      stepFraction: 0.05,
      rateHz: 0.008,
      onValue: (hz) => {
        this._airFreq = hz
        this.sciFiLayer.setBaseFrequency(hz, 10)
      },
    })

    this.industrialBandWalker = new RandomWalkModulator({
      min: 400,
      max: 1200,
      initial: 700,
      stepFraction: 0.06,
      rateHz: 0.012,
      onValue: (hz) => this.industrialLayer.setBandFrequency(hz, 5),
    })

    // ── Apply initial parameter state ──────────────────────────────────────
    this._applyDarkness(this._darkness, false)
    this._applyDensity(this._density, false)
    this._applyMotion(this._motion, false)

    // ── Await async nodes ──────────────────────────────────────────────────
    await Promise.all([
      this.masterReverb.ready,
      this.sciFiLayer.ready,
    ])

    this._initialized = true
  }

  /** Start the drone. Resumes AudioContext then starts all layers. */
  async start(): Promise<void> {
    if (this._running) return

    // MUST be called inside a user gesture handler
    await Tone.start()

    await this._initialize()

    this.subLayer.start()
    this.midLayer.start()
    this.industrialLayer.start()
    this.sciFiLayer.start()

    this.subPitchWalker.start()
    this.airFreqWalker.start()
    this.industrialBandWalker.start()

    this._running = true
  }

  /** Gracefully fade out all layers then mark as stopped. */
  stop(): void {
    if (!this._running) return

    this.subLayer.stop()
    this.midLayer.stop()
    this.industrialLayer.stop()
    this.sciFiLayer.stop()

    this.subPitchWalker.stop()
    this.airFreqWalker.stop()
    this.industrialBandWalker.stop()

    this._running = false
  }

  /**
   * Full teardown. Call when the instrument is unmounted.
   * A new DroneEngine instance should be created after dispose().
   */
  dispose(): void {
    this.stop()

    if (!this._initialized) return

    this.subLayer.dispose()
    this.midLayer.dispose()
    this.industrialLayer.dispose()
    this.sciFiLayer.dispose()

    this.masterGain.dispose()
    this.masterFilter.dispose()
    this.masterReverb.dispose()
    this.masterLimiter.dispose()

    this._initialized = false
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public control API
  // ─────────────────────────────────────────────────────────────────────────

  /** Master output volume (0–1). Ramped smoothly to avoid clicks. */
  setVolume(value: number): void {
    this._volume = clamp(value, 0, 1)
    if (!this._initialized) return
    this.masterGain.gain.rampTo(this._volume, 0.08)
  }

  /**
   * Darkness: 0 = bright (open filter), 1 = dark (closed filter).
   * Controls both the master filter and the mid-layer filter.
   */
  setDarkness(value: number): void {
    this._darkness = clamp(value, 0, 1)
    this._applyDarkness(this._darkness, true)
  }

  /**
   * Motion: 0 = nearly static, 1 = maximum allowed movement.
   * Scales all LFO rates and random-walk step sizes.
   */
  setMotion(value: number): void {
    this._motion = clamp(value, 0, 1)
    this._applyMotion(this._motion, true)
  }

  /**
   * Density: 0 = sparse/clean, 1 = dense/complex.
   * Controls detune spread, industrial level, sci-fi shimmer depth.
   */
  setDensity(value: number): void {
    this._density = clamp(value, 0, 1)
    this._applyDensity(this._density, true)
  }

  /**
   * Smooth-randomise all timbral parameters for a fresh soundscape.
   * Transitions are gradual so there are no discontinuities.
   */
  randomize(): void {
    const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

    const newDarkness = rand(0.2, 0.85)
    const newMotion = rand(0.1, 0.9)
    const newDensity = rand(0.1, 0.9)

    this._darkness = newDarkness
    this._motion = newMotion
    this._density = newDensity

    this._applyDarkness(newDarkness, true)
    this._applyMotion(newMotion, true)
    this._applyDensity(newDensity, true)

    if (!this._initialized) return

    // Randomise per-layer base frequencies
    const newSubFreq = rand(30, 60)
    const newMidFreq = rand(55, 130)
    const newAirFreq = rand(220, 480)

    this._subFreq = newSubFreq
    this._midFreq = newMidFreq
    this._airFreq = newAirFreq

    this.subLayer.setBaseFrequency(newSubFreq, 8)
    this.midLayer.setBaseFrequency(newMidFreq, 8)
    this.sciFiLayer.setBaseFrequency(newAirFreq, 10)

    // Update random-walk modulator ranges to stay around new freqs
    this.subPitchWalker.setRange(
      Math.max(28, newSubFreq - 12),
      Math.min(65, newSubFreq + 12),
    )
    this.airFreqWalker.setRange(
      Math.max(160, newAirFreq - 60),
      Math.min(560, newAirFreq + 60),
    )

    // Randomise reverb wet slightly
    const reverbWet = rand(0.3, 0.65)
    this.masterReverb.wet.rampTo(reverbWet, 6)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Preset system (localStorage)
  // ─────────────────────────────────────────────────────────────────────────

  savePreset(name: string): void {
    const presets = this._loadAllPresets()
    const preset: DronePreset = {
      name,
      volume: this._volume,
      darkness: this._darkness,
      motion: this._motion,
      density: this._density,
      subFreq: this._subFreq,
      midFreq: this._midFreq,
      airFreq: this._airFreq,
    }
    presets[name] = preset
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets))
  }

  loadPreset(name: string): boolean {
    const presets = this._loadAllPresets()
    const preset = presets[name]
    if (!preset) return false

    this._volume = preset.volume
    this._darkness = preset.darkness
    this._motion = preset.motion
    this._density = preset.density
    this._subFreq = preset.subFreq ?? this._subFreq
    this._midFreq = preset.midFreq ?? this._midFreq
    this._airFreq = preset.airFreq ?? this._airFreq

    this.setVolume(this._volume)
    this.setDarkness(this._darkness)
    this.setMotion(this._motion)
    this.setDensity(this._density)

    if (this._initialized) {
      this.subLayer.setBaseFrequency(this._subFreq, 6)
      this.midLayer.setBaseFrequency(this._midFreq, 6)
      this.sciFiLayer.setBaseFrequency(this._airFreq, 8)
    }

    return true
  }

  getPresetNames(): string[] {
    return Object.keys(this._loadAllPresets())
  }

  deletePreset(name: string): void {
    const presets = this._loadAllPresets()
    delete presets[name]
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Recording API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Tap the post-limiter output into a MediaRecorder.
   * The engine must be initialised (i.e. start() must have been called at
   * least once) before recording is possible.
   * Safe to call even while the drone is playing – no audible interruption.
   */
  startRecording(): void {
    if (!this._initialized) {
      console.warn('[DroneEngine] Cannot record before the engine is started.')
      return
    }
    this.recEngine.start(this.masterLimiter)
  }

  /**
   * Stop the MediaRecorder, finalize the Blob, and trigger a browser download.
   * Returns the raw Blob in case the caller wants to handle it differently.
   */
  async stopRecording(): Promise<Blob | null> {
    const blob = await this.recEngine.stop()
    if (blob) {
      RecordingEngine.download(blob, 'drone')
    }
    return blob
  }

  private _loadAllPresets(): Record<string, DronePreset> {
    try {
      const raw = localStorage.getItem(PRESET_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as Record<string, DronePreset>) : {}
    } catch {
      return {}
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal parameter application (works both pre- and post-init)
  // ─────────────────────────────────────────────────────────────────────────

  private _applyDarkness(d: number, ramp: boolean): void {
    if (!this._initialized) return
    const cutoff = darknessToCutoff(d)
    const time = ramp ? 3 : 0
    this.masterFilter.frequency.rampTo(cutoff, time)

    // Shift mid-layer filter in the same direction (but less dramatically)
    const midCutoff = darknessToCutoff(d * 0.7) * 0.5
    this.midLayer.setFilterFrequency(midCutoff, time)
  }

  private _applyMotion(m: number, ramp: boolean): void {
    if (!this._initialized) return
    const rate = motionToRate(m)
    const depth = 0.2 + m * 0.8 // 0.2–1.0 depth multiplier

    // LFO rates
    this.subLayer.setPitchLFORate(rate * 0.5) // sub drifts slower
    this.midLayer.setFilterLFORate(rate * 0.8)
    this.industrialLayer.setAMLFORate(rate * 0.6)
    this.sciFiLayer.setPanLFORate(rate * 0.7)

    // LFO depths
    this.subLayer.setPitchLFODepth(3 + depth * 9)        // ±3–12 Hz
    this.midLayer.setFilterLFODepth(40 + depth * 200)    // ±40–240 Hz
    this.sciFiLayer.setShimmerDepth(1 + depth * 5)       // ±1–6 Hz

    // Random-walk rates
    const walkRate = 0.005 + m * 0.015
    if (ramp) {
      this.subPitchWalker.setRate(walkRate)
      this.airFreqWalker.setRate(walkRate * 0.8)
      this.industrialBandWalker.setRate(walkRate * 1.2)
    }
  }

  private _applyDensity(d: number, _ramp: boolean): void {
    if (!this._initialized) return
    // Detune of mid saws (0 → 4 cents, 1 → 28 cents)
    const detuneCents = 4 + d * 24
    this.midLayer.setDetune(detuneCents)

    // Industrial layer level (very low even at max)
    const industrialLevel = 0.02 + d * 0.07
    this.industrialLayer.setLevel(industrialLevel)

    // Sci-fi shimmer depth
    const shimmer = 1 + d * 6
    this.sciFiLayer.setShimmerDepth(shimmer)
  }
}
