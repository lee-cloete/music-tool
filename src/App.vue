<template>
  <div class="app" :class="{ running: isRunning }">
    <canvas ref="bgCanvas" class="bg-canvas" aria-hidden="true" />
    <header class="app-header">
      <p class="plant-title">LEELULZ DRONE MANUFACTURING PLANT</p>
      <p class="plant-subtitle">Autonomous Harmonic Fabrication Facility</p>
      <div class="status-row">
        <span class="status-dot" :class="{ active: isRunning }" />
        <span class="status-text" :class="{ warning: isOverload }">{{ statusLabel }}</span>
        <span v-if="isOverload" class="overload-tag">!! OVERLOAD</span>
      </div>
      <button class="btn help-btn" @click="openGuide" aria-label="Open how it works">
        HOW IT WORKS
      </button>
    </header>
    <div class="oscilloscope" aria-hidden="true">
      <canvas ref="oscCanvas" class="osc-canvas" />
    </div>
    <Controls
      :is-running="isRunning"
      :is-starting="isStarting"
      :volume="params.volume"
      :darkness="params.darkness"
      :motion="params.motion"
      :density="params.density"
      :mode="params.mode"
      :grain="params.grain"
      :rust="params.rust"
      :hum="params.hum"
      :fracture="params.fracture"
      :space="params.space"
      :pulse="params.pulse"
      :pure-drone="params.pureDrone"
      :root="params.root"
      :interval-spread="params.intervalSpread"
      :preset-names="presetNames"
      :active-preset="activePreset"
      :is-recording="isRecording"
      :recording-elapsed="recordingElapsed"
      @start="handleStart"
      @stop="handleStop"
      @randomize="handleRandomize"
      @update:volume="setVolume"
      @update:darkness="setDarkness"
      @update:motion="setMotion"
      @update:density="setDensity"
      @update:mode="setMode"
      @update:grain="setGrain"
      @update:rust="setRust"
      @update:hum="setHum"
      @update:fracture="setFracture"
      @update:space="setSpace"
      @update:pulse="setPulse"
      @update:pure-drone="setPureDrone"
      @update:root="setRoot"
      @update:interval-spread="setIntervalSpread"
      @save-preset="savePreset"
      @load-preset="loadPreset"
      @delete-preset="deletePreset"
      @start-record="handleStartRecord"
      @stop-record="handleStopRecord"
    />
    <Snapshots
      :snapshots="snapshots"
      :active="morphActive"
      :duration="morphDuration"
      :progress="morphProgress"
      :morph-from-idx="morphFromIdx"
      :morph-to-idx="morphToIdx"
      @capture="captureSnapshot"
      @load="loadSnapshot"
      @delete="deleteSnapshot"
      @toggle="toggleMorph"
      @update:duration="morphDuration = $event"
    />
    <footer class="app-footer">
      <span>leecloete.dev</span>
    </footer>

    <Transition name="fade">
      <div v-if="showGuide" class="modal-backdrop" @click.self="closeGuide">
        <section class="modal-card" role="dialog" aria-modal="true" aria-label="How it works">
          <div class="modal-head">
            <h2>HOW IT WORKS</h2>
            <button class="btn modal-close" @click="closeGuide" aria-label="Close guide">CLOSE</button>
          </div>
          <ol class="modal-list">
            <li>Set `ROOT` and `INTERVAL` to choose your tonal center and harmonic spacing.</li>
            <li>Shape tone and movement with the core + texture controls, then set `PULSE` or switch `PURE DRONE` on.</li>
            <li>Capture 2-4 snapshots and morph between them to structure sections.</li>
            <li>Let the engine evolve; macro scenes shift the sound every 2-5 minutes.</li>
            <li>Record the full pass when it feels right (you can export).</li>
          </ol>
        </section>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import Controls from './components/Controls.vue'
import Snapshots, { type SnapState } from './components/Snapshots.vue'
import { DroneEngine } from './audio/DroneEngine'
import type { SoundMode } from './audio/DroneEngine'
import { track } from './analytics'

let engine: DroneEngine | null = null

function getEngine(): DroneEngine {
  if (!engine) engine = new DroneEngine()
  return engine
}

const isRunning = ref(false)
const isStarting = ref(false)
const showGuide = ref(false)

const params = reactive({
  volume: 0.85,
  darkness: 0.45,
  motion: 0.4,
  density: 0.45,
  mode: 'MANUAL' as SoundMode,
  grain: 0.3,
  rust: 0.2,
  hum: 0.4,
  fracture: 0.15,
  space: 0.45,
  pulse: 0.18,
  pureDrone: false,
  root: 0.35,
  intervalSpread: 0.4,
})

const presetNames = ref<string[]>([])
const activePreset = ref<string | null>(null)

