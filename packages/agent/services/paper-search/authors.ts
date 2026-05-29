import type { FetchFn } from '../../types'
import { withRetryFetch } from '../../utils/retry-fetch'
import { OPENALEX_BASE, OPENALEX_MAILTO } from './openalex-map'

export interface AuthorCandidate {
  id: string
  name: string
  affiliations: string[]
  paperCount?: number
  citationCount?: number
  source: 'openalex' | 'semantic-scholar'
  orcid?: string
}

interface OpenAlexAuthor {
  id?: string
  display_name?: string
  works_count?: number
  cited_by_count?: number
  orcid?: string
  last_known_institutions?: Array<{ display_name?: string }>
}

interface S2Author {
  authorId?: string
  name?: string
  paperCount?: number
  citationCount?: number
  affiliations?: string[]
}

function affiliationMatch(affiliations: string[], university?: string): boolean {
  if (!university?.trim()) return true
  const q = university.trim().toLowerCase()
  return affiliations.some((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))
}

function rankAuthors(authors: AuthorCandidate[], university?: string): AuthorCandidate[] {
  return [...authors].sort((a, b) => {
    const aMatch = affiliationMatch(a.affiliations, university) ? 1 : 0
    const bMatch = affiliationMatch(b.affiliations, university) ? 1 : 0
    if (aMatch !== bMatch) return bMatch - aMatch
    return (b.citationCount ?? 0) - (a.citationCount ?? 0)
  })
}

export async function searchOpenAlexAuthors(
  fetchFn: FetchFn,
  query: string,
  limit = 10,
): Promise<AuthorCandidate[]> {
  const retryFetch = withRetryFetch(fetchFn)
  const url = new URL(`${OPENALEX_BASE}/authors`)
  url.searchParams.set('search', query)
  url.searchParams.set('per-page', String(Math.min(limit, 25)))
  url.searchParams.set('mailto', OPENALEX_MAILTO)

  const res = await retryFetch(url.toString())
  if (!res.ok) return []

  const data = (await res.json()) as { results?: OpenAlexAuthor[] }
  return (data.results ?? [])
    .filter((a) => a.id && a.display_name)
    .map((a) => ({
      id: a.id!,
      name: a.display_name!,
      affiliations: (a.last_known_institutions ?? [])
        .map((i) => i.display_name)
        .filter((n): n is string => Boolean(n)),
      paperCount: a.works_count,
      citationCount: a.cited_by_count,
      source: 'openalex' as const,
      orcid: a.orcid,
    }))
}

export async function searchSemanticScholarAuthors(
  fetchFn: FetchFn,
  query: string,
  limit = 10,
  apiKey?: string,
): Promise<AuthorCandidate[]> {
  const retryFetch = withRetryFetch(fetchFn)
  const url = new URL('https://api.semanticscholar.org/graph/v1/author/search')
  url.searchParams.set('query', query)
  url.searchParams.set('limit', String(Math.min(limit, 25)))
  url.searchParams.set('fields', 'name,affiliations,paperCount,citationCount')

  const headers: Record<string, string> = {}
  if (apiKey) headers['x-api-key'] = apiKey

  const res = await retryFetch(url.toString(), { headers })
  if (!res.ok) return []

  const data = (await res.json()) as { data?: S2Author[] }
  return (data.data ?? [])
    .filter((a) => a.authorId && a.name)
    .map((a) => ({
      id: a.authorId!,
      name: a.name!,
      affiliations: a.affiliations ?? [],
      paperCount: a.paperCount,
      citationCount: a.citationCount,
      source: 'semantic-scholar' as const,
    }))
}

export async function searchAuthors(
  fetchFn: FetchFn,
  options: {
    name: string
    university?: string
    s2ApiKey?: string
    limit?: number
    /** 默认两者都查；调查场景可仅 OpenAlex */
    useOpenAlex?: boolean
    useSemanticScholar?: boolean
  },
): Promise<AuthorCandidate[]> {
  const limit = options.limit ?? 10
  const useOa = options.useOpenAlex !== false
  const useS2 = options.useSemanticScholar !== false

  const oa = useOa
    ? await searchOpenAlexAuthors(fetchFn, options.name, limit).catch(() => [])
    : []
  const s2 = useS2
    ? await searchSemanticScholarAuthors(fetchFn, options.name, limit, options.s2ApiKey).catch(() => [])
    : []

  const merged = new Map<string, AuthorCandidate>()
  for (const a of [...oa, ...s2]) {
    const key = a.name.toLowerCase()
    const existing = merged.get(key)
    if (!existing || (a.citationCount ?? 0) > (existing.citationCount ?? 0)) {
      merged.set(key, a)
    }
  }

  return rankAuthors([...merged.values()], options.university).slice(0, limit)
}
