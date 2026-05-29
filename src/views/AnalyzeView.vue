<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { api, type AnalysisResult } from '../api/client'
import { tauriPickFile } from '../api/tauri-backend'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const results = ref<AnalysisResult[]>([])
const loading = ref(false)
const activeIndex = ref(0)
const importMode = ref<'link' | 'pdf'>('link')
const linkInput = ref('')
const importError = ref('')
const importStatus = ref('')

const active = computed(() => results.value[activeIndex.value])
const hasQueryIds = computed(() => Boolean((route.query.ids as string)?.trim()))

async function loadFromQuery() {
  const ids = (route.query.ids as string)?.split(',').filter(Boolean) ?? []
  if (!ids.length) return

  loading.value = true
  importError.value = ''
  try {
    if (store.analyses.length && ids.every((id) => store.analyses.some((a) => a.paperId === id))) {
      results.value = store.analyses.filter((a) => ids.includes(a.paperId))
    } else {
      const papers = ids
        .map((id) => store.papers.find((p) => p.id === id))
        .filter(Boolean) as typeof store.papers

      if (papers.length) {
        const res = await api.analyzeBatch(papers)
        results.value = res.results
        store.analyses = res.results
      } else {
        const cached = await api.getCachedAnalyses()
        results.value = cached.results.filter((a) => ids.includes(a.paperId))
      }
    }
    activeIndex.value = 0
  } finally {
    loading.value = false
  }
}

async function analyzeFromLink() {
  const input = linkInput.value.trim()
  if (!input) {
    importError.value = '请输入论文链接或 DOI'
    return
  }

  loading.value = true
  importError.value = ''
  importStatus.value = '正在解析论文信息…'
  try {
    const result = await api.analyzeFromLink(input)
    results.value = [result]
    store.analyses = [result]
    activeIndex.value = 0
    linkInput.value = ''
    router.replace({ name: 'analyze', query: { ids: result.paperId } })
  } catch (err) {
    importError.value = err instanceof Error ? err.message : '解析或分析失败'
  } finally {
    loading.value = false
    importStatus.value = ''
  }
}

async function pickAndAnalyzePdf() {
  importError.value = ''
  const path = await tauriPickFile(['pdf'])
  if (!path) return

  loading.value = true
  importStatus.value = '正在提取 PDF 文本并分析…'
  try {
    const result = await api.analyzeFromPdf(path)
    results.value = [result]
    store.analyses = [result]
    activeIndex.value = 0
    router.replace({ name: 'analyze', query: { ids: result.paperId } })
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'PDF 分析失败'
  } finally {
    loading.value = false
    importStatus.value = ''
  }
}

onMounted(async () => {
  if (hasQueryIds.value) {
    await loadFromQuery()
  }
})

watch(
  () => route.query.ids,
  () => {
    if (hasQueryIds.value) loadFromQuery()
  },
)

function severityLabel(s: string) {
  return s === 'high' ? '高风险' : s === 'medium' ? '中风险' : '低风险'
}

function scoreColor(score: number) {
  if (score >= 60) return 'var(--danger)'
  if (score >= 30) return 'var(--warning)'
  return 'var(--success)'
}
</script>

