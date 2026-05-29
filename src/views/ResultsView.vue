<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useBookmarksStore } from '../stores/bookmarks'
import PaperList from '../components/PaperList.vue'

const store = useAppStore()
const bookmarks = useBookmarksStore()
const route = useRoute()
const router = useRouter()

const universityId = computed(() => route.params.id as string)
const university = computed(() => store.getUniversity(universityId.value))

onMounted(async () => {
  if (!store.universities.length) {
    await store.loadMeta()
  }
  if (!university.value) {
    router.replace('/schools')
    return
  }
  if (store.filters.universityId !== universityId.value) {
    store.enterUniversity(universityId.value)
  }
  bookmarks.load()
})

async function bookmarkOne(paperId: string) {
  const paper = store.papers.find((p) => p.id === paperId)
  if (paper) await bookmarks.add(paper)
}

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
  <div v-if="university" class="results">
    <RouterLink :to="{ name: 'university', params: { id: universityId } }" class="back">
      ← 返回 {{ university.name }}
    </RouterLink>

    <header class="page-head page-head--compact">
      <h1>{{ university.name }} · 搜索结果</h1>
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

    <div v-if="store.error" class="error card">{{ store.error }}</div>

    <div v-if="store.discovered.names.length" class="discovered card">
      <h3>自动发现</h3>
      <div class="discovered-row">
        <span class="label">人名:</span>
        <span v-for="n in store.discovered.names.slice(0, 15)" :key="n" class="chip">{{ n }}</span>
      </div>
      <div v-if="store.discovered.fields.length" class="discovered-row">
        <span class="label">领域:</span>
        <span v-for="f in store.discovered.fields" :key="f" class="chip">{{ f }}</span>
      </div>
    </div>

    <PaperList
      :papers="store.papers"
      :selected-ids="store.selectedPaperIds"
      :loading="store.loading"
      @toggle="store.togglePaper"
      @analyze="analyzeOne"
      @bookmark="bookmarkOne"
    />
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
.page-head--compact {
  padding-bottom: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
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
.discovered {
  margin-bottom: 16px;
}
.discovered h3 {
  font-size: 14px;
  margin-bottom: 10px;
}
.discovered-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
}
.chip {
  padding: 3px 10px;
  border-radius: 12px;
  background: var(--bg-hover);
  font-size: 12px;
}
</style>
