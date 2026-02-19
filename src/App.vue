<template>
  <div class="app" :class="{ running: isRunning }">

    <!-- ── Subtle grid background ─────────────────────────────────────────── -->
    <canvas ref="bgCanvas" class="bg-canvas" aria-hidden="true" />

    <!-- ── Header ────────────────────────────────────────────────────────── -->
    <header class="app-header">
      <p class="plant-title">LEELULZ DRONE MANUFACTURING PLANT</p>
      <p class="plant-subtitle">Autonomous Harmonic Fabrication Facility</p>
      <div class="status-row">
        <span class="status-dot" :class="{ active: isRunning }" />
        <span class="status-text" :class="{ warning: isOverload }">{{ statusLabel }}</span>
        <span v-if="isOverload" class="overload-tag">!! OVERLOAD</span>
      </div>
    </header>

    <!-- ── Oscilloscope ───────────────────────────────────────────────────── -->
    <div class="oscilloscope" aria-hidden="true">
      <canvas ref="oscCanvas" class="osc-canvas" />
    </div>

    <!-- ── Controls ──────────────────────────────────────────────────────── -->
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
      @save-preset="savePreset"
      @load-preset="loadPreset"
      @delete-preset="deletePreset"
      @start-record="handleStartRecord"
      @stop-record="handleStopRecord"
    />

    <!-- ── Footer ────────────────────────────────────────────────────────── -->
    <footer class="app-footer">
      <span>No server · No tracking</span>
    </footer>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import Controls from './components/Controls.vue'
import { DroneEngine } from './audio/DroneEngine'
import type { SoundMode } from './audio/DroneEngine'

// ── Engine (lazy) ────────────────────────────────────────────────────────────
let engine: DroneEngine | null = null

function getEngine(): DroneEngine {
  if (!engine) engine = new DroneEngine()
  return engine
}

// ── UI state ─────────────────────────────────────────────────────────────────
const isRunning = ref(false)
const isStarting = ref(false)

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
})

const presetNames = ref<string[]>([])
const activePreset = ref<string | null>(null)

// ── Recording state ───────────────────────────────────────────────────────────
const isRecording = ref(false)
const recordingElapsed = ref(0)
let recElapsedInterval = 0

// ── Overload detection ────────────────────────────────────────────────────────
const isOverload = computed(() =>
  isRunning.value && (params.rust > 0.72 || (params.density > 0.88 && params.grain > 0.65))
)

// ── Factory status messages ───────────────────────────────────────────────────
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

// ── Background grid canvas ────────────────────────────────────────────────────
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
  ctx.strokeStyle = 'rgba(60, 60, 60, 0.35)'
  ctx.lineWidth = 0.5

  for (let x = 0; x <= w; x += size) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y <= h; y += size) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
}

// ── Oscilloscope canvas ───────────────────────────────────────────────────────
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

  let t = 0

  function draw() {
    if (!canvas) return
    const dpr = window.devicePixelRatio
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.clearRect(0, 0, w, h)

    // Flat line when stopped
    if (!isRunning.value) {
      ctx.strokeStyle = '#222'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
      t++
      oscAnimFrame = requestAnimationFrame(draw)
      return
    }

    // Primary waveform
    const amp = h * 0.36 * (0.12 + params.motion * 0.5 + params.fracture * 0.3)
    const d = params.density
    const frac = params.fracture
    const ts = t * 0.016

    ctx.strokeStyle = '#777'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x <= w; x++) {
      const nx = x / w
      const y = h / 2
        + Math.sin(nx * Math.PI * 2 * (3 + d * 7) + ts * (1.2 + params.motion * 3)) * amp * 0.55
        + Math.sin(nx * Math.PI * 2 * (1.8 + d * 4) * 1.618 + ts * (0.8 + params.motion * 2) + 1.3) * amp * 0.28
        + Math.sin(nx * Math.PI * 2 * 0.8 + ts * 0.4 + frac * 8) * amp * 0.17
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Secondary trace (dimmer, slower)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x <= w; x++) {
      const nx = x / w
      const y = h / 2
        + Math.sin(nx * Math.PI * 2 * (1.5 + d * 3) + ts * 0.5 + 2.1) * amp * 0.38
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    t++
    oscAnimFrame = requestAnimationFrame(draw)
  }
  draw()

  return () => cancelAnimationFrame(oscAnimFrame)
}

// ── Transport handlers ────────────────────────────────────────────────────────
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
    // Apply texture params after start (engine now initialized)
    e.setGrain(params.grain)
    e.setRust(params.rust)
    e.setHum(params.hum)
    e.setFracture(params.fracture)
    e.setSpace(params.space)
    isRunning.value = true
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
}

function handleRandomize() {
  const e = getEngine()
  e.randomize()
  const p = e.currentParams
  params.volume = p.volume
  params.darkness = p.darkness
  params.motion = p.motion
  params.density = p.density
  params.mode = 'MANUAL'
  activePreset.value = null
}

// ── Param handlers ────────────────────────────────────────────────────────────
function setVolume(v: number) { params.volume = v; engine?.setVolume(v) }
function setDarkness(v: number) { params.darkness = v; engine?.setDarkness(v) }
function setMotion(v: number) { params.motion = v; engine?.setMotion(v) }
function setDensity(v: number) { params.density = v; engine?.setDensity(v) }
function setGrain(v: number) { params.grain = v; engine?.setGrain(v) }
function setRust(v: number) { params.rust = v; engine?.setRust(v) }
function setHum(v: number) { params.hum = v; engine?.setHum(v) }
function setFracture(v: number) { params.fracture = v; engine?.setFracture(v) }
function setSpace(v: number) { params.space = v; engine?.setSpace(v) }

function setMode(mode: string) {
  params.mode = mode as SoundMode
  const e = getEngine()
  e.setMode(mode as SoundMode)
  // Sync all params from engine after mode applies
  const p = e.currentParams
  params.darkness = p.darkness
  params.motion = p.motion
  params.density = p.density
  params.grain = p.grain
  params.rust = p.rust
  params.hum = p.hum
  params.fracture = p.fracture
  params.space = p.space
  activePreset.value = null
}

// ── Preset handlers ───────────────────────────────────────────────────────────
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
    params.mode = e.currentMode
    activePreset.value = name
  }
}

function deletePreset(name: string) {
  getEngine().deletePreset(name)
  if (activePreset.value === name) activePreset.value = null
  refreshPresets()
}

// ── Recording handlers ────────────────────────────────────────────────────────
function handleStartRecord() {
  if (!engine || !isRunning.value) return
  engine.startRecording()
  isRecording.value = true
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
  isRecording.value = false
  recordingElapsed.value = 0
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
let stopOsc: (() => void) | undefined

onMounted(() => {
  drawGrid()
  window.addEventListener('resize', drawGrid)

  stopOsc = startOscilloscope() ?? undefined

  // Cycle status messages
  statusInterval = window.setInterval(() => {
    statusMsgIdx.value++
  }, 4200)

  refreshPresets()
})

onUnmounted(() => {
  stopOsc?.()
  window.removeEventListener('resize', drawGrid)
  clearInterval(statusInterval)
  clearInterval(recElapsedInterval)
  engine?.dispose()
  engine = null
})
</script>
