import * as Tone from 'tone'
import { Mp3Encoder } from 'lamejs'

export type RecordingState = 'idle' | 'recording' | 'stopping'

export class RecordingEngine {
  private recorder: Tone.Recorder | null = null
  private _state: RecordingState = 'idle'
  private _startedAt = 0

  get state(): RecordingState {
    return this._state
  }

  get isRecording(): boolean {
    return this._state === 'recording'
  }

  get elapsedSeconds(): number {
    if (this._state !== 'recording') return 0
    return (Date.now() - this._startedAt) / 1000
  }
  start(source: Tone.ToneAudioNode): void {
    if (this._state !== 'idle') return

    this.recorder = new Tone.Recorder()
    source.connect(this.recorder)
    this.recorder.start()

    this._state = 'recording'
    this._startedAt = Date.now()
  }

  async stop(): Promise<Blob | null> {
    if (this._state !== 'recording' || !this.recorder) return null

    this._state = 'stopping'

    let blob: Blob | null = null
    try {
      blob = await this.recorder.stop()
    } finally {
      this.recorder.dispose()
      this.recorder = null
      this._state = 'idle'
    }

    return blob
  }

  static mimeToExtension(mimeType: string): string {
    if (mimeType.includes('ogg')) return 'ogg'
    if (mimeType.includes('mp4')) return 'm4a'
    return 'webm'
  }

  static preferredMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/webm',
    ]
    for (const mime of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        return mime
      }
    }
    return ''
  }

  static async download(blob: Blob, prefix = 'drone', preferred: 'auto' | 'mp3' = 'auto'): Promise<void> {
    if (preferred === 'mp3') {
      const mp3 = await RecordingEngine.tryConvertToMp3(blob)
      if (mp3) {
        RecordingEngine.downloadBlob(mp3, `${RecordingEngine.timestampedName(prefix)}.mp3`)
        return
      }
    }

    const ext = RecordingEngine.mimeToExtension(blob.type)
    RecordingEngine.downloadBlob(blob, `${RecordingEngine.timestampedName(prefix)}.${ext}`)
  }

  private static timestampedName(prefix: string): string {
    const ts = new Date()
      .toISOString()
      .replace('T', '_')
      .replace(/[:.]/g, '-')
      .slice(0, 19)
    return `${prefix}_${ts}`
  }

  private static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  private static async tryConvertToMp3(blob: Blob): Promise<Blob | null> {
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const context = new AudioContext()
      const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0))
      await context.close()

      const channels = Math.min(2, audioBuffer.numberOfChannels)
      const sampleRate = audioBuffer.sampleRate
      const encoder = new Mp3Encoder(channels, sampleRate, 192)
      const blockSize = 1152
      const total = audioBuffer.length

      const left = RecordingEngine.floatTo16(audioBuffer.getChannelData(0))
      const right = channels > 1
        ? RecordingEngine.floatTo16(audioBuffer.getChannelData(1))
        : null

      const chunks: Int8Array[] = []
      for (let i = 0; i < total; i += blockSize) {
        const lChunk = left.subarray(i, i + blockSize)
        const encoded = right
          ? encoder.encodeBuffer(lChunk, right.subarray(i, i + blockSize))
          : encoder.encodeBuffer(lChunk)
        if (encoded.length > 0) chunks.push(new Int8Array(encoded))
      }
      const flushed = encoder.flush()
      if (flushed.length > 0) chunks.push(new Int8Array(flushed))
      if (chunks.length === 0) return null

      return new Blob(chunks as unknown as BlobPart[], { type: 'audio/mpeg' })
    } catch {
      return null
    }
  }

  private static floatTo16(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i] ?? 0))
      output[i] = s < 0 ? s * 32768 : s * 32767
    }
    return output
  }
}
