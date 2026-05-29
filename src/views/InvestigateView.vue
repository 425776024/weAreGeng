<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useInvestigateStore } from '../stores/investigate'
import { useAppStore } from '../stores/app'
import type { PersonInvestigationReportPayload } from '../api/tauri-backend'

const route = useRoute()
const investigate = useInvestigateStore()
const app = useAppStore()

type PaperRow = { id: string; title: string; year?: number; primaryAuthor?: string }
type AnalysisRow = { paperId: string; score?: number; summary?: string; paper?: { title?: string } }
type CheckRow = { paperId?: string; paperTitle?: string; summary?: string }
type WebRow = { title: string; url: string; snippet: string }
type FlagRow = { type: string; severity: string; description: string; evidence: string }

const report = computed(
  () => investigate.displayReport as PersonInvestigationReportPayload | null | undefined,
)
const isStreaming = computed(() => investigate.loading && !investigate.report)
const paperAnalyses = computed(() => (report.value?.paperAnalyses ?? []) as AnalysisRow[])
const referenceChecks = computed(() => (report.value?.referenceChecks ?? []) as CheckRow[])
const opensourceChecks = computed(() => (report.value?.opensourceChecks ?? []) as CheckRow[])
const papers = computed(() => (report.value?.papers ?? []) as PaperRow[])
const webFindings = computed(() => (report.value?.webFindings ?? []) as WebRow[])
const flags = computed(() => (report.value?.flags ?? []) as FlagRow[])
const nameVariants = computed(() => report.value?.subject?.nameVariants ?? [])

const scoreClass = computed(() => {
  const s = report.value?.overallScore ?? 0
  if (s >= 70) return 'high'
  if (s >= 40) return 'medium'
  return 'low'
})

const showProgress = computed(() => investigate.loading || investigate.steps.length > 0)

onMounted(async () => {
  if (!app.universities.length) await app.loadMeta()
  const qName = route.query.name as string | undefined
  const qUni = route.query.university as string | undefined
  if (qName) {
    investigate.name = qName
    if (qUni) investigate.university = qUni
    if (route.query.auto === '1') {
      investigate.run({ name: qName, university: qUni })
    }
  }
})

async function submit() {
  await investigate.run()
}
</script>

