import type { FetchFn, Paper } from '../../types'
import { withRetryFetch } from '../../utils/retry-fetch'

const BASE = 'https://api.semanticscholar.org/graph/v1'

const FIELDS = [
  'title',
  'authors',
  'year',
  'abstract',
  'externalIds',
  'citationCount',
  'journal',
  'openAccessPdf',
  'url',
  'fieldsOfStudy',
  'authors.name',
  'authors.affiliations',
].join(',')

interface S2Paper {
  paperId?: string
  title?: string
  year?: number
  abstract?: string
  citationCount?: number
  url?: string
  journal?: { name?: string }
  openAccessPdf?: { url?: string }
  externalIds?: { DOI?: string; ArXiv?: string }
  authors?: Array<{
    name?: string
    affiliations?: string[]
  }>
  fieldsOfStudy?: string[]
}

function mapPaper(p: S2Paper): Paper | null {
  if (!p.paperId || !p.title) return null
  const authors = (p.authors ?? []).map((a) => a.name).filter((n): n is string => Boolean(n))
  const primaryAuthor = authors[0] ?? 'Unknown'
  const university = p.authors?.[0]?.affiliations?.[0]
  return {
    id: p.paperId,
    title: p.title,
    authors,
    primaryAuthor,
    university,
    journal: p.journal?.name,
    field: p.fieldsOfStudy?.[0],
    year: p.year ?? 0,
    abstract: p.abstract ?? '',
    doi: p.externalIds?.DOI,
    url: p.url,
    pdfUrl: p.openAccessPdf?.url,
    source: 'semantic-scholar',
    citations: p.citationCount,
  }
}

export interface S2SearchParams {
  query: string
  author?: string
  yearFrom?: number
  yearTo?: number
  limit?: number
  apiKey?: string
}

export async function searchSemanticScholar(
  fetchFn: FetchFn,
  params: S2SearchParams,
): Promise<Paper[]> {
  let q = params.query
  if (params.author) q = `${q} ${params.author}`.trim()

  const url = new URL(`${BASE}/paper/search`)
  url.searchParams.set('query', q)
  url.searchParams.set('limit', String(Math.min(params.limit ?? 25, 100)))
  url.searchParams.set('fields', FIELDS)

  const retryFetch = withRetryFetch(fetchFn)
  const headers: Record<string, string> = {}
  if (params.apiKey) headers['x-api-key'] = params.apiKey

  const res = await retryFetch(url.toString(), { headers })
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Semantic Scholar 请求频率超限，请稍后重试或配置 API Key')
    }
    const body = await res.text()
    throw new Error(`Semantic Scholar 搜索失败 (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as { data?: S2Paper[] }
  let papers = (data.data ?? []).map(mapPaper).filter((p): p is Paper => p !== null)

  if (params.yearFrom || params.yearTo) {
    papers = papers.filter((p) => {
      if (!p.year) return true
      if (params.yearFrom && p.year < params.yearFrom) return false
      if (params.yearTo && p.year > params.yearTo) return false
      return true
    })
  }

  return papers
}

export async function getSemanticScholarPaper(
  fetchFn: FetchFn,
  paperId: string,
  apiKey?: string,
): Promise<Paper | null> {
  const retryFetch = withRetryFetch(fetchFn)
  const headers: Record<string, string> = {}
  if (apiKey) headers['x-api-key'] = apiKey
  const url = `${BASE}/paper/${encodeURIComponent(paperId)}?fields=${FIELDS}`
  const res = await retryFetch(url, { headers })
  if (!res.ok) return null
  const p = (await res.json()) as S2Paper
  return mapPaper(p)
}
