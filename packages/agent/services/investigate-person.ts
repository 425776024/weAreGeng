import { DEFAULT_SOURCES, type AnalysisResult, type Paper, type SourcesConfig } from '../types'
import type { AgentToolDeps } from '../tools/deps'
import { analyzePaperWithLlm } from './analyzer'
import { verifyOpensourceClaims } from './claim-verify'
import {
  INVESTIGATE_LIMITS,
  INVESTIGATE_SOURCES_OPENALEX_ONLY,
  INVESTIGATE_SOURCES_S2_FALLBACK,
} from './investigate-limits'
import { buildWebSearchQueries, expandNameVariants } from './name-variants'
import { synthesizePersonReport, type PersonInvestigationReport } from './person-analyzer'
import { searchAuthors, type AuthorCandidate } from './paper-search/authors'
import { getPaperCitations } from './paper-search/citations'
import { searchPapers } from './paper-search'
import { verifyPaperReferences } from './reference-verify'
import { sleep } from '../utils/retry-fetch'

export type InvestigateStepStatus = 'pending' | 'running' | 'done' | 'error'

export interface InvestigateStep {
  id: string
  label: string
  status: InvestigateStepStatus
  detail?: string
}

/** 调查过程中增量下发的数据片段（用于前端实时展示） */
export interface InvestigatePartialPatch {
  subject?: { name: string; university?: string; nameVariants: string[] }
  experts?: Array<Record<string, unknown>>
  authors?: AuthorCandidate[]
  papers?: Paper[]
  webFindings?: Array<{ title: string; url: string; snippet: string }>
  paperAnalyses?: AnalysisResult[]
  referenceChecks?: Awaited<ReturnType<typeof verifyPaperReferences>>[]
  opensourceChecks?: ReturnType<typeof verifyOpensourceClaims>[]
}

export interface InvestigatePersonOptions {
  name: string
  university?: string
  maxPapers?: number
  deps: AgentToolDeps
  sources?: Partial<SourcesConfig>
  onStep?: (step: InvestigateStep) => void
  onPartial?: (patch: InvestigatePartialPatch) => void
}

function paperMatchesUniversity(paper: Paper, university?: string): boolean {
  if (!university?.trim()) return true
  const q = university.trim().toLowerCase()
  const uni = (paper.university ?? '').toLowerCase()
  if (uni && (uni.includes(q) || q.includes(uni))) return true
  // 短名匹配：清华 → 清华大学
  if (q.length >= 2 && uni.includes(q.slice(0, 2))) return true
  return false
}

function authorInPaper(paper: Paper, nameVariants: string[]): boolean {
  const hay = `${paper.primaryAuthor} ${paper.authors.join(' ')}`.toLowerCase()
  return nameVariants.some((v) => hay.includes(v.toLowerCase()) || v.toLowerCase().includes(hay))
}

function emit(onStep: InvestigatePersonOptions['onStep'], step: InvestigateStep) {
  onStep?.(step)
}

function emitPartial(onPartial: InvestigatePersonOptions['onPartial'], patch: InvestigatePartialPatch) {
  onPartial?.(patch)
}

/**
 * 多步骤人物调查：姓名变体 → 作者/论文检索 → 联网 → 深度分析 → 引用/开源核查 → 综合报告
 */