<template>
  <div class="investigate-page">
    <div class="investigate-top">
      <header class="page-head">
        <h1>学者深度调查</h1>
        <p class="subtitle">
          根据姓名与学校自动检索论文、联网背景，多步骤分析引用异常、开源声称、数据表格等问题
        </p>
      </header>

      <form class="search-form card" @submit.prevent="submit">
        <div class="fields">
          <label>
            <span>学者姓名</span>
            <input v-model="investigate.name" placeholder="中文或英文，如：张三、Li Wei" :disabled="investigate.loading" />
          </label>
          <label>
            <span>学校 / 单位</span>
            <input v-model="investigate.university" placeholder="如：清华大学" :disabled="investigate.loading" />
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="investigate.loading || !investigate.name.trim()">
            {{ investigate.loading ? '调查中…' : '开始深度调查' }}
          </button>
          <button
            v-if="investigate.loading"
            type="button"
            class="btn btn-secondary"
            @click="investigate.cancel()"
          >
            停止调查
          </button>
        </div>
      </form>
    </div>

    <div class="investigate-body">
    <div v-if="showProgress" class="steps card">
      <div class="progress-head">
        <h2>调查进度</h2>
        <div class="progress-head-actions">
          <span v-if="investigate.loading" class="progress-pct">{{ investigate.progressPercent }}%</span>
          <button
            v-if="investigate.loading"
            type="button"
            class="btn btn-secondary btn-stop"
            @click="investigate.cancel()"
          >
            停止
          </button>
        </div>
      </div>
      <div v-if="investigate.loading" class="progress-bar" role="progressbar" :aria-valuenow="investigate.progressPercent">
        <div class="progress-fill" :style="{ width: `${investigate.progressPercent}%` }" />
      </div>
      <p v-if="investigate.currentStep && investigate.loading" class="current-step">
        当前：{{ investigate.currentStep.label }}
        <span v-if="investigate.currentStep.detail" class="current-detail"> — {{ investigate.currentStep.detail }}</span>
      </p>
      <ul class="step-list">
        <li
          v-for="s in investigate.steps"
          :key="s.stepId"
          :class="[s.status, { active: s.status === 'running' }]"
        >
          <span class="step-icon" aria-hidden="true">
            <span v-if="s.status === 'running'" class="spinner" />
            <span v-else-if="s.status === 'done'">✓</span>
            <span v-else-if="s.status === 'error'">!</span>
            <span v-else>○</span>
          </span>
          <div class="step-body">
            <div class="step-row">
              <span class="step-label">{{ s.label }}</span>
              <span class="step-status" :class="s.status">{{ investigate.stepStatusLabel(s.status) }}</span>
            </div>
            <p v-if="s.detail" class="step-detail">{{ s.detail }}</p>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="investigate.error" class="banner error">{{ investigate.error }}</div>

    <p v-if="isStreaming" class="streaming-hint">结果将随调查推进逐步显示，无需等待全部完成。</p>

    <div v-if="report" class="report" :class="{ streaming: isStreaming }">
      <section v-if="nameVariants.length" class="card live-card">
        <h2>姓名变体</h2>
        <p class="name-variants">{{ nameVariants.join(' · ') }}</p>
      </section>

      <section v-if="papers.length" class="card live-card">
        <h2>相关论文 <span class="live-badge">实时</span> ({{ papers.length }})</h2>
        <ul class="paper-list">
          <li v-for="p in papers" :key="p.id">
            <strong>{{ p.title }}</strong>
            <span class="meta">{{ p.year }} · {{ p.primaryAuthor }}</span>
          </li>
        </ul>
      </section>

      <section v-if="webFindings.length" class="card live-card">
        <h2>联网检索 <span class="live-badge">实时</span> ({{ webFindings.length }})</h2>
        <ul class="web-list">
          <li v-for="(w, i) in webFindings.slice(0, 8)" :key="i">
            <a :href="w.url" target="_blank" rel="noopener">{{ w.title }}</a>
            <p>{{ w.snippet }}</p>
          </li>
        </ul>
      </section>

      <section v-if="paperAnalyses.length" class="card live-card">
        <h2>论文分析 <span class="live-badge">实时</span> ({{ paperAnalyses.length }})</h2>
        <article v-for="a in paperAnalyses" :key="a.paperId" class="paper-analysis">
          <h3>{{ a.paper?.title ?? a.paperId }}</h3>
          <p class="meta">可疑分 {{ a.score }} — {{ a.summary }}</p>
        </article>
      </section>

      <section v-if="referenceChecks.length" class="card live-card">
        <h2>参考文献核查 ({{ referenceChecks.length }})</h2>
        <div v-for="r in referenceChecks" :key="r.paperId" class="ref-block">
          <h3>{{ r.paperTitle }}</h3>
          <p>{{ r.summary }}</p>
        </div>
      </section>

      <section v-if="opensourceChecks.length" class="card live-card">
        <h2>开源声称核查 ({{ opensourceChecks.length }})</h2>
        <div v-for="o in opensourceChecks" :key="o.paperId" class="ref-block">
          <h3>{{ o.paperTitle }}</h3>
          <p>{{ o.summary }}</p>
        </div>
      </section>

      <section v-if="report.summary && !isStreaming" class="card summary-card">
        <div class="score-row">
          <h2>综合评估</h2>
          <span class="score" :class="scoreClass">{{ report.overallScore }} / 100</span>
        </div>
        <p class="summary-text">{{ report.summary }}</p>
      </section>

      <section v-if="flags.length && !isStreaming" class="card">
        <h2>风险标记 ({{ flags.length }})</h2>
        <ul class="flags">
          <li v-for="(f, i) in flags" :key="i" :class="f.severity">
            <strong>{{ f.type }}</strong>
            <span class="severity-tag">{{ f.severity }}</span>
            <p>{{ f.description }}</p>
            <blockquote v-if="f.evidence">{{ f.evidence }}</blockquote>
          </li>
        </ul>
      </section>

      <section v-if="isStreaming && investigate.steps.some((s) => s.stepId === 'report' && s.status === 'running')" class="card pending-summary">
        <p class="meta">正在生成综合报告与风险标记…</p>
      </section>
    </div>
    </div>
  </div>
