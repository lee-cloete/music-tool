
import * as Tone from 'tone'
import { SubLayer, MidCinematicLayer, IndustrialTextureLayer, SciFiAirLayer } from './Layers'
import { RandomWalkModulator } from './Modulators'
import { RecordingEngine } from './RecordingEngine'
import { PulseMachine } from './PulseMachine'


export type SoundMode = 'MANUAL' | 'VOID PRESSURE' | 'COSMIC DECAY' | 'STEEL FURNACE' | 'BLACK REACTOR'

export const SOUND_MODES: SoundMode[] = [
  'MANUAL',
  'VOID PRESSURE',
  'COSMIC DECAY',
  'STEEL FURNACE',
  'BLACK REACTOR',
]

interface ModePreset {
  darkness: number
  motion: number
  density: number
  grain: number
  rust: number
  hum: number
  fracture: number
  space: number
  pulse: number
}

const MODE_PRESETS: Record<Exclude<SoundMode, 'MANUAL'>, ModePreset> = {
  'VOID PRESSURE': {
    darkness: 0.9, motion: 0.12, density: 0.7,
    grain: 0.6, rust: 0.75, hum: 0.88, fracture: 0.05, space: 0.25, pulse: 0.36,
  },
  'COSMIC DECAY': {
    darkness: 0.18, motion: 0.82, density: 0.3,
    grain: 0.15, rust: 0.08, hum: 0.22, fracture: 0.72, space: 0.92, pulse: 0.08,
  },
  'STEEL FURNACE': {
    darkness: 0.55, motion: 0.58, density: 0.92,
    grain: 0.92, rust: 0.62, hum: 0.48, fracture: 0.18, space: 0.12, pulse: 0.56,
  },
  'BLACK REACTOR': {
    darkness: 0.78, motion: 0.17, density: 0.96,
    grain: 0.5, rust: 0.38, hum: 0.72, fracture: 0.45, space: 0.82, pulse: 0.28,
  },
}


export interface DronePreset {
  name: string
  volume: number
  darkness: number
  motion: number
  density: number
  subFreq: number
  midFreq: number
  airFreq: number
  grain?: number
  rust?: number
  hum?: number
  fracture?: number
  space?: number
  pulse?: number
  pureDrone?: boolean
  root?: number
  intervalSpread?: number
  mode?: SoundMode
}

const PRESET_STORAGE_KEY = 'drone-engine-presets'


function darknessToCutoff(d: number): number {
  const brightHz = 2400
  const darkHz = 60
  return brightHz * Math.pow(darkHz / brightHz, d)
}