const isRecording = ref(false)
const recordingElapsed = ref(0)
let recElapsedInterval = 0

const snapshots    = ref<(SnapState | null)[]>([null, null, null, null])
const morphActive  = ref(false)
const morphDuration = ref(8)
const morphProgress = ref(0)
const morphFromIdx  = ref(-1)
const morphToIdx    = ref(-1)

let morphRaf         = 0
let morphSegStart    = 0
let morphLastUpdate  = 0

function getFilledIndices(): number[] {
  return snapshots.value.reduce<number[]>((acc, s, i) => {
    if (s !== null) acc.push(i)
    return acc
  }, [])
}

function captureSnapshot(i: number) {
  snapshots.value[i] = {
    darkness: params.darkness, motion:   params.motion,
    density:  params.density,  grain:    params.grain,
    rust:     params.rust,     hum:      params.hum,
    fracture: params.fracture, space:    params.space,
    pulse:    params.pulse,
    root: params.root, intervalSpread: params.intervalSpread,
  }
}

function loadSnapshot(i: number) {
  const s = snapshots.value[i]
  if (!s) return
  applySnapState(s)
}

function deleteSnapshot(i: number) {
  snapshots.value[i] = null
  if (morphActive.value) stopMorph()
}

function applySnapState(s: SnapState, toEngine = true) {
  params.darkness = s.darkness; params.motion   = s.motion
  params.density  = s.density;  params.grain    = s.grain
  params.rust     = s.rust;     params.hum      = s.hum
  params.fracture = s.fracture; params.space    = s.space
  params.pulse    = s.pulse
  params.root = s.root; params.intervalSpread = s.intervalSpread
  if (toEngine && engine) {
    engine.setDarkness(s.darkness); engine.setMotion(s.motion)
    engine.setDensity(s.density);   engine.setGrain(s.grain)
    engine.setRust(s.rust);         engine.setHum(s.hum)
    engine.setFracture(s.fracture); engine.setSpace(s.space)
    engine.setPulse(s.pulse)
    engine.setRoot(s.root); engine.setIntervalSpread(s.intervalSpread)
  }
  params.mode = 'MANUAL'
  activePreset.value = null
}

function toggleMorph() {
  if (morphActive.value) stopMorph()
  else startMorph()
}

function startMorph() {
  const filled = getFilledIndices()
  if (filled.length < 2) return
  morphFromIdx.value = filled[0] ?? -1
  morphToIdx.value   = filled[1] ?? -1
  morphSegStart      = performance.now()
  morphLastUpdate    = 0
  morphActive.value  = true
  morphRaf = requestAnimationFrame(runMorph)
}

function stopMorph() {
  cancelAnimationFrame(morphRaf)
  morphActive.value  = false
  morphProgress.value = 0
  morphFromIdx.value  = -1
  morphToIdx.value    = -1
}

function runMorph(ts: number) {
  if (!morphActive.value) return

  const filled = getFilledIndices()
  if (filled.length < 2) { stopMorph(); return }

  const elapsed = ts - morphSegStart
  const dur     = morphDuration.value * 1000
  const t       = Math.min(1, elapsed / dur)
  morphProgress.value = t

  if (ts - morphLastUpdate > 80) {
    morphLastUpdate = ts
    const from = snapshots.value[morphFromIdx.value]!
    const to   = snapshots.value[morphToIdx.value]!
    const lerp = (a: number, b: number) => a + (b - a) * t
    applySnapState({
      darkness: lerp(from.darkness, to.darkness),
      motion:   lerp(from.motion,   to.motion),
      density:  lerp(from.density,  to.density),
      grain:    lerp(from.grain,    to.grain),
      rust:     lerp(from.rust,     to.rust),
      hum:      lerp(from.hum,      to.hum),
      fracture: lerp(from.fracture, to.fracture),
      space:    lerp(from.space,    to.space),
      pulse:    lerp(from.pulse,    to.pulse),
      root:     lerp(from.root,     to.root),
      intervalSpread: lerp(from.intervalSpread, to.intervalSpread),
    })
  }

  if (t >= 1) {
    const fromPos  = filled.indexOf(morphFromIdx.value)
    const nextFrom = filled[(fromPos + 1) % filled.length] ?? -1
    const nextTo   = filled[(fromPos + 2) % filled.length] ?? -1
    morphFromIdx.value  = nextFrom
    morphToIdx.value    = nextTo
    morphSegStart       = ts
    morphProgress.value = 0
  }

  morphRaf = requestAnimationFrame(runMorph)
}

const isOverload = computed(() =>
  isRunning.value && (params.rust > 0.72 || (params.density > 0.88 && params.grain > 0.65))
)

