<script setup lang="ts">
import { computed } from 'vue'
import type { ExpertOrgGroup, University } from '../api/client'

const props = defineProps<{
  groups: ExpertOrgGroup[]
  universities?: University[]
}>()

const emit = defineEmits<{ select: [id: string] }>()

const uniMap = computed(() => new Map((props.universities ?? []).map((u) => [u.id, u])))

function getUniversity(group: ExpertOrgGroup) {
  if (!group.universityId) return undefined
  return uniMap.value.get(group.universityId)
}

function honorSummary(group: ExpertOrgGroup) {
  const honors = new Set<string>()
  for (const e of group.experts) {
    if (e.honor) honors.add(e.honor)
  }
  return [...honors].slice(0, 3)
}
</script>

<template>
  <div class="grid">
    <button
      v-for="group in groups"
      :key="group.id"
      class="org-card"
      type="button"
      @click="emit('select', group.id)"
    >
      <span class="count">{{ group.count }}</span>
      <div class="card-body">
        <span class="name">{{ group.name }}</span>
        <div class="meta">
          <span v-if="getUniversity(group)" class="province">
            {{ getUniversity(group)!.province }}
          </span>
          <div v-if="getUniversity(group)?.is985 || getUniversity(group)?.is211" class="badges">
            <span v-if="getUniversity(group)!.is985" class="badge badge-985">985</span>
            <span v-if="getUniversity(group)!.is211" class="badge badge-211">211</span>
          </div>
          <span v-else-if="honorSummary(group).length" class="honors">
            {{ honorSummary(group).join(' · ') }}
          </span>
        </div>
      </div>
    </button>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.org-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-card);
  text-align: left;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
  cursor: pointer;
}
.org-card:hover {
  border-color: var(--border-light);
  background: var(--bg-hover);
  transform: translateY(-1px);
}
.count {
  flex-shrink: 0;
  width: 26px;
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
  padding-top: 1px;
}
.card-body {
  flex: 1;
  min-width: 0;
}
.name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.01em;
  line-height: 1.4;
}
.meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.province,
.honors {
  font-size: 12px;
  color: var(--text-muted);
}
.honors {
  line-height: 1.3;
}
.badges {
  display: flex;
  gap: 4px;
}
</style>
