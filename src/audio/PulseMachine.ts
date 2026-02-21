import * as Tone from 'tone'

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export class PulseMachine {
  private readonly bus = new Tone.Gain(0)
  private readonly kick: Tone.MembraneSynth
  private readonly hatNoise: Tone.NoiseSynth
  private readonly hatFilter: Tone.Filter
  private readonly hatGain: Tone.Gain

  private step = 0
  private repeatId: number | null = null
  private running = false
  private intensity = 0.18
  private motion = 0.4
  private density = 0.45
  private rootHz = 56

  constructor() {
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.08 },
    })

    this.hatNoise = new Tone.NoiseSynth({
      noise: { type: 'white', playbackRate: 1.5 },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.03 },
    })

    this.hatFilter = new Tone.Filter({ type: 'highpass', frequency: 3500, Q: 0.7 })
    this.hatGain = new Tone.Gain(0.7)

    this.kick.connect(this.bus)
    this.hatNoise.connect(this.hatFilter)
    this.hatFilter.connect(this.hatGain)
    this.hatGain.connect(this.bus)
  }

  connect(destination: Tone.InputNode): this {
    this.bus.connect(destination)
    return this
  }

  setIntensity(value: number): void {
    this.intensity = clamp(value, 0, 1)
    const level = Math.pow(this.intensity, 1.35) * 0.14
    this.bus.gain.rampTo(level, 0.15)
  }

  setMotion(value: number): void {
    this.motion = clamp(value, 0, 1)
    if (!this.running) return
    this.updateTransportFeel()
  }

  setDensity(value: number): void {
    this.density = clamp(value, 0, 1)
  }

  setRootFrequency(hz: number): void {
    this.rootHz = clamp(hz, 36, 92)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.step = 0
    this.setIntensity(this.intensity)
    this.updateTransportFeel()

    this.repeatId = Tone.Transport.scheduleRepeat((time) => {
      this.tick(time)
    }, '16n')

    Tone.Transport.position = 0
    Tone.Transport.start('+0.02')
  }

  stop(): void {
    if (!this.running) return
    this.running = false

    if (this.repeatId !== null) {
      Tone.Transport.clear(this.repeatId)
      this.repeatId = null
    }

    this.bus.gain.rampTo(0, 0.12)
    Tone.Transport.stop()
    Tone.Transport.position = 0
  }

  dispose(): void {
    this.stop()
    this.kick.dispose()
    this.hatNoise.dispose()
    this.hatFilter.dispose()
    this.hatGain.dispose()
    this.bus.dispose()
  }

  private updateTransportFeel(): void {
    const bpm = 62 + this.motion * 34
    Tone.Transport.bpm.rampTo(bpm, 0.2)
    Tone.Transport.swing = 0.03 + this.motion * 0.1
    Tone.Transport.swingSubdivision = '16n'
  }

  private tick(time: number): void {
    if (this.intensity <= 0.0005) {
      this.step = (this.step + 1) % 16
      return
    }

    const step = this.step % 16
    const dense = this.density > 0.55
    const denser = this.density > 0.82

    if (step === 0 || step === 8 || (dense && step === 12)) {
      const vel = 0.45 + this.intensity * 0.35
      const kickHz = step === 12 ? this.rootHz * 0.94 : this.rootHz
      this.kick.triggerAttackRelease(kickHz, '8n', time, vel)
    }

    if (step === 4 || step === 12) {
      const vel = 0.18 + this.intensity * 0.25
      this.hatNoise.triggerAttackRelease('32n', time, vel)
    }

    if (denser && (step % 2 === 0) && step !== 0 && step !== 8) {
      const vel = 0.05 + this.intensity * 0.12
      this.hatNoise.triggerAttackRelease('64n', time + 0.002, vel)
    }

    this.step = (this.step + 1) % 16
  }
}
