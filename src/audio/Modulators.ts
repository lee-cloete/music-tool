
import * as Tone from 'tone'


export interface RandomWalkOptions {
    min: number
    max: number
    initial: number
    stepFraction: number
    rateHz: number
    onValue: (v: number) => void
}

export class RandomWalkModulator {
  private timerId: ReturnType<typeof setInterval> | null = null
  private value: number

  private min: number
  private max: number
  private stepFraction: number
  private rateHz: number
  private readonly onValue: (v: number) => void

  constructor(opts: RandomWalkOptions) {
    this.min = opts.min
    this.max = opts.max
    this.value = Math.max(opts.min, Math.min(opts.max, opts.initial))
    this.stepFraction = opts.stepFraction
    this.rateHz = Math.max(0.005, Math.min(0.1, opts.rateHz))
    this.onValue = opts.onValue
  }

  start(): void {
    if (this.timerId !== null) return
    const ms = 1000 / this.rateHz
    this.timerId = setInterval(() => {
      const range = this.max - this.min
      const delta = (Math.random() * 2 - 1) * this.stepFraction * range
      this.value = Math.max(this.min, Math.min(this.max, this.value + delta))
      this.onValue(this.value)
    }, ms)
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }

    setRate(hz: number): void {
    const wasRunning = this.timerId !== null
    this.stop()
    this.rateHz = Math.max(0.005, Math.min(0.1, hz))
    if (wasRunning) this.start()
  }

    setRange(min: number, max: number): void {
    this.min = min
    this.max = max
    this.value = Math.max(min, Math.min(max, this.value))
  }

    setStepFraction(fraction: number): void {
    this.stepFraction = Math.max(0, Math.min(1, fraction))
  }

  getValue(): number {
    return this.value
  }

  isRunning(): boolean {
    return this.timerId !== null
  }
}


export interface LFOModulatorOptions {
  frequency: number
  min: number
  max: number
  type?: OscillatorType
}

export class LFOModulator {
  readonly lfo: Tone.LFO

  constructor(opts: LFOModulatorOptions) {
    this.lfo = new Tone.LFO({
      frequency: opts.frequency,
      min: opts.min,
      max: opts.max,
      type: (opts.type ?? 'sine') as Tone.ToneOscillatorType,
    })
  }

  connect(destination: Tone.InputNode): this {
    this.lfo.connect(destination)
    return this
  }

  start(): this {
    this.lfo.start()
    return this
  }

  stop(): this {
    this.lfo.stop()
    return this
  }

    setFrequency(hz: number, rampTime = 4): void {
    this.lfo.frequency.rampTo(hz, rampTime)
  }

    setDepth(min: number, max: number): void {
    this.lfo.min = min
    this.lfo.max = max
  }

  dispose(): void {
    this.lfo.dispose()
  }
}
