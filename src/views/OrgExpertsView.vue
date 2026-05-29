<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import ExpertGrid from '../components/ExpertGrid.vue'
import type { Expert } from '../api/client'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const loading = ref(true)

const orgId = computed(() => route.params.id as string)

const group = computed(() =>
  store.expertOrgGroups.find((g) => g.id === orgId.value)
)

const university = computed(() => {
  if (!group.value?.universityId) return undefined
  return store.universities.find((u) => u.id === group.value!.universityId)
})

onMounted(async () => {
  if (!store.expertOrgGroups.length) {
    await store.loadMeta()
  }
  loading.value = false
  if (!group.value) {
    router.replace({ name: 'experts' })
  }
})

async function onSelectExpert(expert: Expert) {
  store.filters.author = expert.name
  store.filters.universityId = ''
  store.filters.query = ''
  await store.search()
  router.push({ name: 'expert-results', query: { author: expert.name } })
}

function investigateExpert(expert: Expert) {
  router.push({
    name: 'investigate',
    query: {
      name: expert.name,
      university: group.value?.name ?? university.value?.name ?? '',
      auto: '1',
    },
  })
}
</script>

<template>
  <div v-if="group" class="org-experts-page">
    <div class="org-experts-top">
      <RouterLink :to="{ name: 'experts' }" class="back">← 全部单位</RouterLink>

      <header class="page-head">
        <div v-if="university" class="hero-badges">
          <span v-if="university.is985" class="badge badge-985">985</span>
          <span v-if="university.is211" class="badge badge-211">211</span>
        </div>
        <h1>{{ group.name }}</h1>
        <p>{{ group.count }} 人 · 点击姓名检索论文</p>
      </header>
    </div>

    <div class="org-experts-body">
      <ExpertGrid :experts="group.experts" @select="onSelectExpert" @investigate="investigateExpert" />
    </div>
  </div>
  <div v-else-if="loading" class="loading">加载中...</div>
</template>

<style scoped>
.org-experts-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.org-experts-top {
  flex-shrink: 0;
  z-index: 2;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}
.org-experts-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 0 48px;
}
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
  padding-bottom: 16px;
  margin-bottom: 0;
}
.hero-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.loading {
  text-align: center;
  padding: 48px;
  color: var(--text-muted);
}
</style>
