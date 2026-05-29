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
  query?: string
  universityId?: string
  fieldId?: string
  journalId?: string
  author?: string
  yearFrom?: number
  yearTo?: number
  dedupeByAuthor?: boolean
  enableWebSearch?: boolean
}

export interface SearchResult {
  papers: Paper[]
  total: number
  discovered: {
    names: string[]
    universities: string[]
    fields: string[]
  }
  webResults: Array<{ title: string; url: string; snippet: string }>
}

export type FetchFn = (
  url: string,
  init?: RequestInit & { timeoutSecs?: number },
) => Promise<Response>

export interface SourcesConfig {
  semanticScholar: boolean
  crossref: boolean
  arxiv: boolean
  pubmed: boolean
  openAlex: boolean
}

export const DEFAULT_SOURCES: SourcesConfig = {
  semanticScholar: true,
  crossref: true,
  arxiv: true,
  pubmed: false,
  openAlex: true,
}
