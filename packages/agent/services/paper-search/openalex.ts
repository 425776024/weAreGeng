import type { FetchFn, Paper } from '../../types'
import { withRetryFetch } from '../../utils/retry-fetch'
import { mapWorkFromOpenAlex, OPENALEX_BASE, OPENALEX_MAILTO, type OpenAlexWork } from './openalex-map'

export interface OpenAlexSearchParams {
  query: string
  author?: string
  yearFrom?: number
  yearTo?: number
  limit?: number
}

export async function searchOpenAlex(
  fetchFn: FetchFn,
  params: OpenAlexSearchParams,
): Promise<Paper[]> {
  const retryFetch = withRetryFetch(fetchFn)
  const filters: string[] = []
  if (params.yearFrom && params.yearTo) {
    filters.push(`publication_year:${params.yearFrom}-${params.yearTo}`)
  } else if (params.yearFrom) {
    filters.push(`publication_year:>${params.yearFrom - 1}`)
  } else if (params.yearTo) {
    filters.push(`publication_year:<${params.yearTo + 1}`)
  }

  let searchQuery = params.query
  if (params.author) {
    searchQuery = `${params.query} ${params.author}`.trim()
  }

  const url = new URL(`${OPENALEX_BASE}/works`)
  url.searchParams.set('search', searchQuery)
  url.searchParams.set('per-page', String(params.limit ?? 25))
  url.searchParams.set('mailto', OPENALEX_MAILTO)
  if (filters.length) url.searchParams.set('filter', filters.join(','))

  const res = await retryFetch(url.toString())
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAlex 搜索失败 (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as { results?: OpenAlexWork[] }
  return (data.results ?? []).map(mapWorkFromOpenAlex).filter((p): p is Paper => p !== null)
}

export async function getOpenAlexPaper(fetchFn: FetchFn, id: string): Promise<Paper | null> {
  const retryFetch = withRetryFetch(fetchFn)
  const workId = id.startsWith('https://') ? id : `https://openalex.org/${id}`
  const url = `${workId}?mailto=${OPENALEX_MAILTO}`
  const res = await retryFetch(url)
  if (!res.ok) return null
  const work = (await res.json()) as OpenAlexWork
  return mapWorkFromOpenAlex(work)
}
