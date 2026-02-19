<template>
  <section class="controls" aria-label="Drone Engine Controls">

    <!-- ── Transport ─────────────────────────────────────────────────────── -->
    <div class="transport">
      <button
        class="btn btn-primary"
        :class="{ active: isRunning }"
        :disabled="isStarting"
        @click="$emit('start')"
        aria-label="Start drone"
      >
        <span class="btn-icon">{{ isStarting ? '⧗' : '▶' }}</span>
        <span class="btn-label">{{ isStarting ? 'Loading…' : 'Start' }}</span>
      </button>

      <button
        class="btn btn-secondary"
        :disabled="!isRunning"
        @click="$emit('stop')"
        aria-label="Stop drone"
      >
        <span class="btn-icon">■</span>
        <span class="btn-label">Stop</span>
      </button>

      <button
        class="btn btn-accent"
        @click="$emit('randomize')"
        :title="'Randomise all parameters (smooth transition)'"
        aria-label="Randomize parameters"
      >
        <span class="btn-icon">⟳</span>
        <span class="btn-label">Randomize</span>
      </button>
    </div>

    <!-- ── Sliders ────────────────────────────────────────────────────────── -->
    <div class="sliders">

      <ControlKnob
        label="Volume"
        :value="volume"
        :min="0"
        :max="1"
        :step="0.01"
        sublabel="Output level"
        @update:value="$emit('update:volume', $event)"
      />

      <ControlKnob
        label="Darkness"
        :value="darkness"
        :min="0"
        :max="1"
        :step="0.01"
        sublabel="Filter cutoff"
        @update:value="$emit('update:darkness', $event)"
      />

      <ControlKnob
        label="Motion"
        :value="motion"
        :min="0"
        :max="1"
        :step="0.01"
        sublabel="Mod depth & rate"
        @update:value="$emit('update:motion', $event)"
      />

      <ControlKnob
        label="Density"
        :value="density"
        :min="0"
        :max="1"
        :step="0.01"
        sublabel="Detune & richness"
        @update:value="$emit('update:density', $event)"
      />

    </div>

    <!-- ── Preset panel ───────────────────────────────────────────────────── -->
    <div class="preset-panel">
      <div class="preset-row">
        <input
          v-model="presetNameInput"
          class="preset-input"
          type="text"
          placeholder="Preset name…"
          maxlength="32"
          @keyup.enter="handleSave"
          aria-label="Preset name"
        />
        <button class="btn btn-ghost" @click="handleSave" :disabled="!presetNameInput.trim()">
          Save
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
          >
            ×
          </button>
        </div>
      </div>
    </div>

  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ControlKnob from './ControlKnob.vue'

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps<{
  isRunning: boolean
  isStarting: boolean
  volume: number
  darkness: number
  motion: number
  density: number
  presetNames: string[]
  activePreset: string | null
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
  'save-preset': [name: string]
  'load-preset': [name: string]
  'delete-preset': [name: string]
}>()

// ── Local state ───────────────────────────────────────────────────────────────
const presetNameInput = ref('')

function handleSave() {
  const name = presetNameInput.value.trim()
  if (!name) return
  emit('save-preset', name)
  presetNameInput.value = ''
}
</script>
