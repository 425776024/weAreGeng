import { getDefaults, getExperts, getExpertOrgGroups, getExpertsForUniversity, getFields, getJournals, getUniversities } from '../data/loader'
import { invoke } from '@tauri-apps/api/core'
import { agentFetch } from './agent-fetch'
import { llmChat } from './llm'
import { tauriListAnalyses, tauriSaveAnalysis, tauriListBookmarks, tauriSaveBookmark, tauriDeleteBookmark } from './tauri-backend'
import {
  searchPapers,
  resolvePaperFromInput,
  createPaperFromPdf,
} from '@wearegeng/agent/services/paper-search'
import { analyzePaperWithLlm, analyzePapersBatch } from '@wearegeng/agent/services/analyzer'
import { tauriExtractPdf } from './tauri-backend'
import type { AnalysisResult as AgentAnalysisResult, Paper as AgentPaper } from '@wearegeng/agent/types'

export interface University {
  id: string
  name: string
  shortName: string
  is985: boolean
  is211: boolean
  rank: number
  province: string
}

export interface Field {
  id: string
  name: string
  keywords: string[]
}

export interface Journal {
  id: string
  name: string
  publisher: string
  tier: 'top' | 'major' | 'general'
}

export interface Expert {
  id: string
  name: string
  title: string
  university: string
  field: string
  tags: string[]
  honor?: string
  year?: number
  source?: string
  sourceOrg?: string
}

export interface ExpertOrgGroup {
  id: string
  name: string
  universityId?: string
  experts: Expert[]
  count: number
}

export interface Paper {
  id: string
  title: string
  authors: string[]
  primaryAuthor: string
  university?: string
  journal?: string
  field?: string
  year: number
  abstract: string
  doi?: string
  url?: string
  pdfUrl?: string
  source: string
  citations?: number
}

export interface AnalysisFlag {
  type: string
  severity: 'low' | 'medium' | 'high'
  description: string
  evidence: string
}

export interface AnalysisResult {
  paperId: string
  paper: Paper
  analyzedAt: string
  summary: string
  score: number
  flags: AnalysisFlag[]
  fullText?: string
}

export interface SearchFilters {
  query: string
  universityId: string
  fieldId: string
  journalId: string
  author: string
  yearFrom: number
  yearTo: number
}

export interface SourcesConfig {
  semanticScholar: boolean
  crossref: boolean
  arxiv: boolean
  pubmed: boolean
  openAlex: boolean
}

export interface McpConfig {
  semanticScholarEnabled: boolean
}

export interface AppConfig {
  llm: { baseUrl: string; apiKey: string; model: string; temperature: number }
  search: { enabled: boolean; provider: string; apiKey: string }
  sources: SourcesConfig
  mcp: McpConfig
}

export interface ConfigResponse extends AppConfig {
  llmConfigured: boolean
}

function delay<T>(value: T, ms = 80): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

async function persistAnalysis(result: AgentAnalysisResult) {
  await tauriSaveAnalysis({
    id: `${result.paperId}-${Date.now()}`,
    paperId: result.paperId,
    paperJson: JSON.stringify(result.paper),
    summary: result.summary,
    score: result.score,
    flagsJson: JSON.stringify(result.flags),
    fullText: result.fullText,
    analyzedAt: result.analyzedAt,
  })
}

