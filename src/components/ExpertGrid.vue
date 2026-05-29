<script setup lang="ts">
import type { Expert } from '../api/client'

defineProps<{
  experts: Expert[]
}>()

const emit = defineEmits<{ select: [expert: Expert]; investigate: [expert: Expert] }>()
</script>

<template>
  <div class="grid">
    <div
      v-for="e in experts"
      :key="e.id"
      class="expert-card"
      role="button"
      tabindex="0"
      @click="emit('select', e)"
      @keydown.enter.prevent="emit('select', e)"
      @keydown.space.prevent="emit('select', e)"
    >
      <div class="expert-name">{{ e.name }}</div>
      <div class="expert-field">{{ e.field || e.title }}</div>
      <div class="expert-tags">
        <span v-for="t in e.tags" :key="t" class="mini-tag">{{ t }}</span>
      </div>
      <button type="button" class="investigate-link" @click.stop="emit('investigate', e)">深度调查</button>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.expert-card {
  text-align: left;
  padding: 14px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-card);
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
  cursor: pointer;
}
.expert-card:hover {
  border-color: var(--border-light);
  background: var(--bg-hover);
  transform: translateY(-1px);
}
.expert-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.01em;
  line-height: 1.4;
  margin-bottom: 4px;
}
.expert-field {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.expert-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.mini-tag {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.investigate-link {
  margin-top: 10px;
  padding: 0;
  border: none;
  background: none;
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  text-decoration: underline;
}
.investigate-link:hover {
  color: var(--text);
}
</style>