const IDLE_MESSAGES = ['SYSTEM OFFLINE', 'STANDBY MODE', 'AWAITING ACTIVATION']
const RUN_MESSAGES = [
  'HARMONIC GENERATION ACTIVE',
  'PRESSURE STABLE',
  'SPECTRAL DIFFUSION NOMINAL',
  'SUB-HARMONIC RESONANCE DETECTED',
  'DRONE ASSEMBLY IN PROGRESS',
  'FREQUENCY MATRIX INITIALIZED',
  'ATMOSPHERIC CALIBRATION COMPLETE',
  'SIGNAL ROUTING VERIFIED',
]
const WARN_MESSAGES = [
  'HARMONIC INSTABILITY DETECTED',
  'PRESSURE OVERLOAD WARNING',
  'DISTORTION THRESHOLD EXCEEDED',
  'SYSTEM STRESS ELEVATED',
]

const statusMsgIdx = ref(0)
let statusInterval = 0

const statusLabel = computed(() => {
  if (isStarting.value) return 'INITIALISING AUDIO…'
  if (!isRunning.value) return IDLE_MESSAGES[statusMsgIdx.value % IDLE_MESSAGES.length]
  if (isOverload.value) return WARN_MESSAGES[statusMsgIdx.value % WARN_MESSAGES.length]
  return RUN_MESSAGES[statusMsgIdx.value % RUN_MESSAGES.length]
})

const bgCanvas = ref<HTMLCanvasElement | null>(null)

function drawGrid() {
  const canvas = bgCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const w = canvas.width
  const h = canvas.height
  const size = 44

  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(50, 50, 50, 0.5)'
  ctx.lineWidth = 0.5

  for (let x = 0; x <= w; x += size) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y <= h; y += size) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
}

const oscCanvas = ref<HTMLCanvasElement | null>(null)
let oscAnimFrame = 0

function startOscilloscope() {
  const canvas = oscCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  if (!ctx) return

  function resize() {
    if (!canvas) return
    canvas.width = canvas.offsetWidth * window.devicePixelRatio
    canvas.height = canvas.offsetHeight * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  }
  resize()

  const MIN_DB  = -80
  const MAX_DB  = -5
  const MIN_HZ  = 18
  const MAX_HZ  = 18000
  const NYQUIST = 22050

  function draw() {
    if (!canvas) return
    const dpr = window.devicePixelRatio
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.clearRect(0, 0, w, h)

    const fft = engine?.getFFTData()

    if (!fft || !isRunning.value) {
      ctx.strokeStyle = '#1e1e1e'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h - 2)
      ctx.lineTo(w, h - 2)
      ctx.stroke()
      oscAnimFrame = requestAnimationFrame(draw)
      return
    }

    ctx.strokeStyle = '#888'
    ctx.lineWidth = 1
    ctx.beginPath()

    let started = false
    for (let i = 0; i < fft.length; i++) {
      const freq = (i / fft.length) * NYQUIST
      if (freq < MIN_HZ) continue
      if (freq > MAX_HZ) break

      const xNorm = Math.log(freq / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ)
      const x = xNorm * w
      const db = Math.max(MIN_DB, Math.min(MAX_DB, fft[i] ?? MIN_DB))
      const y = h - h * ((db - MIN_DB) / (MAX_DB - MIN_DB))

      if (!started) { ctx.moveTo(x, y); started = true }
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    ctx.strokeStyle = '#1e1e1e'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, h - 1)
    ctx.lineTo(w, h - 1)
    ctx.stroke()

    oscAnimFrame = requestAnimationFrame(draw)
  }
  draw()

  return () => cancelAnimationFrame(oscAnimFrame)
}

async function handleStart() {
  if (isRunning.value || isStarting.value) return
  isStarting.value = true
  try {
    const e = getEngine()
    e.setVolume(params.volume)
    e.setDarkness(params.darkness)
    e.setMotion(params.motion)
    e.setDensity(params.density)
    await e.start()
    e.setGrain(params.grain)
    e.setRust(params.rust)
    e.setHum(params.hum)
    e.setFracture(params.fracture)
    e.setSpace(params.space)
    e.setPulse(params.pulse)
    e.setPureDrone(params.pureDrone)
    e.setRoot(params.root)
    e.setIntervalSpread(params.intervalSpread)
    isRunning.value = true
    track('engine_start', { mode: params.mode })
  } catch (err) {
    console.error('[DroneEngine] start failed:', err)
  } finally {
    isStarting.value = false
  }
}

function handleStop() {
  if (!isRunning.value) return
  getEngine().stop()
  isRunning.value = false
  track('engine_stop')
}

