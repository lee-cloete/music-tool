<template>
  <div class="knob-wrapper">
    <label class="knob-label" :for="inputId">{{ label }}</label>

    <!-- Circular SVG arc ───────────────────────────────────────────────── -->
    <div class="knob-ring-wrap" @pointerdown="startDrag" @click.stop>
      <svg
        class="knob-ring"
        viewBox="0 0 60 60"
        aria-hidden="true"
      >
        <!-- Track arc -->
        <path
          :d="arcPath(0)"
          class="arc-track"
          fill="none"
          stroke-width="4"
          stroke-linecap="round"
        />
        <!-- Value arc -->
        <path
          :d="arcPath(normalised)"
          class="arc-value"
          fill="none"
          stroke-width="4"
          stroke-linecap="round"
        />
        <!-- Indicator dot -->
        <circle
          :cx="dotPos.x"
          :cy="dotPos.y"
          r="3"
          class="arc-dot"
        />
      </svg>

      <!-- Percentage readout inside circle -->
      <span class="knob-pct">{{ Math.round(normalised * 100) }}</span>
    </div>

    <!-- Native range for keyboard + accessibility ──────────────────────── -->
    <input
      :id="inputId"
      class="knob-range-sr"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="value"
      @input="onInput"
      :aria-valuetext="`${label}: ${Math.round(normalised * 100)}%`"
    />

    <span class="knob-sublabel">{{ sublabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'

// ── Props / emits ─────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  label: string
  sublabel?: string
  value: number
  min?: number
  max?: number
  step?: number
}>(), {
  min: 0,
  max: 1,
  step: 0.01,
  sublabel: '',
})

const emit = defineEmits<{ 'update:value': [v: number] }>()

// ── Unique ID for a11y label pairing ─────────────────────────────────────────
let _idCounter = 0
const inputId = `knob-${_idCounter++}`

// ── Derived ───────────────────────────────────────────────────────────────────
const normalised = computed(() => (props.value - props.min) / (props.max - props.min))

// ── Arc geometry ─────────────────────────────────────────────────────────────
//  Arc goes from -225° to +45°  (270° travel, starting bottom-left)
const CX = 30
const CY = 30
const R = 22
const START_DEG = -225
const END_DEG = 45

function degToRad(d: number) { return (d * Math.PI) / 180 }

function polarToXY(deg: number) {
  const r = degToRad(deg)
  return { x: CX + R * Math.cos(r), y: CY + R * Math.sin(r) }
}

function arcPath(norm: number): string {
  const startA = START_DEG
  const sweepDeg = (END_DEG - START_DEG) * norm
  const endA = startA + sweepDeg

  const from = polarToXY(startA)
  const to = polarToXY(endA)
  const largeArc = sweepDeg > 180 ? 1 : 0

  if (norm <= 0) return `M ${from.x} ${from.y}`
  return `M ${from.x} ${from.y} A ${R} ${R} 0 ${largeArc} 1 ${to.x} ${to.y}`
}

const dotPos = computed(() => {
  const sweepDeg = (END_DEG - START_DEG) * normalised.value
  return polarToXY(START_DEG + sweepDeg)
})

// ── Drag ──────────────────────────────────────────────────────────────────────
const dragging = ref(false)
let lastY = 0
const DRAG_SENSITIVITY = 0.004

function startDrag(e: PointerEvent) {
  dragging.value = true
  lastY = e.clientY
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stopDrag)
  window.addEventListener('pointercancel', stopDrag)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const dy = lastY - e.clientY          // up → positive
  lastY = e.clientY
  const delta = dy * DRAG_SENSITIVITY * (props.max - props.min)
  emit('update:value', clamp(props.value + delta, props.min, props.max))
}

function stopDrag() {
  dragging.value = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', stopDrag)
  window.removeEventListener('pointercancel', stopDrag)
}

onUnmounted(stopDrag)

// ── Native range fallback ─────────────────────────────────────────────────────
function onInput(e: Event) {
  emit('update:value', parseFloat((e.target as HTMLInputElement).value))
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
</script>
