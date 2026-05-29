import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  tauriInvestigatePerson,
  tauriCancelInvestigate,
  type PersonInvestigationPartialPayload,
  type PersonInvestigationReportPayload,
} from '../api/tauri-backend'

export interface InvestigateStepView {
  stepId: string
  label: string
  status: string
  detail?: string
}

/** 与 investigate-person 步骤 id 对齐，用于一开始就展示完整进度条 */
export const INVESTIGATE_PIPELINE: { stepId: string; label: string }[] = [
  { stepId: 'boot', label: '连接调查引擎' },
  { stepId: 'names', label: '扩展姓名变体（中英文）' },
  { stepId: 'experts', label: '检索本地专家库' },
  { stepId: 'authors', label: '检索 OpenAlex 作者' },
  { stepId: 'papers', label: '检索相关论文' },
  { stepId: 'web', label: '联网搜索背景与争议信息' },
  { stepId: 'analyze', label: '深度分析论文（造假维度）' },
  { stepId: 'refs', label: '核查参考文献是否存在' },
  { stepId: 'oss', label: '核查开源声称' },
  { stepId: 'report', label: '生成综合调查报告' },
]

const STEP_STATUS_ZH: Record<string, string> = {
  pending: '等待',
  running: '进行中',
  done: '完成',
  error: '失败',
}

export const useInvestigateStore = defineStore('investigate', () => {
  const name = ref('')
  const university = ref('')
  const loading = ref(false)
  const error = ref('')
  const steps = ref<InvestigateStepView[]>([])
  const report = ref<PersonInvestigationReportPayload | null>(null)
  const partial = ref<PersonInvestigationPartialPayload | null>(null)
  let cancelled = false

  const progressPercent = computed(() => {
    const trackable = steps.value.filter((s) => s.stepId !== 'boot')
    if (!trackable.length) return 0
    const done = trackable.filter((s) => s.status === 'done').length
    const running = trackable.some((s) => s.status === 'running') ? 0.5 : 0
    return Math.min(100, Math.round(((done + running) / trackable.length) * 100))
  })

  const currentStep = computed(() => {
    const running = [...steps.value].reverse().find((s) => s.status === 'running')
    if (running) return running
    if (loading.value) {
      return steps.value.find((s) => s.status === 'pending') ?? null
    }
    return null
  })

  const displayReport = computed(() => report.value ?? partial.value)

  function stepStatusLabel(status: string) {
    return STEP_STATUS_ZH[status] ?? status
  }

  function initPipeline() {
    steps.value = INVESTIGATE_PIPELINE.map((s) => ({
      stepId: s.stepId,
      label: s.label,
      status: s.stepId === 'boot' ? 'running' : 'pending',
      detail: s.stepId === 'boot' ? '正在启动 Node Agent…' : undefined,
    }))
  }

  function upsertStep(step: InvestigateStepView) {
    if (step.stepId !== 'boot') {
      const bootIdx = steps.value.findIndex((s) => s.stepId === 'boot')
      if (bootIdx >= 0 && steps.value[bootIdx]?.status === 'running') {
        const next = [...steps.value]
        next[bootIdx] = { ...next[bootIdx], status: 'done', detail: '已连接' }
        steps.value = next
      }
    }
    const idx = steps.value.findIndex((s) => s.stepId === step.stepId)
    const next = [...steps.value]
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...step }
    } else {
      next.push(step)
    }
    steps.value = next
  }

  function mergePartial(patch: PersonInvestigationPartialPayload) {
    partial.value = {
      ...partial.value,
      ...patch,
      subject: patch.subject
        ? { ...partial.value?.subject, ...patch.subject }
        : partial.value?.subject,
    }
  }

  function markRunningStepsCancelled() {
    steps.value = steps.value.map((s) =>
      s.status === 'running' ? { ...s, status: 'error', detail: '已取消' } : s,
    )
  }

  async function cancel() {
    if (!loading.value || cancelled) return
    cancelled = true
    markRunningStepsCancelled()
    error.value = '调查已取消'
    try {
      await tauriCancelInvestigate()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function run(input?: { name?: string; university?: string; maxPapers?: number }) {
    const subjectName = (input?.name ?? name.value).trim()
    const school = (input?.university ?? university.value).trim()
    if (!subjectName) {
      error.value = '请输入学者姓名'
      return
    }

    loading.value = true
    cancelled = false
    error.value = ''
    report.value = null
    partial.value = {
      subject: { name: subjectName, university: school || undefined, nameVariants: [] },
      papers: [],
      webFindings: [],
      paperAnalyses: [],
      referenceChecks: [],
      opensourceChecks: [],
      experts: [],
      authors: [],
    }
    initPipeline()
    name.value = subjectName
    university.value = school

    try {
      report.value = await tauriInvestigatePerson({
        name: subjectName,
        university: school || undefined,
        maxPapers: input?.maxPapers ?? 12,
        onStep: (s) => upsertStep(s),
        onPartial: (p) => mergePartial(p),
      })
      partial.value = null
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!cancelled) {
        error.value = msg
        markRunningStepsCancelled()
        const bootIdx = steps.value.findIndex((s) => s.stepId === 'boot')
        if (bootIdx >= 0 && steps.value[bootIdx]?.status === 'running') {
          const next = [...steps.value]
          next[bootIdx] = { ...next[bootIdx], status: 'error', detail: msg }
          steps.value = next
        }
      }
    } finally {
      loading.value = false
    }
  }

  function reset() {
    steps.value = []
    report.value = null
    partial.value = null
    error.value = ''
    cancelled = false
  }

  return {
    name,
    university,
    loading,
    error,
    steps,
    report,
    partial,
    displayReport,
    progressPercent,
    currentStep,
    stepStatusLabel,
    run,
    cancel,
    reset,
  }
})
