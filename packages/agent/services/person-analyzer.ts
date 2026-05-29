import type { AnalysisFlag, AnalysisResult, Paper } from '../types'
import type { LlmChatFn } from './analyzer'
import type { AuthorCandidate } from './paper-search/authors'
import type { OpensourceCheckResult } from './claim-verify'
import type { ReferenceCheckResult } from './reference-verify'
import type { WebSearchResult } from './web-search'

export interface PersonInvestigationReport {
  subject: {
    name: string
    university?: string
    nameVariants: string[]
  }
  experts: Array<Record<string, unknown>>
  authors: AuthorCandidate[]
  papers: Paper[]
  webFindings: WebSearchResult[]
  paperAnalyses: AnalysisResult[]
  referenceChecks: ReferenceCheckResult[]
  opensourceChecks: OpensourceCheckResult[]
  summary: string
  overallScore: number
  flags: AnalysisFlag[]
  investigatedAt: string
}

const REPORT_SCHEMA = `{
  "summary": "string — 人物调查综合结论（中文）",
  "overallScore": "number 0-100 — 整体可疑程度",
  "flags": [{
    "type": "string",
    "severity": "low | medium | high",
    "description": "string",
    "evidence": "string"
  }]
}`

export async function synthesizePersonReport(
  llmChat: LlmChatFn,
  input: {
    name: string
    university?: string
    nameVariants: string[]
    experts: Array<Record<string, unknown>>
    authors: AuthorCandidate[]
    papers: Paper[]
    webFindings: WebSearchResult[]
    paperAnalyses: AnalysisResult[]
    referenceChecks: ReferenceCheckResult[]
    opensourceChecks: OpensourceCheckResult[]
  },
): Promise<{ summary: string; overallScore: number; flags: AnalysisFlag[] }> {
  const paperSummaries = input.paperAnalyses
    .map(
      (a) =>
        `- 《${a.paper.title}》(${a.paper.year}) 可疑分 ${a.score}：${a.summary}；flags: ${a.flags.map((f) => f.type).join(', ')}`,
    )
    .join('\n')

  const refSummaries = input.referenceChecks.map((r) => `- ${r.paperTitle}: ${r.summary}`).join('\n')
  const ossSummaries = input.opensourceChecks.map((r) => `- ${r.paperTitle}: ${r.summary}`).join('\n')

  const webSnippets = input.webFindings
    .slice(0, 10)
    .map((w) => `- ${w.title}: ${w.snippet.slice(0, 120)}`)
    .join('\n')

  const prompt = `你是学术打假调查专家。请基于以下多源证据，对「${input.name}」${input.university ? `@ ${input.university}` : ''} 做综合评估。

姓名变体：${input.nameVariants.join(' / ')}
本地专家匹配：${input.experts.length} 条
作者库候选：${input.authors.map((a) => `${a.name} (${a.affiliations.join('; ')})`).join('；') || '无'}
论文数量：${input.papers.length}

论文分析：
${paperSummaries || '（未分析）'}

参考文献核查：
${refSummaries || '（未核查）'}

开源声称核查：
${ossSummaries || '（未核查）'}

联网检索摘要：
${webSnippets || '（无）'}

重点关注：引用论文不存在、数据/表格异常、声称开源但无仓库、单位不匹配、自引异常、重复发表。
输出 JSON：${REPORT_SCHEMA}`

  const res = await llmChat({
    messages: [
      { role: 'system', content: '输出严格 JSON，中文描述。' },
      { role: 'user', content: prompt },
    ],
    jsonMode: true,
    maxTokens: 3000,
  })

  const cleaned = res.content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned) as {
    summary?: string
    overallScore?: number
    flags?: AnalysisFlag[]
  }

  return {
    summary: parsed.summary ?? '调查完成',
    overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) || 0)),
    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
  }
}
