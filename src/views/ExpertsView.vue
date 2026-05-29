<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import ExpertOrgGrid from '../components/ExpertOrgGrid.vue'

const router = useRouter()
const store = useAppStore()
const query = ref('')
const orgQuery = ref('')
const honorFilter = ref('')
const loading = ref(true)

const honorOptions = ['中科院院士', '工程院院士', '杰青', '优青']

onMounted(async () => {
  if (!store.experts.length) {
    await store.loadMeta()
  }
  loading.value = false
})

const filteredGroups = computed(() => {
  const q = orgQuery.value.trim()
  const honor = honorFilter.value

  return store.expertOrgGroups
    .map((group) => {
      let experts = group.experts
      if (honor) experts = experts.filter((e) => e.honor === honor || e.tags.includes(honor))
      if (q) {
        const matchOrg = group.name.includes(q)
        experts = experts.filter(
          (e) => matchOrg || e.name.includes(q) || e.field.includes(q) || e.title.includes(q)
        )
        if (!matchOrg && !experts.length) return null
      }
      if (!experts.length) return null
      return { ...group, experts, count: experts.length }
    })
    .filter(Boolean) as typeof store.expertOrgGroups
})

const totalFiltered = computed(() =>
  filteredGroups.value.reduce((sum, g) => sum + g.count, 0)
)

async function searchByAuthor(author: string) {
  if (!store.universities.length) await store.loadMeta()
  store.filters.author = author
  store.filters.universityId = ''
  store.filters.query = ''
  await store.search()
  router.push({ name: 'expert-results', query: { author } })
}

function deepInvestigate(author: string) {
  router.push({ name: 'investigate', query: { name: author, auto: '1' } })
}

function handleSearch() {
  if (query.value.trim()) {
    searchByAuthor(query.value.trim())
  }
}

function enterOrg(id: string) {
  router.push({ name: 'org-experts', params: { id } })
}
</script>

<template>
  <div class="experts-page">
    <div class="experts-top">
      <div class="search-bar card">
        <input
          v-model="query"
          placeholder="输入学者姓名，如：张三、Li Wei..."
          @keyup.enter="handleSearch"
        />
        <button class="btn btn-primary" @click="handleSearch">搜索论文</button>
        <button
          v-if="query.trim()"
          type="button"
          class="btn btn-secondary"
          @click="deepInvestigate(query.trim())"
        >
          深度调查
        </button>
      </div>
    </div>

    <div class="experts-body">
    <section>
      <div class="section-head">
        <h2>全部单位</h2>
        <span v-if="!loading" class="count">
          {{ filteredGroups.length }} 个 · {{ totalFiltered }} 人
        </span>
      </div>

      <div v-if="loading" class="loading">加载人物数据...</div>
      <template v-else>
        <div class="toolbar card">
          <input
            v-model="orgQuery"
            class="org-search"
            placeholder="筛选单位或姓名..."
          />
          <select v-model="honorFilter" class="honor-select">
            <option value="">全部荣誉</option>
            <option v-for="h in honorOptions" :key="h" :value="h">{{ h }}</option>
          </select>
        </div>

        <ExpertOrgGrid
          :groups="filteredGroups"
          :universities="store.universities"
          @select="enterOrg"
        />

        <p v-if="!filteredGroups.length" class="empty">没有匹配的单位或人物</p>
      </template>
    </section>
    </div>
  </div>
</template>

<style scoped>
.experts-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.experts-top {
  flex-shrink: 0;
  z-index: 2;
  padding-top: 20px;
  padding-bottom: 4px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}
.experts-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 0 48px;
}
.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.search-bar input {
  flex: 1;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
}
.search-bar input:focus {
  outline: none;
  border-color: var(--border-light);
}
.count {
  font-size: 13px;
  color: var(--text-muted);
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}
.loading,
.empty {
  text-align: center;
  padding: 48px;
  color: var(--text-muted);
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 14px;
}
.org-search {
  flex: 1;
  min-width: 180px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
}
.honor-select {
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
}
</style>
