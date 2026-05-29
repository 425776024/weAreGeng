<script setup lang="ts">
defineProps<{
  universities: Array<{
    id: string
    name: string
    shortName: string
    is985: boolean
    is211: boolean
    rank: number
    province: string
  }>
}>()

const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <div class="grid">
    <button
      v-for="u in universities"
      :key="u.id"
      class="uni-card"
      @click="emit('select', u.id)"
    >
      <span class="rank">#{{ u.rank }}</span>
      <div class="card-body">
        <span class="name">{{ u.name }}</span>
        <div class="meta">
          <span class="province">{{ u.province }}</span>
          <div v-if="u.is985 || u.is211" class="badges">
            <span v-if="u.is985" class="badge badge-985">985</span>
            <span v-if="u.is211" class="badge badge-211">211</span>
          </div>
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
.uni-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-card);
  text-align: left;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}
.uni-card:hover {
  border-color: var(--border-light);
  background: var(--bg-hover);
  transform: translateY(-1px);
  cursor: pointer;
}
.rank {
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
.province {
  font-size: 12px;
  color: var(--text-muted);
}
.badges {
  display: flex;
  gap: 4px;
}
</style>