function motionToRate(m: number): number {
  return 0.005 + m * 0.075
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function subToKickHz(subHz: number): number {
  return clamp(subHz * 1.22, 38, 90)
}

function rootToSubHz(root: number): number {
  return 34 + clamp(root, 0, 1) * 34
}


export class DroneEngine {
  private _initialized = false
  private _running = false

  private _volume = 0.85
  private _darkness = 0.45
  private _motion = 0.4
  private _density = 0.45

  private _grain = 0.3
  private _rust = 0.2
  private _hum = 0.4
  private _fracture = 0.15
  private _space = 0.45
  private _pulse = 0.18
  private _pureDrone = false
  private _root = 0.35
  private _intervalSpread = 0.4
  private _currentMode: SoundMode = 'MANUAL'

  private masterGain!: Tone.Gain
  private masterFilter!: Tone.Filter
  private masterReverb!: Tone.Freeverb
  private masterLimiter!: Tone.Limiter
  private analyser!: Tone.Analyser

  private subLayer!: SubLayer
  private midLayer!: MidCinematicLayer
  private industrialLayer!: IndustrialTextureLayer
  private sciFiLayer!: SciFiAirLayer
  private pulseMachine!: PulseMachine

  private subPitchWalker!: RandomWalkModulator
  private airFreqWalker!: RandomWalkModulator
  private industrialBandWalker!: RandomWalkModulator

  private readonly recEngine = new RecordingEngine()

  private _subFreq = 42
  private _midFreq = 80
  private _airFreq = 320
  private macroTimer: ReturnType<typeof setTimeout> | null = null

  get isRunning(): boolean {
    return this._running
  }
  get isInitialized(): boolean {
    return this._initialized
  }

    getFFTData(): Float32Array {
    if (!this._initialized) return new Float32Array(128).fill(-100)
    return this.analyser.getValue() as Float32Array
  }

  get isRecording(): boolean {
    return this.recEngine.isRecording
  }

  get recordingElapsed(): number {
    return this.recEngine.elapsedSeconds
  }

  get currentMode(): SoundMode {
    return this._currentMode
  }

  get currentParams() {
    return {
      volume: this._volume,
      darkness: this._darkness,
      motion: this._motion,
      density: this._density,
      grain: this._grain,
      rust: this._rust,
      hum: this._hum,
      fracture: this._fracture,
      space: this._space,
      pulse: this._pulse,
      pureDrone: this._pureDrone,
      root: this._root,
      intervalSpread: this._intervalSpread,
    }
  }


    private async _initialize(): Promise<void> {
    if (this._initialized) return

    this.masterGain = new Tone.Gain(this._volume)
    this.masterFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: Math.max(20, darknessToCutoff(this._darkness)),
      Q: 0.8,
    })
    this.masterReverb = new Tone.Freeverb({ roomSize: 0.75, dampening: 3000, wet: 0.42 })
    this.masterLimiter = new Tone.Limiter(-1)

    this.subLayer = new SubLayer()
    this.midLayer = new MidCinematicLayer()
    this.industrialLayer = new IndustrialTextureLayer()
    this.sciFiLayer = new SciFiAirLayer()
    this.pulseMachine = new PulseMachine()
    this.pulseMachine.setMotion(this._motion)
    this.pulseMachine.setDensity(this._density)
    this.pulseMachine.setRootFrequency(subToKickHz(this._subFreq))

    this.subLayer.connect(this.masterGain)
    this.midLayer.connect(this.masterGain)
    this.industrialLayer.connect(this.masterGain)
    this.sciFiLayer.connect(this.masterGain)
    this.pulseMachine.connect(this.masterGain)

    this.masterGain
      .connect(this.masterFilter)
    this.masterFilter
      .connect(this.masterReverb)
    this.masterReverb
      .connect(this.masterLimiter)
    this.masterLimiter
      .toDestination()

    this.analyser = new Tone.Analyser({ type: 'fft', size: 128, smoothing: 0.8 })
    this.masterLimiter.connect(this.analyser)

    this.subPitchWalker = new RandomWalkModulator({
      min: 30,
      max: 60,
      initial: this._subFreq,
      stepFraction: 0.04,
      rateHz: 0.01,
      onValue: (hz) => {
        this._subFreq = hz
        this.subLayer.setBaseFrequency(hz, 8)
        this.pulseMachine.setRootFrequency(subToKickHz(hz))
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

    this._applyDarkness(this._darkness, false)
    this._applyDensity(this._density, false)
    this._applyMotion(this._motion)
    this._applyHarmonicStructure(0.2)

    this._initialized = true

    this._applyTexture()
  }

    async start(): Promise<void> {
    if (this._running) return

    await Tone.start()

    await this._initialize()

    this.subLayer.start()
    this.midLayer.start()
    this.industrialLayer.start()
    this.sciFiLayer.start()
    this.pulseMachine.start()

    this.subPitchWalker.start()
    this.airFreqWalker.start()
    this.industrialBandWalker.start()
    this._running = true
    this._scheduleMacroScene()
  }

    stop(): void {
    if (!this._running) return

    this.subLayer.stop()
    this.midLayer.stop()
    this.industrialLayer.stop()
    this.sciFiLayer.stop()
    this.pulseMachine.stop()

    this.subPitchWalker.stop()
    this.airFreqWalker.stop()
    this.industrialBandWalker.stop()
    this._clearMacroScene()

    this._running = false
  }

    dispose(): void {
    this.stop()

    if (!this._initialized) return

    this.subLayer.dispose()
    this.midLayer.dispose()
    this.industrialLayer.dispose()
    this.sciFiLayer.dispose()
    this.pulseMachine.dispose()

    this.masterGain.dispose()
    this.masterFilter.dispose()
    this.masterReverb.dispose()
    this.masterLimiter.dispose()
    this.analyser.dispose()

    this._initialized = false
  }


    setVolume(value: number): void {
    this._volume = clamp(value, 0, 1)
    if (!this._initialized) return
    this.masterGain.gain.rampTo(this._volume, 0.08)
  }

    setDarkness(value: number): void {
    this._darkness = clamp(value, 0, 1)
    this._applyDarkness(this._darkness, false)
  }

    setMotion(value: number): void {
    this._motion = clamp(value, 0, 1)
    this._applyMotion(this._motion)
  }

    setDensity(value: number): void {
    this._density = clamp(value, 0, 1)
    this._applyDensity(this._density, false)
  }


    setGrain(value: number): void {
    this._grain = clamp(value, 0, 1)
    if (!this._initialized) return
    const level = 0.01 + this._grain * 0.18
    this.industrialLayer.setLevel(level)
  }

    setRust(value: number): void {
    this._rust = clamp(value, 0, 1)
    if (!this._initialized) return
    this.subLayer.setDistortionAmount(this._rust * 0.4)
    this.industrialLayer.setDistortionAmount(0.1 + this._rust * 0.7)
    this.industrialLayer.setBandQ(1.5 + this._rust * 8)
  }

    setHum(value: number): void {
    this._hum = clamp(value, 0, 1)
    if (!this._initialized) return
    const level = 0.15 + this._hum * 0.4
    this.subLayer.setLevel(level)
    this.subLayer.setPitchLFODepth(2 + this._hum * 18)
  }

    setFracture(value: number): void {
    this._fracture = clamp(value, 0, 1)
    if (!this._initialized) return
    this.sciFiLayer.setShimmerDepth(0.5 + this._fracture * 24)
    this.subLayer.setPitchLFODepth(2 + this._fracture * 20)
  }

    setSpace(value: number, smooth = false): void {
    this._space = clamp(value, 0, 1)
    if (!this._initialized) return
    const masterWet = 0.08 + this._space * 0.7
    this.masterReverb.wet.rampTo(masterWet, smooth ? 2.2 : 0.25)
    this.sciFiLayer.setReverbWet(0.3 + this._space * 0.65, smooth ? 2.2 : 0.25)
  }

  setPulse(value: number): void {
    this._pulse = clamp(value, 0, 1)
    if (!this._initialized) return
    this.pulseMachine.setIntensity(this._pureDrone ? 0 : this._pulse)
  }

  setPureDrone(value: boolean): void {
    this._pureDrone = value
    if (!this._initialized) return
    this.pulseMachine.setIntensity(this._pureDrone ? 0 : this._pulse)
    this._applyMotion(this._motion)
    this._applyDensity(this._density, false)
    if (this._running) {
      if (this._pureDrone) {
        this.subPitchWalker.stop()
        this.airFreqWalker.stop()
        this.industrialBandWalker.stop()
      } else {
        this.subPitchWalker.start()
        this.airFreqWalker.start()
        this.industrialBandWalker.start()
      }
    }
  }

  setRoot(value: number): void {
    this._root = clamp(value, 0, 1)
    this._applyHarmonicStructure(1.2)
  }

  setIntervalSpread(value: number): void {
    this._intervalSpread = clamp(value, 0, 1)
    this._applyHarmonicStructure(1.2)
  }

    setMode(mode: SoundMode): void {
    this._currentMode = mode
    if (mode === 'MANUAL') return

    const p = MODE_PRESETS[mode]
    this._darkness = p.darkness
    this._motion = p.motion
    this._density = p.density
    this._grain = p.grain
    this._rust = p.rust
    this._hum = p.hum
    this._fracture = p.fracture
    this._space = p.space
    this._pulse = p.pulse

    this._applyDarkness(this._darkness, true)
    this._applyMotion(this._motion)
    this._applyDensity(this._density, true)

    if (!this._initialized) return
    this.setGrain(this._grain)
    this.setRust(this._rust)
    this.setHum(this._hum)
    this.setFracture(this._fracture)
    this.setSpace(this._space, true)
    this.setPulse(this._pulse)
    this.setPureDrone(this._pureDrone)
  }

    randomize(): void {
    const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

    const newDarkness = rand(0.2, 0.85)
    const newMotion = rand(0.1, 0.9)
    const newDensity = rand(0.1, 0.9)

    this._darkness = newDarkness
    this._motion = newMotion
    this._density = newDensity
    this._root = rand(0.15, 0.85)
    this._intervalSpread = rand(0.2, 0.85)

    this._applyDarkness(newDarkness, true)
    this._applyMotion(newMotion)
    this._applyDensity(newDensity, true)
    this._applyHarmonicStructure(2.5)

    if (!this._initialized) return

    this.subPitchWalker.setRange(
      Math.max(28, this._subFreq - 12),
      Math.min(65, this._subFreq + 12),
    )
    this.airFreqWalker.setRange(
      Math.max(160, this._airFreq - 60),
      Math.min(560, this._airFreq + 60),
    )

    const reverbWet = rand(0.3, 0.65)
    this.masterReverb.wet.rampTo(reverbWet, 2)
  }


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
      grain: this._grain,
      rust: this._rust,
      hum: this._hum,
      fracture: this._fracture,
      space: this._space,
      pulse: this._pulse,
      pureDrone: this._pureDrone,
      root: this._root,
      intervalSpread: this._intervalSpread,
      mode: this._currentMode,
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
    this._grain = preset.grain ?? this._grain
    this._rust = preset.rust ?? this._rust
    this._hum = preset.hum ?? this._hum
    this._fracture = preset.fracture ?? this._fracture
    this._space = preset.space ?? this._space
    this._pulse = preset.pulse ?? this._pulse
    this._pureDrone = preset.pureDrone ?? this._pureDrone
    this._root = preset.root ?? this._root
    this._intervalSpread = preset.intervalSpread ?? this._intervalSpread
    this._currentMode = preset.mode ?? 'MANUAL'

    this.setVolume(this._volume)
    this.setDarkness(this._darkness)
    this.setMotion(this._motion)
    this.setDensity(this._density)

    if (this._initialized) {
      this.subLayer.setBaseFrequency(this._subFreq, 6)
      this.midLayer.setBaseFrequency(this._midFreq, 6)
      this.sciFiLayer.setBaseFrequency(this._airFreq, 8)
      this.pulseMachine.setRootFrequency(subToKickHz(this._subFreq))
      this._applyTexture()
      this.setPureDrone(this._pureDrone)
      this._applyHarmonicStructure(0.2)
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


    startRecording(): void {
    if (!this._initialized) {
      console.warn('[DroneEngine] Cannot record before the engine is started.')
      return
    }
    this.recEngine.start(this.masterLimiter)
  }

    async stopRecording(): Promise<Blob | null> {
    const blob = await this.recEngine.stop()
    if (blob) {
      await RecordingEngine.download(blob, 'drone', 'mp3')
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


  private _applyDarkness(d: number, ramp: boolean): void {
    if (!this._initialized) return
    const cutoff = Math.max(20, darknessToCutoff(d))
    const time = ramp ? 0.8 : 0.12
    this.masterFilter.frequency.rampTo(cutoff, time)

    const midCutoff = Math.max(20, darknessToCutoff(d * 0.65) * 0.6)
    this.midLayer.setFilterFrequency(midCutoff, time)
  }

  private _applyMotion(m: number): void {
    if (!this._initialized) return
    const rate = motionToRate(m)
    const depth = 0.2 + m * 0.8

    this.subLayer.setPitchLFORate(rate * 0.5)
    this.midLayer.setFilterLFORate(rate * 0.8)
    this.industrialLayer.setAMLFORate(rate * 0.6)
    this.sciFiLayer.setPanLFORate(rate * 0.7)

    this.subLayer.setPitchLFODepth(3 + depth * 9)
    this.midLayer.setFilterLFODepth(40 + depth * 200)
    this.sciFiLayer.setShimmerDepth(1 + depth * (this._pureDrone ? 2.5 : 5))
    this.pulseMachine.setMotion(m)

    const walkRate = this._pureDrone ? 0.002 : 0.005 + m * 0.015
    this.subPitchWalker.setRate(walkRate)
    this.airFreqWalker.setRate(walkRate * 0.8)
    this.industrialBandWalker.setRate(walkRate * (this._pureDrone ? 0.45 : 1.2))
  }

  private _applyDensity(d: number, _ramp: boolean): void {
    if (!this._initialized) return
    const detuneCents = 4 + d * (this._pureDrone ? 12 : 24)
    this.midLayer.setDetune(detuneCents)

    const shimmer = 0.5 + d * (this._pureDrone ? 2.5 : 5)
    this.sciFiLayer.setShimmerDepth(shimmer)
    this.pulseMachine.setDensity(d)
  }

  private _applyTexture(): void {
    if (!this._initialized) return
    this.setGrain(this._grain)
    this.setRust(this._rust)
    this.setHum(this._hum)
    this.setFracture(this._fracture)
    this.setSpace(this._space)
    this.setPulse(this._pulse)
    this.setPureDrone(this._pureDrone)
    this._applyHarmonicStructure(0.2)
  }

  private _applyHarmonicStructure(ramp: number): void {
    this._subFreq = rootToSubHz(this._root)
    const midRatio = 1.6 + this._intervalSpread * 1.8
    const airRatio = 4.8 + this._intervalSpread * 6.2
    this._midFreq = clamp(this._subFreq * midRatio, 45, 200)
    this._airFreq = clamp(this._subFreq * airRatio, 140, 760)
    if (!this._initialized) return
    this.subLayer.setBaseFrequency(this._subFreq, ramp)
    this.midLayer.setBaseFrequency(this._midFreq, ramp)
    this.sciFiLayer.setBaseFrequency(this._airFreq, ramp * 1.2)
    this.pulseMachine.setRootFrequency(subToKickHz(this._subFreq))
    this.subPitchWalker.setRange(
      Math.max(28, this._subFreq - (this._pureDrone ? 6 : 12)),
      Math.min(65, this._subFreq + (this._pureDrone ? 6 : 12)),
    )
    this.airFreqWalker.setRange(
      Math.max(160, this._airFreq - (this._pureDrone ? 30 : 60)),
      Math.min(560, this._airFreq + (this._pureDrone ? 30 : 60)),
    )
  }

  private _scheduleMacroScene(): void {
    this._clearMacroScene()
    if (!this._running) return
    const durationMs = 120000 + Math.random() * 180000
    this.macroTimer = setTimeout(() => {
      if (!this._running) return
      const nudge = (v: number, amount: number) => clamp(v + (Math.random() * 2 - 1) * amount, 0, 1)
      this.setDarkness(nudge(this._darkness, 0.08))
      this.setMotion(nudge(this._motion, this._pureDrone ? 0.05 : 0.1))
      this.setDensity(nudge(this._density, 0.08))
      this.setGrain(nudge(this._grain, 0.08))
      this.setRust(nudge(this._rust, this._pureDrone ? 0.03 : 0.08))
      this.setHum(nudge(this._hum, 0.08))
      this.setFracture(nudge(this._fracture, this._pureDrone ? 0.04 : 0.1))
      this.setSpace(nudge(this._space, 0.1), true)
      this.setPulse(nudge(this._pulse, this._pureDrone ? 0.02 : 0.08))
      this.setRoot(nudge(this._root, 0.08))
      this.setIntervalSpread(nudge(this._intervalSpread, 0.08))
      this._scheduleMacroScene()
    }, durationMs)
  }

  private _clearMacroScene(): void {
    if (!this.macroTimer) return
    clearTimeout(this.macroTimer)
    this.macroTimer = null
  }
}