</template>

<style scoped>
.investigate-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-width: 920px;
  width: 100%;
  margin: 0 auto;
}
.investigate-top {
  flex-shrink: 0;
  z-index: 2;
  padding-bottom: 4px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}
.investigate-top .page-head {
  padding-top: 20px;
  padding-bottom: 12px;
}
.investigate-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 0 48px;
}
.subtitle {
  color: var(--text-muted);
  font-size: 13px;
  margin-top: 4px;
}
.search-form {
  margin: 0 0 16px;
  padding: 16px;
}
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
label span {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text);
}
.progress-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.progress-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.btn-stop {
  padding: 4px 12px;
  font-size: 12px;
}
.progress-pct {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.progress-bar {
  height: 6px;
  background: var(--bg-hover);
  border-radius: 3px;
  margin: 12px 0 10px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1565c0, #42a5f5);
  border-radius: 3px;
  transition: width 0.35s ease;
}
.current-step {
  font-size: 13px;
  color: var(--text);
  margin: 0 0 12px;
  line-height: 1.5;
}
.current-detail {
  color: var(--text-muted);
  font-size: 12px;
}
.step-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.step-list li {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.step-list li.active {
  background: color-mix(in srgb, #1565c0 6%, transparent);
  margin: 0 -8px;
  padding-left: 8px;
  padding-right: 8px;
  border-radius: var(--radius-sm);
}
.step-list li.done { opacity: 0.85; }
.step-icon {
  flex-shrink: 0;
  width: 20px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  padding-top: 2px;
}
.step-list li.done .step-icon { color: #2e7d32; }
.step-list li.running .step-icon { color: #1565c0; }
.step-list li.error .step-icon { color: var(--danger, #c62828); }
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid color-mix(in srgb, #1565c0 25%, transparent);
  border-top-color: #1565c0;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.step-body { flex: 1; min-width: 0; }
.step-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.step-label { font-weight: 500; font-size: 13px; }
.step-status {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-muted);
}
.step-status.running {
  background: color-mix(in srgb, #1565c0 15%, transparent);
  color: #1565c0;
}
.step-status.done {
  background: color-mix(in srgb, #2e7d32 12%, transparent);
  color: #2e7d32;
}
.step-detail {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-word;
}
.streaming-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0 0 12px;
}
.report.streaming .live-card {
  border-color: color-mix(in srgb, #1565c0 25%, var(--border));
}
.live-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, #1565c0 12%, transparent);
  color: #1565c0;
  vertical-align: middle;
  margin-left: 6px;
}
.pending-summary {
  text-align: center;
  padding: 20px;
}
.banner.error {
  padding: 12px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  margin-bottom: 16px;
}
.report {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.score-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.score {
  font-size: 28px;
  font-weight: 700;
}
.score.high { color: #c62828; }
.score.medium { color: #ef6c00; }
.score.low { color: #2e7d32; }
.name-variants {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}
.summary-text {
  line-height: 1.6;
  font-size: 14px;
}
.flags li {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.severity-tag {
  margin-left: 8px;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-hover);
}
.flags li.high .severity-tag { background: #ffebee; color: #c62828; }
.paper-analysis, .ref-block {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.paper-analysis h3, .ref-block h3 {
  font-size: 14px;
  margin: 0 0 4px;
}
.meta { font-size: 12px; color: var(--text-muted); }
.paper-list, .web-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.paper-list li, .web-list li {
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.web-list a {
  color: var(--text);
  font-weight: 500;
}
blockquote {
  margin: 6px 0 0;
  padding-left: 10px;
  border-left: 3px solid var(--border);
  font-size: 12px;
  color: var(--text-muted);
}
@media (max-width: 640px) {
  .fields { grid-template-columns: 1fr; }
}
</style>
