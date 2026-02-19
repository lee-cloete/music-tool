<template>
  <div class="app" :class="{ running: isRunning }">

    <!-- ── Ambient background canvas ─────────────────────────────────────── -->
    <canvas ref="bgCanvas" class="bg-canvas" aria-hidden="true" />

    <!-- ── Header ────────────────────────────────────────────────────────── -->
    <header class="app-header">
      <p class="app-subtitle">Cinematic Drone Engine</p>
      <div class="status-row">
        <span class="status-dot" :class="{ active: isRunning }" />
        <span class="status-text">{{ statusLabel }}</span>
      </div>
    </header>

    <!-- ── Visualiser bars ───────────────────────────────────────────────── -->
    <div class="visualiser" aria-hidden="true">
      <div
        v-for="(h, i) in visBars"
        :key="i"
        class="vis-bar"
        :style="{ height: `${h}%`, animationDelay: `${i * 0.18}s` }"
      />
    </div>

    <!-- ── Controls ──────────────────────────────────────────────────────── -->
    <Controls
      :is-running="isRunning"
      :is-starting="isStarting"
      :volume="params.volume"
      :darkness="params.darkness"
      :motion="params.motion"
      :density="params.density"
      :preset-names="presetNames"
      :active-preset="activePreset"
      @start="handleStart"
      @stop="handleStop"
      @randomize="handleRandomize"
      @update:volume="setVolume"
      @update:darkness="setDarkness"
      @update:motion="setMotion"
      @update:density="setDensity"
      @save-preset="savePreset"
      @load-preset="loadPreset"
      @delete-preset="deletePreset"
    />

    <!-- ── Footer ────────────────────────────────────────────────────────── -->
    <footer class="app-footer">
      <span>All audio client-side · No server · No tracking</span>
    </footer>

  </div>
</template>

<script setup lang="ts">
/**
 * App.vue – root shell for the Cinematic Drone Engine.
 *
 * Audio is initialised ONLY inside a user-gesture handler (handleStart).
 * DroneEngine is lazily created on first start and reused thereafter.
 * No audio code runs at module evaluation time.
 */

import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import Controls from './components/Controls.vue'
import { DroneEngine } from './audio/DroneEngine'

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
  volume: 0.7,
  darkness: 0.45,
  motion: 0.4,
  density: 0.45,
})

const presetNames = ref<string[]>([])
const activePreset = ref<string | null>(null)

const statusLabel = computed(() => {
  if (isStarting.value) return 'Initialising audio…'
  if (isRunning.value) return 'Running'
  return 'Stopped'
})

// ── Background canvas ─────────────────────────────────────────────────────────
const bgCanvas = ref<HTMLCanvasElement | null>(null)
let animFrame = 0

function startBgAnimation() {
  const canvas = bgCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let t = 0

  function resize() {
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)

  function draw() {
    if (!canvas || !ctx) return
    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    const cx = w * 0.5 + Math.sin(t * 0.0003) * w * 0.15
    const cy = h * 0.5 + Math.cos(t * 0.00025) * h * 0.1

    const dark = params.darkness
    const alpha = isRunning.value ? 0.06 + dark * 0.08 : 0.03

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.65)
    const r = Math.round(40 + (1 - dark) * 20)
    const b = Math.round(60 + dark * 30)
    grad.addColorStop(0, `rgba(${r}, 15, ${b}, ${alpha})`)
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')

    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    t++
    animFrame = requestAnimationFrame(draw)
  }
  draw()

  return () => {
    cancelAnimationFrame(animFrame)
    window.removeEventListener('resize', resize)
  }
}

// ── Visualiser ────────────────────────────────────────────────────────────────
const BAR_COUNT = 24
const visBars = ref<number[]>(Array(BAR_COUNT).fill(8))
let visInterval = 0

function updateVisBars() {
  const t = Date.now() / 1000
  const density = params.density
  const motion = params.motion
  const base = isRunning.value ? 8 + density * 12 : 4

  visBars.value = Array.from({ length: BAR_COUNT }, (_, i) => {
    const phase = (i / BAR_COUNT) * Math.PI * 2
    const slow = Math.sin(t * (0.2 + motion * 0.4) + phase)
    const fast = Math.sin(t * (0.7 + motion * 0.8) + phase * 1.6) * 0.4
    return Math.max(2, base + (slow + fast) * (isRunning.value ? 10 + density * 14 : 3))
  })
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
  activePreset.value = null
}

// ── Slider handlers ───────────────────────────────────────────────────────────
function setVolume(v: number) {
  params.volume = v
  engine?.setVolume(v)
}

function setDarkness(v: number) {
  params.darkness = v
  engine?.setDarkness(v)
}

function setMotion(v: number) {
  params.motion = v
  engine?.setMotion(v)
}

function setDensity(v: number) {
  params.density = v
  engine?.setDensity(v)
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
    activePreset.value = name
  }
}

function deletePreset(name: string) {
  getEngine().deletePreset(name)
  if (activePreset.value === name) activePreset.value = null
  refreshPresets()
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
let stopBg: (() => void) | undefined

onMounted(() => {
  stopBg = startBgAnimation() ?? undefined
  visInterval = window.setInterval(updateVisBars, 80)
  refreshPresets()
})

onUnmounted(() => {
  stopBg?.()
  clearInterval(visInterval)
  engine?.dispose()
  engine = null
})
</script>
