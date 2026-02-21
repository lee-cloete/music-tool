<template>
  <section class="controls" aria-label="Snapshot Morpher">
    <div class="section">
      <div class="section-header">SNAPSHOT MORPHER</div>

      <!-- ── Snapshot slots ──────────────────────────────────────────────── -->
      <div class="snap-slots">
        <div
          v-for="(snap, i) in snapshots"
          :key="i"
          class="snap-slot"
          :class="{
            filled:      snap !== null,
            'morph-from': morphFromIdx === i,
            'morph-to':   morphToIdx   === i,
          }"
        >
          <!-- Empty slot: click to capture -->
          <button
            v-if="snap === null"
            class="snap-num"
            @click="$emit('capture', i)"
            :title="`Capture snapshot ${i + 1}`"
          >{{ i + 1 }}</button>

          <!-- Filled slot: click label to load, × to delete -->
          <template v-else>
            <button
              class="snap-num"
              @click="$emit('load', i)"
              :title="`Load snapshot ${i + 1}`"
            >{{ i + 1 }}</button>
            <button
              class="snap-del"
              @click="$emit('delete', i)"
              :title="`Delete snapshot ${i + 1}`"
            >×</button>
          </template>
        </div>
      </div>

      <!-- ── Morph controls (only shown with ≥2 snapshots) ─────────────── -->
      <template v-if="filledCount >= 2">
        <!-- Progress track: a line with a moving cursor -->
        <div class="morph-track" role="progressbar" :aria-valuenow="Math.round(progress * 100)">
          <div class="morph-fill" :style="{ width: `${progress * 100}%` }" />
        </div>

        <div class="morph-row">
          <select
            class="mode-select morph-dur"
            :value="duration"
            @change="$emit('update:duration', Number(($event.target as HTMLSelectElement).value))"
            aria-label="Morph step duration"
          >
            <option :value="4">4S / STEP</option>
            <option :value="8">8S / STEP</option>
            <option :value="16">16S / STEP</option>
            <option :value="32">32S / STEP</option>
          </select>

          <button
            class="btn"
            :class="{ 'btn-primary active': active }"
            @click="$emit('toggle')"
            :aria-label="active ? 'Stop morphing' : 'Start morphing'"
          >
            <span class="btn-icon">{{ active ? '◼' : '▶' }}</span>
            {{ active ? 'STOP' : 'MORPH' }}
          </button>
        </div>
      </template>

      <span v-else class="rec-hint">CAPTURE ≥2 SNAPSHOTS TO MORPH</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface SnapState {
  darkness: number
  motion:   number
  density:  number
  grain:    number
  rust:     number
  hum:      number
  fracture: number
  space:    number
}

const props = defineProps<{
  snapshots:    (SnapState | null)[]
  active:       boolean
  duration:     number
  progress:     number
  morphFromIdx: number
  morphToIdx:   number
}>()

defineEmits<{
  capture:          [index: number]
  load:             [index: number]
  delete:           [index: number]
  toggle:           []
  'update:duration': [value: number]
}>()

const filledCount = computed(() =>
  props.snapshots.filter(s => s !== null).length
)
</script>
