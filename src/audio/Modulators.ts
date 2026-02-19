/**
 * Modulators.ts
 *
 * Slow-evolution modulation primitives for the ambient drone engine.
 * All modulation rates stay within 0.005 – 0.1 Hz.
 * Nothing rhythmic. Everything evolving.
 */

import * as Tone from 'tone'

// ---------------------------------------------------------------------------
// RandomWalkModulator
// ---------------------------------------------------------------------------
// Drifts a single numeric value via a random walk.
// Calls onValue() with the new value on every step so the caller can
// apply it to any Tone.Signal / Param / native AudioParam.
// ---------------------------------------------------------------------------

export interface RandomWalkOptions {
  /** Minimum output value */
  min: number
  /** Maximum output value */
  max: number
  /** Starting value (clamped to [min, max]) */
  initial: number
  /**
   * Maximum step size expressed as a fraction of the total range.
   * e.g. 0.05 → each step moves at most 5 % of (max − min).
   */
  stepFraction: number
  /**
   * How often a new step is taken, in Hz.
   * Keep within 0.005 – 0.1 Hz for ambient feel.
   */
  rateHz: number
  /** Called with the new value after every step */
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

  /** Change rate without restarting (takes effect on next start / restart). */
  setRate(hz: number): void {
    const wasRunning = this.timerId !== null
    this.stop()
    this.rateHz = Math.max(0.005, Math.min(0.1, hz))
    if (wasRunning) this.start()
  }

  /** Update the walk bounds without affecting the current value. */
  setRange(min: number, max: number): void {
    this.min = min
    this.max = max
    // Clamp current value to new range
    this.value = Math.max(min, Math.min(max, this.value))
  }

  /** Update step size (fraction of range). */
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

// ---------------------------------------------------------------------------
// LFOModulator
// ---------------------------------------------------------------------------
// Thin, lifecycle-managed wrapper around Tone.LFO that exposes rate and
// depth setters with smooth-ramping so there are never audible clicks.
// ---------------------------------------------------------------------------

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

  /** Ramp the LFO rate smoothly (avoids clicks). */
  setFrequency(hz: number, rampTime = 4): void {
    this.lfo.frequency.rampTo(hz, rampTime)
  }

  /**
   * Update the modulation depth (min/max range).
   * Changes are immediate – soft-set before audio starts or call during
   * silent transitions to avoid artefacts.
   */
  setDepth(min: number, max: number): void {
    this.lfo.min = min
    this.lfo.max = max
  }

  dispose(): void {
    this.lfo.dispose()
  }
}
