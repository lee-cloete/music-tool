<template>
  <section class="controls" aria-label="Drone Engine Controls">

    <!-- ── Transport ─────────────────────────────────────────────────────── -->
    <div class="section">
      <div class="transport">
        <button
          class="btn btn-primary"
          :class="{ active: isRunning }"
          :disabled="isStarting"
          @click="$emit('start')"
          aria-label="Start drone"
        >
          <span class="btn-icon">{{ isStarting ? '◌' : '▶' }}</span>
          <span>{{ isStarting ? 'INIT…' : 'START' }}</span>
        </button>

        <button
          class="btn"
          :disabled="!isRunning"
          @click="$emit('stop')"
          aria-label="Stop drone"
        >
          <span class="btn-icon">■</span>
          <span>STOP</span>
        </button>

        <button
          class="btn btn-accent"
          @click="$emit('randomize')"
          title="Randomise all parameters"
          aria-label="Randomize parameters"
        >
          <span class="btn-icon">⟳</span>
          <span>RANDOMIZE</span>
        </button>
      </div>
    </div>

    <!-- ── Synthesis mode ─────────────────────────────────────────────────── -->
    <div class="section">
      <div class="section-header">SYNTHESIS MODE</div>
      <div class="mode-row">
        <span class="mode-label">MODE</span>
        <select
          class="mode-select"
          :value="mode"
          @change="$emit('update:mode', ($event.target as HTMLSelectElement).value)"
          aria-label="Sound mode"
        >
          <option v-for="m in SOUND_MODES" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>
    </div>

    <!-- ── Core parameters ────────────────────────────────────────────────── -->
    <div class="section">
      <div class="section-header">CORE PARAMETERS</div>
      <div class="param-grid">

        <div class="param-row">
          <label class="param-label" for="ctrl-volume">VOLUME</label>
          <input
            id="ctrl-volume"
            type="range" min="0" max="1" step="0.01"
            :value="volume"
            @input="$emit('update:volume', parseFloat(($event.target as HTMLInputElement).value))"
            aria-label="Volume"
          />
          <span class="param-value">{{ pct(volume) }}</span>
        </div>

        <div class="param-row">
          <label class="param-label" for="ctrl-darkness">DARKNESS</label>
          <input
            id="ctrl-darkness"
            type="range" min="0" max="1" step="0.01"
            :value="darkness"
            @input="$emit('update:darkness', parseFloat(($event.target as HTMLInputElement).value))"
            aria-label="Darkness — filter cutoff"
          />
          <span class="param-value">{{ pct(darkness) }}</span>
        </div>

        <div class="param-row">
          <label class="param-label" for="ctrl-motion">MOTION</label>
          <input
            id="ctrl-motion"
            type="range" min="0" max="1" step="0.01"
            :value="motion"
            @input="$emit('update:motion', parseFloat(($event.target as HTMLInputElement).value))"
            aria-label="Motion — modulation depth and rate"
          />
          <span class="param-value">{{ pct(motion) }}</span>
        </div>

        <div class="param-row">
          <label class="param-label" for="ctrl-density">DENSITY</label>
          <input
            id="ctrl-density"
            type="range" min="0" max="1" step="0.01"
            :value="density"
            @input="$emit('update:density', parseFloat(($event.target as HTMLInputElement).value))"
            aria-label="Density — detune and richness"
          />
          <span class="param-value">{{ pct(density) }}</span>
        </div>

      </div>
    </div>

    <!-- ── Texture generator ──────────────────────────────────────────────── -->
    <div class="section">
      <div class="section-header">TEXTURE GENERATOR</div>
      <div class="param-grid">

        <div class="param-row">
          <label class="param-label" for="ctrl-grain">GRAIN</label>
          <input
            id="ctrl-grain"
            type="range" min="0" max="1" step="0.01"
            :value="grain"
            @input="$emit('update:grain', parseFloat(($event.target as HTMLInputElement).value))"
            aria-label="Grain — noise texture level"
          />
          <span class="param-value">{{ pct(grain) }}</span>
        </div>

        <div class="param-row">
          <label class="param-label" for="ctrl-rust">RUST</label>
          <input
            id="ctrl-rust"
            type="range" min="0" max="1" step="0.01"
            :value="rust"
            @input="$emit('update:rust', parseFloat(($event.target as HTMLInputElement).value))"
            aria-label="Rust — distortion grit"
          />
          <span class="param-value">{{ pct(rust) }}</span>
        </div>

        <div class="param-row">
          <label class="param-label" for="ctrl-hum">HUM</label>
          <input
            id="ctrl-hum"
            type="range" min="0" max="1" step="0.01"
            :value="hum"
            @input="$emit('update:hum', parseFloat(($event.target as HTMLInputElement).value))"
            aria-label="Hum — low frequency modulation"
          />
          <span class="param-value">{{ pct(hum) }}</span>
        </div>

        <div class="param-row">
          <label class="param-label" for="ctrl-fracture">FRACTURE</label>
          <input
            id="ctrl-fracture"
            type="range" min="0" max="1" step="0.01"
            :value="fracture"
            @input="$emit('update:fracture', parseFloat(($event.target as HTMLInputElement).value))"
            aria-label="Fracture — pitch instability"
          />
          <span class="param-value">{{ pct(fracture) }}</span>
        </div>

        <div class="param-row">
          <label class="param-label" for="ctrl-space">SPACE</label>
          <input
            id="ctrl-space"
            type="range" min="0" max="1" step="0.01"
            :value="space"
            @input="$emit('update:space', parseFloat(($event.target as HTMLInputElement).value))"
            aria-label="Space — reverb wetness"
          />
          <span class="param-value">{{ pct(space) }}</span>
        </div>

      </div>
    </div>

    <!-- ── Record row ─────────────────────────────────────────────────────── -->
    <div class="section">
      <div class="record-row">
        <button
          class="btn btn-record"
          :class="{ recording: isRecording }"
          :disabled="!isRunning && !isRecording"
          @click="isRecording ? $emit('stop-record') : $emit('start-record')"
          :aria-label="isRecording ? 'Stop recording' : 'Start recording'"
        >
          <span class="rec-dot" :class="{ active: isRecording }" aria-hidden="true" />
          <span>{{ isRecording ? 'STOP REC' : 'RECORD' }}</span>
        </button>

        <Transition name="fade">
          <span v-if="isRecording" class="rec-timer" aria-live="polite">
            {{ elapsedDisplay }}
          </span>
        </Transition>

        <span v-if="!isRunning && !isRecording" class="rec-hint">
          START ENGINE TO RECORD
        </span>
      </div>
    </div>

    <!-- ── Preset panel ───────────────────────────────────────────────────── -->
    <div class="section">
      <div class="section-header">PRESETS</div>
      <div class="preset-panel">
        <div class="preset-row">
          <input
            v-model="presetNameInput"
            class="preset-input"
            type="text"
            placeholder="PRESET NAME…"
            maxlength="32"
            @keyup.enter="handleSave"
            aria-label="Preset name"
          />
          <button class="btn btn-ghost" @click="handleSave" :disabled="!presetNameInput.trim()">
            SAVE
          </button>
        </div>

        <div v-if="presetNames.length > 0" class="preset-list">
          <div
            v-for="name in presetNames"
            :key="name"
            class="preset-item"
            :class="{ selected: name === activePreset }"
          >
            <button class="preset-load" @click="$emit('load-preset', name)">
              {{ name }}
            </button>
            <button
              class="preset-delete"
              @click="$emit('delete-preset', name)"
              :title="`Delete preset '${name}'`"
              aria-label="Delete preset"
            >×</button>
          </div>
        </div>
      </div>
    </div>

  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { SOUND_MODES } from '../audio/DroneEngine'
