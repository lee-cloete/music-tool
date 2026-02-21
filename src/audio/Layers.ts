
import * as Tone from 'tone'


export class SubLayer {
  private readonly osc: Tone.Oscillator
  private readonly saturation: Tone.Distortion
  private readonly levelGain: Tone.Gain
  private readonly pitchLFO: Tone.LFO
  private readonly pitchLFOGain: Tone.Gain

  private baseFreq = 42
  private _started = false

  constructor() {
    this.osc = new Tone.Oscillator({ type: 'sine', frequency: this.baseFreq })
    this.saturation = new Tone.Distortion({ distortion: 0.04, oversample: '4x' })
    this.levelGain = new Tone.Gain(0)
    this.pitchLFO = new Tone.LFO({ frequency: 0.01, min: -6, max: 6, type: 'sine' })
    this.pitchLFOGain = new Tone.Gain(1)

    this.osc.connect(this.saturation)
    this.saturation.connect(this.levelGain)
    this.pitchLFO.connect(this.pitchLFOGain)
    this.pitchLFOGain.connect(this.osc.frequency as unknown as Tone.InputNode)
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
    this.levelGain.gain.rampTo(0, 0.35)
  }


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

    setDistortionAmount(amount: number): void {
    this.saturation.distortion = Math.max(0, Math.min(0.9, amount * 0.9))
  }

  dispose(): void {
    this.osc.dispose()
    this.saturation.dispose()
    this.levelGain.dispose()
    this.pitchLFO.dispose()
    this.pitchLFOGain.dispose()
  }
}


export class MidCinematicLayer {
  private readonly osc1: Tone.Oscillator
  private readonly osc2: Tone.Oscillator
  private readonly filter: Tone.Filter
  private readonly envelope: Tone.AmplitudeEnvelope
  private readonly levelGain: Tone.Gain
  private readonly filterLFO: Tone.LFO
  private readonly filterLFOGain: Tone.Gain

  private baseFreq = 80
  private _started = false

  constructor() {
    this.osc1 = new Tone.Oscillator({ type: 'sawtooth', frequency: this.baseFreq })
    this.osc2 = new Tone.Oscillator({ type: 'sawtooth', frequency: this.baseFreq })

    this.osc1.detune.value = -8
    this.osc2.detune.value = 8

    this.filter = new Tone.Filter({ type: 'lowpass', frequency: 500, Q: 1.2 })

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
    this.filterLFOGain = new Tone.Gain(1)

    this.osc1.connect(this.filter)
    this.osc2.connect(this.filter)
    this.filter.connect(this.envelope)
    this.envelope.connect(this.levelGain)
    this.filterLFO.connect(this.filterLFOGain)
    this.filterLFOGain.connect(this.filter.frequency as unknown as Tone.InputNode)
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
  }


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
    this.filterLFOGain.dispose()
  }
}


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


  setLevel(value: number, ramp = 1): void {
    this.levelGain.gain.rampTo(Math.max(0, value), ramp)
  }

  setBandFrequency(hz: number, ramp = 2): void {
    this.bpFilter.frequency.rampTo(Math.max(20, hz), ramp)
  }

  setAMLFORate(hz: number): void {
    this.amLFO.frequency.rampTo(Math.max(0.005, Math.min(0.1, hz)), 2)
  }

    setDistortionAmount(amount: number): void {
    this.distortion.distortion = Math.max(0, Math.min(1, amount))
  }

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


export class SciFiAirLayer {
  private readonly osc: Tone.Oscillator
  private readonly panner: Tone.Panner
  private readonly layerReverb: Tone.Freeverb
  private readonly levelGain: Tone.Gain
  private readonly panLFO: Tone.LFO
  private readonly shimmerLFO: Tone.LFO
  private readonly shimmerLFOGain: Tone.Gain

  private _started = false

  constructor() {
    this.osc = new Tone.Oscillator({ type: 'triangle', frequency: 320 })
    this.panner = new Tone.Panner(0)
    this.layerReverb = new Tone.Freeverb({ roomSize: 0.9, dampening: 1800, wet: 0.72 })
    this.levelGain = new Tone.Gain(0)

    this.panLFO = new Tone.LFO({ frequency: 0.018, min: -0.85, max: 0.85, type: 'sine' })
    this.shimmerLFO = new Tone.LFO({ frequency: 0.05, min: -3, max: 3, type: 'sine' })
    this.shimmerLFOGain = new Tone.Gain(1)

    this.osc.connect(this.panner)
    this.panner.connect(this.layerReverb)
    this.layerReverb.connect(this.levelGain)

    this.panLFO.connect(this.panner.pan as unknown as Tone.InputNode)
    this.shimmerLFO.connect(this.shimmerLFOGain)
    this.shimmerLFOGain.connect(this.osc.frequency as unknown as Tone.InputNode)
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

    setReverbWet(wet: number, ramp = 2): void {
    this.layerReverb.wet.rampTo(Math.max(0, Math.min(1, wet)), ramp)
  }

  dispose(): void {
    this.osc.dispose()
    this.panner.dispose()
    this.layerReverb.dispose()
    this.levelGain.dispose()
    this.panLFO.dispose()
    this.shimmerLFO.dispose()
    this.shimmerLFOGain.dispose()
  }
}
