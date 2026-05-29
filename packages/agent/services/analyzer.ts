import type { AnalysisFlag, AnalysisResult, Paper } from '../types'

export type LlmChatFn = (options: {
  messages: Array<{ role: string; content: string }>
  maxTokens?: number
  jsonMode?: boolean
}) => Promise<{ content: string }>

const ANALYSIS_SCHEMA = `{
  "summary": "string — 分析摘要",
  "score": "number 0-100 — 可疑程度，越高越可疑",
  "flags": [{
    "type": "string — 问题类型",
    "severity": "low | medium | high",
    "description": "string — 问题描述",
    "evidence": "string — 支持证据片段"
  }]
}`

function buildPrompt(paper: Paper, fullText?: string): string {
  const content = fullText || paper.abstract || '(无摘要)'
  return `你是一位学术诚信与论文打假分析专家。请深度分析以下论文是否存在学术不端或可疑迹象。

论文标题：${paper.title}
作者：${paper.authors.join(', ')}
单位：${paper.university ?? '未知'}
期刊：${paper.journal ?? '未知'}
年份：${paper.year}
DOI：${paper.doi ?? '无'}

正文/摘要：
${content.slice(0, 12000)}

请重点检查以下维度（发现则写入 flags）：
1. **引用异常**：参考文献可能不存在、与主题无关、自引过高、引用环
2. **开源/数据声称**：声称开源/公开数据/公开代码但摘要中无 repo/链接，或描述模糊
3. **数据与表格**：统计数字前后矛盾、表格/图注与正文不一致、异常完美结果
4. **摘要-正文一致性**：摘要夸大结论、与正文方法/结果不符
5. **作者单位不匹配**：作者 affiliation 与论文主题/数据地域明显不符
6. **重复发表/一稿多投**：标题或方法与已知工作高度相似（基于摘要判断）
7. **期刊/会议匹配度**：主题与 venue 明显不符

请以 JSON 格式输出分析结果，schema 如下：
${ANALYSIS_SCHEMA}

只输出 JSON，不要其他文字。`
}

function parseAnalysisJson(raw: string): {
  summary: string
  score: number
  flags: AnalysisFlag[]
} {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned) as {
    summary?: string
    score?: number
    flags?: AnalysisFlag[]
  }
  return {
    summary: parsed.summary ?? '分析完成',
    score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
  }
}

export async function analyzePaperWithLlm(
  llmChat: LlmChatFn,
  paper: Paper,
  fullText?: string,
): Promise<AnalysisResult> {
  const content = await llmChat({
    messages: [
      {
        role: 'system',
        content: '你是学术打假分析助手，输出严格的 JSON 格式分析结果。',
      },
      { role: 'user', content: buildPrompt(paper, fullText) },
    ],
    jsonMode: true,
    maxTokens: 2048,
  })

  const parsed = parseAnalysisJson(content.content)
  return {
    paperId: paper.id,
    paper,
    analyzedAt: new Date().toISOString(),
    ...parsed,
    fullText: fullText?.slice(0, 50_000),
  }
}

export async function analyzePapersBatch(
  llmChat: LlmChatFn,
  papers: Paper[],
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = []
  for (const paper of papers) {
    results.push(await analyzePaperWithLlm(llmChat, paper))
  }
  return results
}