export const api = {
  getUniversities: () => delay(getUniversities()),
  getExperts: () => delay(getExperts()),
  getExpertOrgGroups: () => delay(getExpertOrgGroups()),
  getExpertsForUniversity: (universityId: string) => delay(getExpertsForUniversity(universityId)),
  getFields: () => delay(getFields()),
  getJournals: () => delay(getJournals()),
  getDefaults: () => delay(getDefaults()),

  search: async (body?: Record<string, unknown>) => {
    const config = await api.getConfig()
    const res = await searchPapers({
      fetch: agentFetch,
      filters: {
        query: body?.query as string | undefined,
        author: body?.author as string | undefined,
        universityId: body?.universityId as string | undefined,
        fieldId: body?.fieldId as string | undefined,
        journalId: body?.journalId as string | undefined,
        yearFrom: body?.yearFrom as number | undefined,
        yearTo: body?.yearTo as number | undefined,
        dedupeByAuthor: body?.dedupeByAuthor as boolean | undefined,
        enableWebSearch: body?.enableWebSearch as boolean | undefined,
      },
      sources: config.sources,
      s2ApiKey: config.search.apiKey && config.search.apiKey !== '***' ? config.search.apiKey : undefined,
    })

    if (body?.enableWebSearch && config.search.enabled) {
      const query = String(body?.query || body?.author || '').trim()
      if (query) {
        try {
          res.webResults = await invoke('web_search', { query, limit: 8 })
        } catch (err) {
          console.warn('[web_search]', err)
        }
      }
    }

    return res
  },

  analyze: async (paper: Paper, fullText?: string) => {
    const result = await analyzePaperWithLlm(
      async (opts) => {
        const res = await llmChat({ messages: opts.messages, maxTokens: opts.maxTokens, jsonMode: opts.jsonMode })
        return { content: res.content }
      },
      paper as AgentPaper,
      fullText,
    )
    await persistAnalysis(result as AgentAnalysisResult)
    return result
  },

  resolvePaperInput: async (input: string) => {
    const config = await api.getConfig()
    return resolvePaperFromInput(
      agentFetch,
      input,
      config.search.apiKey && config.search.apiKey !== '***' ? config.search.apiKey : undefined,
    ) as Promise<Paper>
  },

  analyzeFromLink: async (input: string) => {
    const paper = await api.resolvePaperInput(input)
    return api.analyze(paper)
  },

  analyzeFromPdf: async (path: string) => {
    const extracted = await tauriExtractPdf(path)
    const paper = createPaperFromPdf(path, extracted.text)
    return api.analyze(paper, extracted.text)
  },

  analyzeBatch: async (papers: Paper[]) => {
    const results = await analyzePapersBatch(
      async (opts) => {
        const res = await llmChat({ messages: opts.messages, maxTokens: opts.maxTokens, jsonMode: opts.jsonMode })
        return { content: res.content }
      },
      papers as AgentPaper[],
    )
    for (const r of results) {
      await persistAnalysis(r)
    }
    return { results }
  },

  getCachedAnalyses: async () => {
    const rows = await tauriListAnalyses()
    const results: AnalysisResult[] = rows.map((row) => {
      const paper = JSON.parse(row.paperJson) as Paper
      return {
        paperId: row.paperId,
        paper,
        analyzedAt: row.analyzedAt,
        summary: row.summary ?? '',
        score: row.score ?? 0,
        flags: row.flagsJson ? (JSON.parse(row.flagsJson) as AnalysisResult['flags']) : [],
        fullText: row.fullText,
      }
    })
    return { results }
  },

  getConfig: () => invoke<ConfigResponse>('get_config'),

  updateConfig: (body: Record<string, unknown>) =>
    invoke<{ ok: boolean; llmConfigured: boolean }>('update_config', { body }),

  testLLM: (llm?: Partial<AppConfig['llm']> | null) =>
    invoke<{ ok: boolean; reply?: string; error?: string }>('test_llm', { llm: llm ?? null }),

  listBookmarks: async () => {
    const rows = await tauriListBookmarks()
    return rows.map((row) => ({
      id: row.id,
      paper: JSON.parse(row.paperJson) as Paper,
      paperId: row.paperId,
      note: row.note,
      createdAt: row.createdAt,
    }))
  },

  saveBookmark: async (paper: Paper, note?: string) => {
    const id = `bookmark-${Date.now()}`
    await tauriSaveBookmark({
      id,
      paperId: paper.id,
      paperJson: JSON.stringify(paper),
      note: note ?? undefined,
    })
    return { id }
  },

  deleteBookmark: async (id: string) => {
    await tauriDeleteBookmark(id)
    return { ok: true }
  },
}

export { proxiedFetch } from './proxy'
