import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Paper } from '../types'
import { searchPapers, getPaperById, getPaperCitations } from '../services/paper-search'
import { searchAuthors } from '../services/paper-search/authors'
import { investigatePerson } from '../services/investigate-person'
import { verifyPaperReferences } from '../services/reference-verify'
import { verifyOpensourceClaims } from '../services/claim-verify'
import { expandNameVariants } from '../services/name-variants'
import { analyzePaperWithLlm } from '../services/analyzer'
import type { AgentToolDeps } from './deps'

export interface ToolSpec {
  name: string
  description: string
  schema: z.ZodTypeAny
  execute: (input: Record<string, unknown>, deps: AgentToolDeps) => Promise<unknown>
}

function params(schema: z.ZodTypeAny): Record<string, unknown> {
  return zodToJsonSchema(schema, { target: 'openApi3' }) as Record<string, unknown>
}

export const ACADEMIC_TOOL_SPECS: ToolSpec[] = [
  {
    name: 'search_papers',
    description: '搜索学术论文（OpenAlex + Semantic Scholar）',
    schema: z.object({
      query: z.string().describe('搜索关键词'),
      author: z.string().optional().describe('作者姓名'),
      yearFrom: z.number().optional(),
      yearTo: z.number().optional(),
    }),
    execute: async (input, deps) => {
      const res = await searchPapers({
        fetch: deps.fetch,
        filters: {
          query: String(input.query ?? ''),
          author: input.author ? String(input.author) : undefined,
          yearFrom: typeof input.yearFrom === 'number' ? input.yearFrom : undefined,
          yearTo: typeof input.yearTo === 'number' ? input.yearTo : undefined,
        },
        sources: deps.sources,
        s2ApiKey: deps.s2ApiKey,
      })
      return { total: res.total, papers: res.papers.slice(0, 10) }
    },
  },
  {
    name: 'search_authors',
    description: '按姓名检索 OpenAlex / Semantic Scholar 作者候选（支持中英文姓名，可结合学校筛选排序）',
    schema: z.object({
      name: z.string().describe('作者姓名（中文或英文）'),
      university: z.string().optional().describe('学校/单位名称，用于排序匹配'),
      limit: z.number().optional(),
    }),
    execute: async (input, deps) => {
      const nameVariants = await expandNameVariants(
        String(input.name ?? ''),
        input.university ? String(input.university) : undefined,
        deps.llmChat,
      )
      const allAuthors = []
      for (const variant of nameVariants.slice(0, 4)) {
        const found = await searchAuthors(deps.fetch, {
          name: variant,
          university: input.university ? String(input.university) : undefined,
          s2ApiKey: deps.s2ApiKey,
          limit: typeof input.limit === 'number' ? input.limit : 5,
        })
        allAuthors.push(...found)
      }
      const seen = new Set<string>()
      const authors = allAuthors.filter((a) => {
        const k = a.name.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      return { nameVariants, authors: authors.slice(0, 10) }
    },
  },
  {
    name: 'investigate_person',
    description:
      '对指定学者（姓名+学校）执行多步骤打假调查：姓名变体检索、论文搜索、联网背景、深度分析、参考文献与开源声称核查，返回综合报告',
    schema: z.object({
      name: z.string().describe('学者姓名（中文或英文）'),
      university: z.string().optional().describe('学校/单位'),
      maxPapers: z.number().optional().describe('最多检索论文数，默认 12，上限 20'),
    }),
    execute: async (input, deps) => {
      const report = await investigatePerson({
        name: String(input.name ?? ''),
        university: input.university ? String(input.university) : undefined,
        maxPapers: typeof input.maxPapers === 'number' ? input.maxPapers : 12,
        deps,
        sources: deps.sources,
      })
      return report
    },
  },
  {
    name: 'verify_paper_references',
    description: '核查论文参考文献是否能在学术数据库中检索到（识别不存在引用）',
    schema: z.object({
      paperId: z.string(),
      title: z.string().optional(),
    }),
    execute: async (input, deps) => {
      const paper = await getPaperById(deps.fetch, String(input.paperId ?? ''), deps.s2ApiKey)
      if (!paper) return { error: '未找到论文' }
      const refs = await getPaperCitations(deps.fetch, {
        paperId: paper.id,
        direction: 'references',
        limit: 15,
        s2ApiKey: deps.s2ApiKey,
      })
      return verifyPaperReferences(deps.fetch, paper, refs, deps.s2ApiKey)
    },
  },
  {
    name: 'verify_opensource_claims',
    description: '核查论文是否声称开源/公开代码，并结合联网结果判断是否找到仓库',
    schema: z.object({
      paperId: z.string().optional(),
      title: z.string(),
      abstract: z.string(),
      authors: z.array(z.string()).optional(),
      year: z.number().optional(),
    }),
    execute: async (input, deps) => {
      const paper: Paper = {
        id: String(input.paperId ?? `tmp-${Date.now()}`),
        title: String(input.title),
        authors: Array.isArray(input.authors) ? input.authors.map(String) : [],
        primaryAuthor: Array.isArray(input.authors) ? String(input.authors[0] ?? '') : '',
        year: Number(input.year) || 0,
        abstract: String(input.abstract ?? ''),
        source: 'agent',
      }
      let webResults: Array<{ title: string; url: string; snippet: string }> = []
      if (deps.webSearch) {
        const q = `${paper.title} github open source`
        webResults = await deps.webSearch(q)
      }
      return verifyOpensourceClaims(paper, webResults)
    },
  },
  {
    name: 'search_experts',
    description: '搜索本地专家人才库',
    schema: z.object({
      name: z.string().describe('专家姓名关键词'),
    }),
    execute: async (input, deps) => {
      if (!deps.searchExperts) return { experts: [], error: '专家库不可用' }
      return { experts: deps.searchExperts(String(input.name ?? '')) }
    },
  },
  {
    name: 'analyze_paper',
    description: '对论文进行 AI 学术诚信分析',
    schema: z.object({
      title: z.string(),
      authors: z.array(z.string()),
      year: z.number(),
      abstract: z.string(),
      doi: z.string().optional(),
      university: z.string().optional(),
      journal: z.string().optional(),
    }),
    execute: async (input, deps) => {
      const authors = Array.isArray(input.authors) ? input.authors.map(String) : []
      const paper: Paper = {
        id: input.doi ? String(input.doi) : `tmp-${Date.now()}`,
        title: String(input.title),
        authors,
        primaryAuthor: authors[0] ?? 'Unknown',
        university: input.university ? String(input.university) : undefined,
        journal: input.journal ? String(input.journal) : undefined,
        year: Number(input.year) || 0,
        abstract: String(input.abstract),
        doi: input.doi ? String(input.doi) : undefined,
        source: 'agent',
      }
      const result = await analyzePaperWithLlm(deps.llmChat, paper)
      if (deps.saveAnalysis) {
        await deps.saveAnalysis({
          paperId: paper.id,
          paper: paper as unknown as Record<string, unknown>,
          summary: result.summary,
          score: result.score,
          flags: result.flags as unknown as Array<Record<string, unknown>>,
        })
      }
      return { summary: result.summary, score: result.score, flags: result.flags }
    },
  },
  {
    name: 'save_analysis',
    description: '将 AI 分析结果持久化到本地数据库',
    schema: z.object({
      paperId: z.string(),
      title: z.string(),
      authors: z.array(z.string()),
      year: z.number(),
      abstract: z.string(),
      summary: z.string(),
      score: z.number(),
      doi: z.string().optional(),
      university: z.string().optional(),
      journal: z.string().optional(),
      flags: z.array(z.record(z.unknown())).optional(),
    }),
    execute: async (input, deps) => {
      if (!deps.saveAnalysis) return { ok: false, error: '分析持久化不可用' }
      const authors = Array.isArray(input.authors) ? input.authors.map(String) : []
      const paper: Paper = {
        id: String(input.paperId),
        title: String(input.title),
        authors,
        primaryAuthor: authors[0] ?? 'Unknown',
        university: input.university ? String(input.university) : undefined,
        journal: input.journal ? String(input.journal) : undefined,
        year: Number(input.year) || 0,
        abstract: String(input.abstract),
        doi: input.doi ? String(input.doi) : undefined,
        source: 'agent',
      }
      return deps.saveAnalysis({
        paperId: String(input.paperId),
        paper: paper as unknown as Record<string, unknown>,
        summary: String(input.summary),
        score: Number(input.score) || 0,
        flags: (input.flags as Array<Record<string, unknown>>) ?? [],
      })
    },
  },
  {
    name: 'get_paper',
    description: '按 OpenAlex ID / DOI / Semantic Scholar ID 获取论文详情',
    schema: z.object({
      paperId: z.string().describe('论文 ID（OpenAlex URL、W 开头 ID、DOI、S2 ID）'),
    }),
    execute: async (input, deps) => {
      const paper = await getPaperById(deps.fetch, String(input.paperId ?? ''), deps.s2ApiKey)
      return paper ?? { error: '未找到论文' }
    },
  },
  {
    name: 'get_citations',
    description: '获取论文引用链：citing=被哪些论文引用，references=引用了哪些论文',
    schema: z.object({
      paperId: z.string(),
      direction: z.enum(['citing', 'references']),
      limit: z.number().optional(),
    }),
    execute: async (input, deps) => {
      const direction = input.direction === 'references' ? 'references' : 'citing'
      const papers = await getPaperCitations(deps.fetch, {
        paperId: String(input.paperId),
        direction,
        limit: typeof input.limit === 'number' ? input.limit : 15,
        s2ApiKey: deps.s2ApiKey,
      })
      return { direction, count: papers.length, papers }
    },
  },
  {
    name: 'recall_analyses',
    description: '检索历史 AI 分析记录',
    schema: z.object({
      limit: z.number().optional(),
    }),
    execute: async (input, deps) => {
      if (!deps.listAnalyses) return { analyses: [], error: '分析记录不可用' }
      const limit = typeof input.limit === 'number' ? input.limit : 10
      const analyses = await deps.listAnalyses(limit)
      return { analyses }
    },
  },
  {
    name: 'recall_memory',
    description: '检索历史 Agent 对话记忆（关键词 + 语义向量）',
    schema: z.object({
      query: z.string().describe('搜索关键词'),
      sessionId: z.string().optional().describe('限定某个会话 ID，默认当前会话'),
      limit: z.number().optional(),
    }),
    execute: async (input, deps) => {
      if (!deps.recallMemory) return { memories: [], error: '对话记忆不可用' }
      const memories = await deps.recallMemory(String(input.query ?? ''), {
        sessionId: input.sessionId ? String(input.sessionId) : deps.sessionId,
        limit: typeof input.limit === 'number' ? input.limit : 10,
      })
      return { memories }
    },
  },
  {
    name: 'web_search',
    description: '联网搜索最新网页信息，补充论文线索',
    schema: z.object({
      query: z.string().describe('搜索关键词'),
    }),
    execute: async (input, deps) => {
      if (!deps.webSearch) return { results: [], error: '联网搜索未启用' }
      const results = await deps.webSearch(String(input.query ?? ''))
      return { results }
    },
  },
  {
    name: 'read_local_pdf',
    description: '读取本地 PDF 并提取文本',
    schema: z.object({
      path: z.string().describe('PDF 绝对路径'),
    }),
    execute: async (input, deps) => {
      if (!deps.readPdf) return { error: 'PDF 读取不可用' }
      const res = await deps.readPdf(String(input.path))
      return { pages: res.pages, truncated: res.truncated, text: res.text.slice(0, 100_000) }
    },
  },
  {
    name: 'read_local_file',
    description: '读取本地文本文件（txt/md/json 等）',
    schema: z.object({
      path: z.string().describe('文件绝对路径'),
      maxChars: z.number().optional().describe('最大字符数，默认 12000'),
    }),
    execute: async (input, deps) => {
      if (!deps.readLocalFile) return { error: '本地文件读取不可用' }
      const res = await deps.readLocalFile(String(input.path))
      const maxChars = typeof input.maxChars === 'number' ? input.maxChars : 12_000
      const truncated = res.content.length > maxChars
      return {
        truncated,
        content: res.content.slice(0, maxChars),
      }
    },
  },
]

export function toolParameters(spec: ToolSpec): Record<string, unknown> {
  return params(spec.schema)
}

export function parseToolInput(spec: ToolSpec, args: Record<string, unknown>): Record<string, unknown> {
  const parsed = spec.schema.safeParse(args)
  if (parsed.success) return parsed.data as Record<string, unknown>
  return args
}
