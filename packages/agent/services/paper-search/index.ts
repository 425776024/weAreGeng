import type { FetchFn, SearchFilters, SearchResult, SourcesConfig } from '../../types'
import { DEFAULT_SOURCES } from '../../types'
import { dedupeByAuthor, extractDiscovered, mergePapers, sortPapers } from './merger'
import { searchOpenAlex } from './openalex'
import { searchSemanticScholar } from './semantic-scholar'

export interface SearchPapersOptions {
  fetch: FetchFn
  filters: SearchFilters
  sources?: Partial<SourcesConfig>
  s2ApiKey?: string
  /** 单次 API 拉取条数上限（默认 25） */
  limit?: number
}

export async function searchPapers(options: SearchPapersOptions): Promise<SearchResult> {
  const { fetch, filters } = options
  const sources = { ...DEFAULT_SOURCES, ...options.sources }
  const query = (filters.query || filters.author || '').trim()

  if (!query) {
    return {
      papers: [],
      total: 0,
      discovered: { names: [], universities: [], fields: [] },
      webResults: [],
    }
  }

  const params = {
    query,
    author: filters.author,
    yearFrom: filters.yearFrom,
    yearTo: filters.yearTo,
    limit: options.limit ?? 25,
  }

  let openAlex: import('../../types').Paper[] = []
  let s2: import('../../types').Paper[] = []

  if (sources.openAlex) {
    openAlex = await searchOpenAlex(fetch, params).catch((err) => {
      console.warn('[OpenAlex]', err)
      return []
    })
  }

  if (sources.semanticScholar) {
    s2 = await searchSemanticScholar(fetch, { ...params, apiKey: options.s2ApiKey }).catch((err) => {
      console.warn('[Semantic Scholar]', err)
      return []
    })
  }

  let papers = mergePapers(openAlex, s2)
  papers = sortPapers(papers)

  if (filters.dedupeByAuthor) {
    papers = dedupeByAuthor(papers)
  }

  return {
    papers,
    total: papers.length,
    discovered: extractDiscovered(papers),
    webResults: [],
  }
}

export { searchOpenAlex, getOpenAlexPaper } from './openalex'
export { searchSemanticScholar, getSemanticScholarPaper } from './semantic-scholar'
export { getPaperCitations, getPaperById } from './citations'
export type { CitationDirection } from './citations'
export { parsePaperInput, resolvePaperFromInput, createPaperFromPdf } from './resolve-input'
export type { ParsedPaperRef, PaperRefKind } from './resolve-input'
export * from './merger'
