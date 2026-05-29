import type { FetchFn, SourcesConfig } from '../types'
import type { LlmChatFn } from '../services/analyzer'
import type { WebSearchResult } from '../services/web-search'

export interface MemoryHit {
  sessionId: string
  sessionTitle?: string
  role: string
  content: string
  createdAt: string
}

export interface SaveAnalysisInput {
  paperId: string
  paper: Record<string, unknown>
  summary: string
  score: number
  flags?: Array<Record<string, unknown>>
  fullText?: string
}

export interface AgentToolDeps {
  fetch: FetchFn
  llmChat: LlmChatFn
  sources?: Partial<SourcesConfig>
  s2ApiKey?: string
  sessionId?: string
  searchExperts?: (name: string) => Array<Record<string, unknown>>
  readPdf?: (path: string) => Promise<{ pages: number; text: string; truncated: boolean }>
  readLocalFile?: (path: string) => Promise<{ content: string; truncated: boolean }>
  listAnalyses?: (limit?: number) => Promise<Array<Record<string, unknown>>>
  saveAnalysis?: (input: SaveAnalysisInput) => Promise<{ ok: boolean; id?: string }>
  recallMemory?: (
    query: string,
    options?: { sessionId?: string; limit?: number },
  ) => Promise<MemoryHit[]>
  webSearch?: (query: string) => Promise<WebSearchResult[]>
}