import type { SoundMode } from '../audio/DroneEngine'

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps<{
  isRunning: boolean
  isStarting: boolean
  volume: number
  darkness: number
  motion: number
  density: number
  mode: SoundMode
  grain: number
  rust: number
  hum: number
  fracture: number
  space: number
  presetNames: string[]
  activePreset: string | null
  isRecording: boolean
  recordingElapsed: number
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  start: []
  stop: []
  randomize: []
  'update:volume': [value: number]
  'update:darkness': [value: number]
  'update:motion': [value: number]
  'update:density': [value: number]
  'update:mode': [value: string]
  'update:grain': [value: number]
  'update:rust': [value: number]
  'update:hum': [value: number]
  'update:fracture': [value: number]
  'update:space': [value: number]
  'save-preset': [name: string]
  'load-preset': [name: string]
  'delete-preset': [name: string]
  'start-record': []
  'stop-record': []
}>()

// ── Local state ───────────────────────────────────────────────────────────────
const presetNameInput = ref('')

function handleSave() {
  const name = presetNameInput.value.trim()
  if (!name) return
  emit('save-preset', name)
  presetNameInput.value = ''
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(v: number): string {
  return String(Math.round(v * 100)).padStart(3, ' ')
}

const elapsedDisplay = computed(() => {
  const secs = props.recordingElapsed
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})
</script>