<template>
  <div class="analyze">
    <header class="page-head">
      <h1>论文分析</h1>
      <p class="subtitle">导入论文链接或本地 PDF，进行单独的学术诚信分析</p>
    </header>

    <section class="import-panel card">
      <div class="import-tabs">
        <button
          type="button"
          class="import-tab"
          :class="{ active: importMode === 'link' }"
          @click="importMode = 'link'"
        >
          论文链接
        </button>
        <button
          type="button"
          class="import-tab"
          :class="{ active: importMode === 'pdf' }"
          @click="importMode = 'pdf'"
        >
          本地 PDF
        </button>
      </div>

      <div v-if="importMode === 'link'" class="import-body">
        <label class="import-label">
          <span>链接或 DOI</span>
          <input
            v-model="linkInput"
            placeholder="DOI、OpenAlex、arXiv、Semantic Scholar 或 PDF 链接"
            :disabled="loading"
            @keydown.enter.prevent="analyzeFromLink"
          />
        </label>
        <p class="import-hint">
          支持 doi.org、openalex.org、arxiv.org、semanticscholar.org 等常见格式
        </p>
        <button type="button" class="btn btn-primary" :disabled="loading || !linkInput.trim()" @click="analyzeFromLink">
          {{ loading ? '分析中…' : '开始分析' }}
        </button>
      </div>

      <div v-else class="import-body">
        <p class="import-hint">选择本地 PDF 文件，自动提取正文并进行 AI 分析</p>
        <button type="button" class="btn btn-primary" :disabled="loading" @click="pickAndAnalyzePdf">
          {{ loading ? '分析中…' : '选择 PDF 并分析' }}
        </button>
      </div>

      <p v-if="importStatus" class="import-status">{{ importStatus }}</p>
      <p v-if="importError" class="import-error">{{ importError }}</p>
    </section>

    <div v-if="results.length > 1" class="tabs">
      <button
        v-for="(r, i) in results"
        :key="r.paperId"
        class="tab"
        :class="{ active: activeIndex === i }"
        @click="activeIndex = i"
      >
        {{ r.paper.title.slice(0, 40) }}{{ r.paper.title.length > 40 ? '…' : '' }}
      </button>
    </div>

    <div v-if="loading && !importStatus" class="loading card">正在下载并分析论文...</div>

    <div v-else-if="!active" class="empty card">
      在上方输入论文链接或导入 PDF 开始分析，或从搜索结果页选择论文
    </div>

    <div v-else class="split">
      <div class="panel left card">
        <div class="panel-header">
          <h2>原始论文</h2>
          <div class="score" :style="{ color: scoreColor(active.score) }">
            可疑度 {{ active.score }}/100
          </div>
        </div>
        <h3 class="paper-title">{{ active.paper.title }}</h3>
        <div class="paper-meta">
          <span>{{ active.paper.authors.join(', ') }}</span>
          <span>· {{ active.paper.year }}</span>
          <span v-if="active.paper.journal">· {{ active.paper.journal }}</span>
          <span v-if="active.paper.doi">· DOI {{ active.paper.doi }}</span>
        </div>
        <div class="section-block">
          <h4>摘要</h4>
          <p>{{ active.paper.abstract }}</p>
        </div>
        <div v-if="active.fullText" class="section-block">
          <h4>正文片段</h4>
          <pre class="fulltext">{{ active.fullText }}</pre>
        </div>
        <div class="links">
          <a v-if="active.paper.url" :href="active.paper.url" target="_blank">查看原文</a>
          <a v-if="active.paper.pdfUrl" :href="active.paper.pdfUrl" target="_blank">下载 PDF</a>
        </div>
      </div>

      <div class="panel right card">
        <div class="panel-header">
          <h2>异常标记</h2>
          <span class="flag-count">{{ active.flags.length }} 项</span>
        </div>
        <p class="summary">{{ active.summary }}</p>
        <div v-if="!active.flags.length" class="no-flags">
          未发现明显异常
        </div>
        <div v-else class="flags">
          <div v-for="(flag, i) in active.flags" :key="i" class="flag-item">
            <div class="flag-header">
              <span class="flag-type">{{ flag.type }}</span>
              <span :class="'severity-' + flag.severity">{{ severityLabel(flag.severity) }}</span>
            </div>
            <p class="flag-desc">{{ flag.description }}</p>
            <blockquote v-if="flag.evidence" class="evidence">{{ flag.evidence }}</blockquote>
          </div>
        </div>
        <p class="analyzed-at">分析时间: {{ new Date(active.analyzedAt).toLocaleString('zh-CN') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.subtitle {
  color: var(--text-muted);
  font-size: 15px;
}
.import-panel {
  margin-bottom: 20px;
}
.import-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.import-tab {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  font-size: 13px;
}
.import-tab.active {
  border-color: var(--text-muted);
  color: var(--text);
  background: var(--bg-hover);
}
.import-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
.import-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.import-label span {
  font-size: 13px;
  color: var(--text-muted);
}
.import-label input {
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
}
.import-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}
.import-status {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-muted);
}
.import-error {
  margin-top: 12px;
  font-size: 13px;
  color: var(--danger);
}
.tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.tab {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 12px;
}
.tab.active {
  border-color: var(--text-muted);
  color: var(--text);
}
.loading, .empty {
  text-align: center;
  padding: 48px;
  color: var(--text-muted);
}
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  min-height: 600px;
}
@media (max-width: 900px) {
  .split { grid-template-columns: 1fr; }
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.panel-header h2 {
  font-size: 16px;
}
.score {
  font-weight: 700;
  font-size: 15px;
}
.paper-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  line-height: 1.4;
}
.paper-meta {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 16px;
}
.section-block {
  margin-bottom: 16px;
}
.section-block h4 {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.section-block p {
  font-size: 14px;
  line-height: 1.6;
}
.fulltext {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  background: var(--bg);
  padding: 12px;
  border-radius: 8px;
}
.links {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  font-size: 13px;
}
.summary {
  font-size: 14px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--bg);
  border-radius: 8px;
}
.flag-count {
  font-size: 13px;
  color: var(--text-muted);
}
.no-flags {
  text-align: center;
  padding: 32px;
  color: var(--success);
}
.flags {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.flag-item {
  padding: 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
}
.flag-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}
.flag-type {
  font-weight: 600;
  font-size: 14px;
}
.flag-desc {
  font-size: 13px;
  color: var(--text-muted);
}
.evidence {
  margin-top: 8px;
  padding: 8px 12px;
  border-left: 3px solid var(--border-light);
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-hover);
  border-radius: 0 6px 6px 0;
}
.analyzed-at {
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
