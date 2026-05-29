import type { Paper } from '../../types'

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const longer = na.length >= nb.length ? na : nb
  const shorter = na.length < nb.length ? na : nb
  if (longer.includes(shorter)) return shorter.length / longer.length
  return 0
}

function paperKey(p: Paper): string {
  if (p.doi) return `doi:${p.doi.toLowerCase()}`
  return `title:${normalizeTitle(p.title)}`
}

function mergePair(primary: Paper, secondary: Paper): Paper {
  return {
    ...primary,
    abstract: primary.abstract || secondary.abstract,
    citations: Math.max(primary.citations ?? 0, secondary.citations ?? 0) || undefined,
    pdfUrl: primary.pdfUrl || secondary.pdfUrl,
    url: primary.url || secondary.url,
    university: primary.university || secondary.university,
    journal: primary.journal || secondary.journal,
    field: primary.field || secondary.field,
    source: primary.source === 'openalex' ? 'openalex+semantic-scholar' : primary.source,
  }
}

export function mergePapers(openAlex: Paper[], s2: Paper[]): Paper[] {
  const byKey = new Map<string, Paper>()

  for (const p of openAlex) {
    byKey.set(paperKey(p), p)
  }

  for (const p of s2) {
    const key = paperKey(p)
    const existing = byKey.get(key)
    if (existing) {
      byKey.set(key, mergePair(existing, p))
      continue
    }

    let matched = false
    for (const [k, ex] of byKey) {
      if (k.startsWith('doi:')) continue
      if (titleSimilarity(ex.title, p.title) >= 0.92) {
        byKey.set(k, mergePair(ex, p))
        matched = true
        break
      }
    }
    if (!matched) byKey.set(key, p)
  }

  return [...byKey.values()]
}

export function dedupeByAuthor(papers: Paper[]): Paper[] {
  const best = new Map<string, Paper>()
  for (const p of papers) {
    const author = p.primaryAuthor.toLowerCase()
    const prev = best.get(author)
    if (!prev || (p.citations ?? 0) > (prev.citations ?? 0)) {
      best.set(author, p)
    }
  }
  return [...best.values()]
}

export function sortPapers(papers: Paper[]): Paper[] {
  return [...papers].sort((a, b) => {
    const ca = a.citations ?? 0
    const cb = b.citations ?? 0
    if (cb !== ca) return cb - ca
    return b.year - a.year
  })
}

export function extractDiscovered(papers: Paper[]) {
  const names = new Set<string>()
  const universities = new Set<string>()
  const fields = new Set<string>()
  for (const p of papers) {
    names.add(p.primaryAuthor)
    if (p.university) universities.add(p.university)
    if (p.field) fields.add(p.field)
  }
  return {
    names: [...names].slice(0, 50),
    universities: [...universities].slice(0, 30),
    fields: [...fields].slice(0, 20),
  }
}
