import type { FetchFn, Paper } from '../../types'
import { getOpenAlexPaper } from './openalex'
import { mapWorkFromOpenAlex, OPENALEX_MAILTO, type OpenAlexWork } from './openalex-map'
import { getSemanticScholarPaper } from './semantic-scholar'

const S2_BASE = 'https://api.semanticscholar.org/graph/v1'
const S2_FIELDS = 'title,authors,year,abstract,externalIds,citationCount,journal,url'

export type CitationDirection = 'citing' | 'references'

export interface CitationsParams {
  paperId: string
  direction: CitationDirection
  limit?: number
  s2ApiKey?: string
}

function isOpenAlexId(id: string): boolean {
  return id.startsWith('https://openalex.org/') || /^W\d+/.test(id)
}

function normalizeOpenAlexId(id: string): string {
  if (id.startsWith('https://')) return id
  return `https://openalex.org/${id}`
}

async function fetchOpenAlexCiting(fetchFn: FetchFn, workId: string, limit: number): Promise<Paper[]> {
  const id = normalizeOpenAlexId(workId)
  const url = `${id}/cited_by?per-page=${limit}&mailto=${OPENALEX_MAILTO}`
  const res = await fetchFn(url)
  if (!res.ok) return []
  const data = (await res.json()) as { results?: OpenAlexWork[] }
  return (data.results ?? []).map(mapWorkFromOpenAlex).filter((p): p is Paper => p !== null)
}

async function fetchOpenAlexReferences(fetchFn: FetchFn, workId: string, limit: number): Promise<Paper[]> {
  const id = normalizeOpenAlexId(workId)
  const res = await fetchFn(`${id}?mailto=${OPENALEX_MAILTO}`)
  if (!res.ok) return []
  const work = (await res.json()) as OpenAlexWork
  const refs = (work.referenced_works ?? []).slice(0, limit)
  const papers: Paper[] = []
  for (const ref of refs) {
    const p = await getOpenAlexPaper(fetchFn, ref)
    if (p) papers.push(p)
  }
  return papers
}

async function fetchS2Citations(
  fetchFn: FetchFn,
  paperId: string,
  direction: CitationDirection,
  limit: number,
  apiKey?: string,
): Promise<Paper[]> {
  const endpoint = direction === 'citing' ? 'citations' : 'references'
  const url = `${S2_BASE}/paper/${encodeURIComponent(paperId)}/${endpoint}?fields=${S2_FIELDS}&limit=${limit}`
  const headers: Record<string, string> = {}
  if (apiKey) headers['x-api-key'] = apiKey
  const res = await fetchFn(url, { headers })
  if (!res.ok) return []
  const data = (await res.json()) as {
    data?: Array<{ citingPaper?: Record<string, unknown>; citedPaper?: Record<string, unknown> }>
  }
  return (data.data ?? [])
    .map((item): Paper | null => {
      const raw = (direction === 'citing' ? item.citingPaper : item.citedPaper) as Record<string, unknown> | undefined
      if (!raw || !raw.title) return null
      const authors = Array.isArray(raw.authors)
        ? (raw.authors as Array<{ name?: string }>).map((a) => a.name).filter((n): n is string => Boolean(n))
        : []
      return {
        id: String(raw.paperId ?? ''),
        title: String(raw.title),
        authors,
        primaryAuthor: authors[0] ?? 'Unknown',
        year: Number(raw.year) || 0,
        abstract: String(raw.abstract ?? ''),
        doi: (raw.externalIds as { DOI?: string })?.DOI,
        journal: (raw.journal as { name?: string })?.name,
        url: raw.url as string | undefined,
        source: 'semantic-scholar',
        citations: raw.citationCount as number | undefined,
      }
    })
    .filter((p): p is Paper => p !== null)
}

export async function getPaperCitations(fetchFn: FetchFn, params: CitationsParams): Promise<Paper[]> {
  const limit = Math.min(params.limit ?? 20, 50)
  const { paperId, direction } = params

  if (isOpenAlexId(paperId)) {
    const papers =
      direction === 'citing'
        ? await fetchOpenAlexCiting(fetchFn, paperId, limit)
        : await fetchOpenAlexReferences(fetchFn, paperId, limit)
    if (papers.length) return papers
  }

  const s2Papers = await fetchS2Citations(fetchFn, paperId, direction, limit, params.s2ApiKey)
  if (s2Papers.length) return s2Papers

  if (!isOpenAlexId(paperId)) {
    return direction === 'citing'
      ? fetchOpenAlexCiting(fetchFn, paperId, limit)
      : fetchOpenAlexReferences(fetchFn, paperId, limit)
  }

  return []
}

export async function getPaperById(
  fetchFn: FetchFn,
  paperId: string,
  s2ApiKey?: string,
): Promise<Paper | null> {
  if (isOpenAlexId(paperId)) {
    const p = await getOpenAlexPaper(fetchFn, paperId)
    if (p) return p
  }
  const s2 = await getSemanticScholarPaper(fetchFn, paperId, s2ApiKey)
  if (s2) return s2
  if (!isOpenAlexId(paperId)) {
    return getOpenAlexPaper(fetchFn, paperId)
  }
  return null
}
