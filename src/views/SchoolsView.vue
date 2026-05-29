<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import UniversityGrid from '../components/UniversityGrid.vue'

const store = useAppStore()
const router = useRouter()
const metaLoaded = ref(false)

onMounted(async () => {
  await store.loadMeta()
  metaLoaded.value = true
})

const filter985 = ref(false)
const filter211 = ref(false)

const filteredUniversities = computed(() => {
  let list = store.universities
  if (filter985.value) list = list.filter((u) => u.is985)
  if (filter211.value) list = list.filter((u) => u.is211)
  return list
})

function enterUniversity(id: string) {
  router.push({ name: 'university', params: { id } })
}
</script>

<template>
  <div class="schools">
    <header class="page-head">
      <h1>学校</h1>
      <p>浏览 Top 100 高校，按 985 / 211 筛选</p>
    </header>

    <section>
      <div class="section-head">
        <h2>全部院校</h2>
        <div class="filters">
          <label class="filter-check"><input v-model="filter985" type="checkbox" /> 985</label>
          <label class="filter-check"><input v-model="filter211" type="checkbox" /> 211</label>
        </div>
      </div>
      <UniversityGrid
        v-if="metaLoaded"
        :universities="filteredUniversities"
        @select="enterUniversity"
      />
    </section>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 12px;
}
.filter-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}
</style>
