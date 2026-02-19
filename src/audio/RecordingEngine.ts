/**
 * RecordingEngine.ts
 *
 * Real-time audio capture using Tone.Recorder (wraps browser MediaRecorder).
 * Connects to any Tone node in the signal graph, records to a Blob, and
 * offers a static helper to trigger a browser download.
 *
 * Output format is whatever MediaRecorder prefers in the current browser:
 *   Chrome / Edge → audio/webm (Opus codec)
 *   Firefox       → audio/ogg  (Opus codec)
 *   Safari 17+    → audio/mp4  (AAC codec)
 *
 * Extension logic auto-detects the MIME type so the downloaded filename
 * always has the correct extension.
 */

import * as Tone from 'tone'

export type RecordingState = 'idle' | 'recording' | 'stopping'

export class RecordingEngine {
  private recorder: Tone.Recorder | null = null
  private _state: RecordingState = 'idle'
  private _startedAt = 0

  // ── Public state ───────────────────────────────────────────────────────────

  get state(): RecordingState {
    return this._state
  }

  get isRecording(): boolean {
    return this._state === 'recording'
  }

  /** Elapsed seconds since recording started (0 when idle). */
  get elapsedSeconds(): number {
    if (this._state !== 'recording') return 0
    return (Date.now() - this._startedAt) / 1000
  }

  // ── API ────────────────────────────────────────────────────────────────────

  /**
   * Begin capturing audio from `source`.
   * The recorder is wired in parallel – existing routing is unchanged.
   * Safe to call only when state is 'idle'.
   */
  start(source: Tone.ToneAudioNode): void {
    if (this._state !== 'idle') return

    this.recorder = new Tone.Recorder()
    source.connect(this.recorder)
    this.recorder.start()

    this._state = 'recording'
    this._startedAt = Date.now()
  }

  /**
   * Stop recording, return the Blob, and automatically trigger a browser
   * download with a timestamped filename.
   * Resolves once the MediaRecorder has finalised the Blob.
   */
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

  // ── Static helpers ─────────────────────────────────────────────────────────

  /**
   * Map a MIME type string to the most common file extension.
   */
  static mimeToExtension(mimeType: string): string {
    if (mimeType.includes('ogg')) return 'ogg'
    if (mimeType.includes('mp4')) return 'm4a'
    return 'webm' // default (Chrome, Edge)
  }

  /**
   * Determine the best MIME type available for MediaRecorder.
   * Falls back to empty string if the browser is the authority.
   */
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

  /**
   * Trigger a browser Save dialog for the given Blob.
   * Automatically picks the right file extension from the MIME type.
   * @param blob    - the recorded audio blob
   * @param prefix  - filename prefix (default 'drone')
   */
  static download(blob: Blob, prefix = 'drone'): void {
    const ext = RecordingEngine.mimeToExtension(blob.type)
    const ts = new Date()
      .toISOString()
      .replace('T', '_')
      .replace(/[:.]/g, '-')
      .slice(0, 19)
    const filename = `${prefix}_${ts}.${ext}`

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // Revoke after a short delay so the browser has time to open the dialog
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