export async function investigatePerson(
  options: InvestigatePersonOptions,
): Promise<PersonInvestigationReport> {
  const { deps, name, university, onStep, onPartial } = options
  const limits = INVESTIGATE_LIMITS
  const maxPapers = Math.min(
    options.maxPapers ?? limits.maxPapers,
    limits.maxPapersCap,
  )
  const userSources = { ...DEFAULT_SOURCES, ...deps.sources, ...options.sources }
  const allowS2Fallback = userSources.semanticScholar
  const steps: InvestigateStep[] = []

  const step = (id: string, label: string, status: InvestigateStepStatus, detail?: string) => {
    const s: InvestigateStep = { id, label, status, detail }
    steps.push(s)
    emit(onStep, s)
  }

  const subjectBase = { name, university, nameVariants: [] as string[] }

  step('names', '扩展姓名变体（中英文）', 'running')
  const nameVariants = await expandNameVariants(name, university, deps.llmChat, limits.maxNameVariants)
  subjectBase.nameVariants = nameVariants
  emitPartial(onPartial, { subject: { ...subjectBase } })
  step('names', '扩展姓名变体（中英文）', 'done', nameVariants.join(' · '))

  step('experts', '检索本地专家库', 'running')
  const experts = deps.searchExperts ? deps.searchExperts(name) : []
  const filteredExperts = university
    ? experts.filter((e) => {
        const u = String((e as { university?: string }).university ?? '')
        return !u || u.includes(university) || university.includes(u)
      })
    : experts
  emitPartial(onPartial, { experts: filteredExperts })
  step('experts', '检索本地专家库', 'done', `匹配 ${filteredExperts.length} 人`)

  step('authors', '检索 OpenAlex 作者', 'running')
  const authors = await searchAuthors(deps.fetch, {
    name,
    university,
    s2ApiKey: deps.s2ApiKey,
    limit: limits.maxAuthorCandidates,
    useOpenAlex: true,
    useSemanticScholar: false,
  })
  emitPartial(onPartial, { authors })
  step('authors', '检索 OpenAlex 作者', 'done', `候选 ${authors.length} 人`)

  const mergeIntoSeen = (seen: Map<string, Paper>, batch: Paper[]) => {
    for (const p of batch) {
      if (!authorInPaper(p, nameVariants)) continue
      if (university && !paperMatchesUniversity(p, university)) continue
      if (!seen.has(p.id)) seen.set(p.id, p)
    }
  }

  const papersFromQuery = async (query: string, sources: Partial<SourcesConfig>) => {
    const res = await searchPapers({
      fetch: deps.fetch,
      filters: { author: query, query },
      sources,
      s2ApiKey: deps.s2ApiKey,
      limit: limits.paperSearchApiLimit,
    })
    return res.papers
  }

  const paperQueries = [name, ...nameVariants.filter((v) => v !== name)].slice(
    0,
    limits.maxPaperSearchVariants,
  )
  const seen = new Map<string, Paper>()

  for (let i = 0; i < paperQueries.length; i++) {
    const query = paperQueries[i]!
    step(
      'papers',
      '检索相关论文',
      'running',
      `OpenAlex ${i + 1}/${paperQueries.length}：${query}`,
    )
    mergeIntoSeen(seen, await papersFromQuery(query, INVESTIGATE_SOURCES_OPENALEX_ONLY))
    const papersSoFar = [...seen.values()]
      .sort((a, b) => (b.citations ?? 0) - (a.citations ?? 0))
      .slice(0, maxPapers)
    emitPartial(onPartial, { papers: papersSoFar })
    if (i < paperQueries.length - 1) await sleep(limits.variantGapMs)
  }

  if (seen.size === 0 && allowS2Fallback) {
    step('papers', '检索相关论文', 'running', 'OpenAlex 无结果，尝试 Semantic Scholar')
    mergeIntoSeen(seen, await papersFromQuery(name, INVESTIGATE_SOURCES_S2_FALLBACK))
    emitPartial(onPartial, {
      papers: [...seen.values()]
        .sort((a, b) => (b.citations ?? 0) - (a.citations ?? 0))
        .slice(0, maxPapers),
    })
  }

  const papers = [...seen.values()]
    .sort((a, b) => (b.citations ?? 0) - (a.citations ?? 0))
    .slice(0, maxPapers)
  step('papers', '检索相关论文', 'done', `找到 ${papers.length} 篇`)

  step('web', '联网搜索背景与争议信息', 'running')
  const webFindings: Array<{ title: string; url: string; snippet: string }> = []
  if (deps.webSearch) {
    const queries = buildWebSearchQueries(name, university, nameVariants, limits.maxWebQueries)
    for (let i = 0; i < queries.length; i++) {
      const q = queries[i]!
      step('web', '联网搜索背景与争议信息', 'running', `查询 ${i + 1}/${queries.length}：${q}`)
      try {
        const hits = await deps.webSearch(q)
        for (const h of hits) {
          if (!webFindings.some((w) => w.url === h.url)) webFindings.push(h)
        }
        emitPartial(onPartial, { webFindings: [...webFindings] })
      } catch {
        // 单条 query 失败不阻断
      }
    }
  }
  step('web', '联网搜索背景与争议信息', 'done', `${webFindings.length} 条结果`)

  const analyzeTargets = papers.slice(0, limits.maxPapersToAnalyze)
  step('analyze', '深度分析论文（造假维度）', 'running')
  const paperAnalyses: AnalysisResult[] = []
  for (let i = 0; i < analyzeTargets.length; i++) {
    const paper = analyzeTargets[i]!
    step(
      'analyze',
      '深度分析论文（造假维度）',
      'running',
      `分析 ${i + 1}/${analyzeTargets.length}：${paper.title.slice(0, 48)}${paper.title.length > 48 ? '…' : ''}`,
    )
    try {
      paperAnalyses.push(await analyzePaperWithLlm(deps.llmChat, paper))
      emitPartial(onPartial, { paperAnalyses: [...paperAnalyses] })
      if (deps.saveAnalysis) {
        await deps.saveAnalysis({
          paperId: paper.id,
          paper: paper as unknown as Record<string, unknown>,
          summary: paperAnalyses.at(-1)!.summary,
          score: paperAnalyses.at(-1)!.score,
          flags: paperAnalyses.at(-1)!.flags as unknown as Array<Record<string, unknown>>,
        })
      }
    } catch (err) {
      console.warn('[investigate] analyze failed', paper.title, err)
    }
  }
  step('analyze', '深度分析论文（造假维度）', 'done', `已分析 ${paperAnalyses.length} 篇`)

  const refTargets = papers.slice(0, limits.maxReferenceChecks)
  step('refs', '核查参考文献是否存在', 'running')
  const referenceChecks = []
  for (let i = 0; i < refTargets.length; i++) {
    const paper = refTargets[i]!
    step(
      'refs',
      '核查参考文献是否存在',
      'running',
      `核查 ${i + 1}/${refTargets.length}：${paper.title.slice(0, 40)}…`,
    )
    try {
      const refs = await getPaperCitations(deps.fetch, {
        paperId: paper.id,
        direction: 'references',
        limit: limits.citationFetchLimit,
        s2ApiKey: deps.s2ApiKey,
      })
      referenceChecks.push(await verifyPaperReferences(deps.fetch, paper, refs, deps.s2ApiKey))
      emitPartial(onPartial, { referenceChecks: [...referenceChecks] })
    } catch {
      // skip
    }
  }
  step('refs', '核查参考文献是否存在', 'done', `核查 ${referenceChecks.length} 篇`)

  const ossTargets = papers.slice(0, limits.maxOpensourceChecks)
  step('oss', '核查开源声称', 'running')
  const opensourceChecks = []
  for (let i = 0; i < ossTargets.length; i++) {
    const paper = ossTargets[i]!
    step('oss', '核查开源声称', 'running', `检查 ${i + 1}/${ossTargets.length} 篇`)
    const paperWeb = webFindings.filter(
      (w) =>
        w.snippet.toLowerCase().includes(name.toLowerCase()) ||
        w.title.toLowerCase().includes(paper.title.slice(0, 20).toLowerCase()),
    )
    opensourceChecks.push(verifyOpensourceClaims(paper, paperWeb))
    emitPartial(onPartial, { opensourceChecks: [...opensourceChecks] })
  }
  step('oss', '核查开源声称', 'done', `检查 ${opensourceChecks.length} 篇`)

  step('report', '生成综合调查报告', 'running')
  const synthesized = await synthesizePersonReport(deps.llmChat, {
    name,
    university,
    nameVariants,
    experts: filteredExperts,
    authors,
    papers,
    webFindings,
    paperAnalyses,
    referenceChecks,
    opensourceChecks,
  })
  step('report', '生成综合调查报告', 'done')

  return {
    subject: { name, university, nameVariants },
    experts: filteredExperts,
    authors,
    papers,
    webFindings,
    paperAnalyses,
    referenceChecks,
    opensourceChecks,
    ...synthesized,
    investigatedAt: new Date().toISOString(),
  }
}

export type { PersonInvestigationReport }
