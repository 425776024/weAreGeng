<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import FilterPanel from '../components/FilterPanel.vue'
import ExpertGrid from '../components/ExpertGrid.vue'
import type { Expert } from '../api/client'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const universityExperts = ref<Expert[]>([])

const universityId = computed(() => route.params.id as string)

const university = computed(() =>
  store.universities.find((u) => u.id === universityId.value)
)

onMounted(async () => {
  if (!store.universities.length) {
    await store.loadMeta()
  }
  if (!university.value) {
    router.replace('/schools')
    return
  }
  store.enterUniversity(universityId.value)
  universityExperts.value = await store.loadExpertsForUniversity(universityId.value)
})

async function handleSearch() {
  await store.search()
  router.push({ name: 'results', params: { id: universityId.value } })
}

async function onSelectExpert(expert: Expert) {
  store.filters.author = expert.name
  store.filters.query = ''
  await store.search()
  router.push({ name: 'expert-results', query: { author: expert.name } })
}
</script>

<template>
  <div v-if="university" class="university">
    <RouterLink :to="{ name: 'schools' }" class="back">← 全部学校</RouterLink>

    <header class="page-head">
      <div class="hero-badges">
        <span v-if="university.is985" class="badge badge-985">985</span>
        <span v-if="university.is211" class="badge badge-211">211</span>
        <span class="rank">#{{ university.rank }}</span>
      </div>
      <h1>{{ university.name }}</h1>
      <p>{{ university.province }} · 论文检索与学术打假分析</p>
    </header>

    <FilterPanel @search="handleSearch" />

    <section v-if="universityExperts.length" class="section">
      <div class="section-head">
        <h2>公开人才名录</h2>
        <span class="count">{{ universityExperts.length }} 人</span>
      </div>
      <ExpertGrid :experts="universityExperts" @select="onSelectExpert" />
    </section>

    <section class="section grid-2">
      <div class="card">
        <h3>理工科研究领域</h3>
        <div class="tag-list">
          <button
            v-for="f in store.fields"
            :key="f.id"
            class="chip"
            :class="{ active: store.filters.fieldId === f.id }"
            @click="store.filters.fieldId = store.filters.fieldId === f.id ? '' : f.id"
          >
            {{ f.name }}
          </button>
        </div>
      </div>
      <div class="card">
        <h3>主要期刊</h3>
        <div class="tag-list">
          <button
            v-for="j in store.journals.slice(0, 12)"
            :key="j.id"
            class="chip"
            :class="{ active: store.filters.journalId === j.id }"
            @click="store.filters.journalId = store.filters.journalId === j.id ? '' : j.id"
          >
            {{ j.name }}
            <span v-if="j.tier === 'top'" class="badge badge-top">顶刊</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.back {
  display: inline-block;
  margin-top: 24px;
  font-size: 13px;
  color: var(--text-muted);
  text-decoration: none;
}
.back:hover {
  color: var(--text);
}
.page-head {
  padding-top: 20px;
}
.hero-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.rank {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
}
.section {
  margin-top: 24px;
}
.count {
  font-size: 13px;
  color: var(--text-muted);
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}
h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 14px;
  color: var(--text-secondary);
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.badge-top {
  margin-left: 4px;
}
</style>
