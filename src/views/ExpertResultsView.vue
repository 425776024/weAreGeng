<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import PaperList from '../components/PaperList.vue'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const author = computed(() => (route.query.author as string) || store.filters.author)

onMounted(async () => {
  if (!store.papers.length && author.value && !store.loading) {
    if (!store.universities.length) await store.loadMeta()
    store.filters.author = author.value
    store.filters.universityId = ''
    await store.search()
  }
})

function analyzeOne(paperId: string) {
  const paper = store.papers.find((p) => p.id === paperId)
  if (paper) {
    store.analyses = []
    router.push({ name: 'analyze', query: { ids: paper.id } })
  }
}

async function analyzeSelected() {
  const selected = store.getSelectedPapers()
  if (!selected.length) return
  await store.analyzePapers(selected)
  router.push({ name: 'analyze', query: { ids: selected.map((p) => p.id).join(',') } })
}
</script>

<template>
  <div class="results-page">
    <div class="results-top">
      <RouterLink to="/experts" class="back">← 返回人物</RouterLink>

      <header class="page-head page-head--compact">
        <h1>{{ author || '学者' }} · 论文搜索结果</h1>
        <p>共 {{ store.papers.length }} 篇（人名去重后）</p>
      </header>

      <div class="toolbar">
        <div class="toolbar-actions">
          <button class="btn btn-secondary" @click="store.selectAll">全选</button>
          <button class="btn btn-secondary" @click="store.clearSelection">取消</button>
          <button
            class="btn btn-primary"
            :disabled="!store.selectedPaperIds.size || store.loading"
            @click="analyzeSelected"
          >
            分析选中 ({{ store.selectedPaperIds.size }})
          </button>
        </div>
      </div>
    </div>

    <div class="results-body">
      <div v-if="store.error" class="error card">{{ store.error }}</div>

      <PaperList
        :papers="store.papers"
        :selected-ids="store.selectedPaperIds"
        :loading="store.loading"
        @toggle="store.togglePaper"
        @analyze="analyzeOne"
      />
    </div>
  </div>
</template>

<style scoped>
.results-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.results-top {
  flex-shrink: 0;
  z-index: 2;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}
.results-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 0 48px;
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
.page-head--compact {
  padding-bottom: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 16px;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.error {
  color: var(--danger);
  margin-bottom: 16px;
}
</style>
