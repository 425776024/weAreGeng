import type { Paper } from '../../types'

export interface OpenAlexWork {
  id: string
  title?: string
  publication_year?: number
  doi?: string
  cited_by_count?: number
  abstract_inverted_index?: Record<string, number[]>
  referenced_works?: string[]
  authorships?: Array<{
    author?: { display_name?: string }
    institutions?: Array<{ display_name?: string }>
  }>
  primary_location?: {
    landing_page_url?: string
    source?: { display_name?: string }
  }
  open_access?: { oa_url?: string }
  topics?: Array<{ display_name?: string }>
}

function rebuildAbstract(index?: Record<string, number[]>): string {
  if (!index) return ''
  const pairs: Array<[number, string]> = []
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) pairs.push([pos, word])
  }
  pairs.sort((a, b) => a[0] - b[0])
  return pairs.map(([, w]) => w).join(' ')
}

export function mapWorkFromOpenAlex(work: OpenAlexWork): Paper | null {
  if (!work.id || !work.title) return null
  const authors = (work.authorships ?? [])
    .map((a) => a.author?.display_name)
    .filter((n): n is string => Boolean(n))
  const primaryAuthor = authors[0] ?? 'Unknown'
  const university = work.authorships?.[0]?.institutions?.[0]?.display_name
  const doi = work.doi?.replace('https://doi.org/', '')
  return {
    id: work.id,
    title: work.title,
    authors,
    primaryAuthor,
    university,
    journal: work.primary_location?.source?.display_name,
    field: work.topics?.[0]?.display_name,
    year: work.publication_year ?? 0,
    abstract: rebuildAbstract(work.abstract_inverted_index),
    doi,
    url: work.primary_location?.landing_page_url ?? work.id,
    pdfUrl: work.open_access?.oa_url,
    source: 'openalex',
    citations: work.cited_by_count,
  }
}

export const OPENALEX_MAILTO = 'wearegeng@example.com'
export const OPENALEX_BASE = 'https://api.openalex.org'