function handleRandomize() {
  const e = getEngine()
  e.randomize()
  const p = e.currentParams
  params.volume = p.volume
  params.darkness = p.darkness
  params.motion = p.motion
  params.density = p.density
  params.grain = p.grain
  params.rust = p.rust
  params.hum = p.hum
  params.fracture = p.fracture
  params.space = p.space
  params.pulse = p.pulse
  params.pureDrone = p.pureDrone
  params.root = p.root
  params.intervalSpread = p.intervalSpread
  params.mode = 'MANUAL'
  activePreset.value = null
  track('sound_randomize')
}

function openGuide() {
  showGuide.value = true
  track('guide_open')
}

function closeGuide() {
  showGuide.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showGuide.value) closeGuide()
}

function setVolume(v: number)   { params.volume = v; engine?.setVolume(v) }
function setDarkness(v: number) { if (morphActive.value) stopMorph(); params.darkness = v; engine?.setDarkness(v) }
function setMotion(v: number)   { if (morphActive.value) stopMorph(); params.motion = v; engine?.setMotion(v) }
function setDensity(v: number)  { if (morphActive.value) stopMorph(); params.density = v; engine?.setDensity(v) }
function setGrain(v: number)    { if (morphActive.value) stopMorph(); params.grain = v; engine?.setGrain(v) }
function setRust(v: number)     { if (morphActive.value) stopMorph(); params.rust = v; engine?.setRust(v) }
function setHum(v: number)      { if (morphActive.value) stopMorph(); params.hum = v; engine?.setHum(v) }
function setFracture(v: number) { if (morphActive.value) stopMorph(); params.fracture = v; engine?.setFracture(v) }
function setSpace(v: number)    { if (morphActive.value) stopMorph(); params.space = v; engine?.setSpace(v) }
function setPulse(v: number)    { if (morphActive.value) stopMorph(); params.pulse = v; engine?.setPulse(v) }
function setPureDrone(v: boolean) { if (morphActive.value) stopMorph(); params.pureDrone = v; engine?.setPureDrone(v) }
function setRoot(v: number)     { if (morphActive.value) stopMorph(); params.root = v; engine?.setRoot(v) }
function setIntervalSpread(v: number) { if (morphActive.value) stopMorph(); params.intervalSpread = v; engine?.setIntervalSpread(v) }

function setMode(mode: string) {
  params.mode = mode as SoundMode
  const e = getEngine()
  e.setMode(mode as SoundMode)
  const p = e.currentParams
  params.darkness = p.darkness
  params.motion = p.motion
  params.density = p.density
  params.grain = p.grain
  params.rust = p.rust
  params.hum = p.hum
  params.fracture = p.fracture
  params.space = p.space
  params.pulse = p.pulse
  params.pureDrone = p.pureDrone
  params.root = p.root
  params.intervalSpread = p.intervalSpread
  activePreset.value = null
}

function refreshPresets() {
  presetNames.value = getEngine().getPresetNames()
}

function savePreset(name: string) {
  getEngine().savePreset(name)
  refreshPresets()
  activePreset.value = name
}

function loadPreset(name: string) {
  const e = getEngine()
  if (e.loadPreset(name)) {
    const p = e.currentParams
    params.volume = p.volume
    params.darkness = p.darkness
    params.motion = p.motion
    params.density = p.density
    params.grain = p.grain
    params.rust = p.rust
    params.hum = p.hum
    params.fracture = p.fracture
    params.space = p.space
    params.pulse = p.pulse
    params.pureDrone = p.pureDrone
    params.root = p.root
    params.intervalSpread = p.intervalSpread
    params.mode = e.currentMode
    activePreset.value = name
  }
}

function deletePreset(name: string) {
  getEngine().deletePreset(name)
  if (activePreset.value === name) activePreset.value = null
  refreshPresets()
}

function handleStartRecord() {
  if (!engine || !isRunning.value) return
  engine.startRecording()
  isRecording.value = true
  track('record_start')
  recordingElapsed.value = 0
  recElapsedInterval = window.setInterval(() => {
    recordingElapsed.value = engine?.recordingElapsed ?? 0
  }, 1000)
}

async function handleStopRecord() {
  if (!engine) return
  clearInterval(recElapsedInterval)
  recElapsedInterval = 0
  await engine.stopRecording()
  track('record_stop')
  isRecording.value = false
  recordingElapsed.value = 0
}

let stopOsc: (() => void) | undefined

onMounted(() => {
  drawGrid()
  window.addEventListener('resize', drawGrid)
  window.addEventListener('keydown', handleKeydown)

  stopOsc = startOscilloscope() ?? undefined

  statusInterval = window.setInterval(() => {
    statusMsgIdx.value++
  }, 4200)

  refreshPresets()
})

onUnmounted(() => {
  stopOsc?.()
  stopMorph()
  window.removeEventListener('resize', drawGrid)
  window.removeEventListener('keydown', handleKeydown)
  clearInterval(statusInterval)
  clearInterval(recElapsedInterval)
  engine?.dispose()
  engine = null
})
</script>
