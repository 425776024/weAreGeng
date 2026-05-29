import { describe, expect, it } from 'vitest'
import { mapWorkFromOpenAlex } from '../openalex-map'
import { dedupeByAuthor, mergePapers, sortPapers } from '../merger'
import type { Paper } from '../../../types'

describe('mapWorkFromOpenAlex', () => {
  it('maps basic fields and rebuilds abstract', () => {
    const paper = mapWorkFromOpenAlex({
      id: 'https://openalex.org/W123',
      title: 'Test Paper',
      publication_year: 2024,
      doi: 'https://doi.org/10.1000/test',
      cited_by_count: 42,
      abstract_inverted_index: { Hello: [0], world: [1] },
      authorships: [
        {
          author: { display_name: 'Alice' },
          institutions: [{ display_name: 'Tsinghua University' }],
        },
      ],
      primary_location: {
        landing_page_url: 'https://example.com/paper',
        source: { display_name: 'Nature' },
      },
    })
    expect(paper).not.toBeNull()
    expect(paper!.title).toBe('Test Paper')
    expect(paper!.abstract).toBe('Hello world')
    expect(paper!.doi).toBe('10.1000/test')
    expect(paper!.primaryAuthor).toBe('Alice')
    expect(paper!.citations).toBe(42)
  })

  it('returns null when title missing', () => {
    expect(mapWorkFromOpenAlex({ id: 'W1' })).toBeNull()
  })
})

describe('mergePapers', () => {
  const openAlex: Paper[] = [
    {
      id: 'oa-1',
      title: 'Deep Learning Survey',
      authors: ['A'],
      primaryAuthor: 'A',
      year: 2023,
      abstract: 'OA abstract',
      doi: '10.1/abc',
      source: 'openalex',
      citations: 10,
    },
  ]
  const s2: Paper[] = [
    {
      id: 's2-1',
      title: 'Deep Learning Survey',
      authors: ['A'],
      primaryAuthor: 'A',
      year: 2023,
      abstract: 'S2 longer abstract',
      doi: '10.1/abc',
      source: 'semantic-scholar',
      citations: 20,
    },
  ]

  it('merges by DOI and keeps higher citations', () => {
    const merged = mergePapers(openAlex, s2)
    expect(merged).toHaveLength(1)
    expect(merged[0].citations).toBe(20)
    expect(merged[0].abstract).toBe('OA abstract')
  })
})

describe('dedupeByAuthor', () => {
  it('keeps highest cited paper per author', () => {
    const papers: Paper[] = [
      { id: '1', title: 'P1', authors: ['X'], primaryAuthor: 'X', year: 2020, abstract: '', source: 'oa', citations: 5 },
      { id: '2', title: 'P2', authors: ['X'], primaryAuthor: 'X', year: 2021, abstract: '', source: 'oa', citations: 50 },
    ]
    const out = dedupeByAuthor(papers)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('2')
  })
})

describe('sortPapers', () => {
  it('sorts by citations desc then year', () => {
    const papers: Paper[] = [
      { id: '1', title: 'A', authors: [], primaryAuthor: 'A', year: 2020, abstract: '', source: 'oa', citations: 1 },
      { id: '2', title: 'B', authors: [], primaryAuthor: 'B', year: 2024, abstract: '', source: 'oa', citations: 99 },
    ]
    const sorted = sortPapers(papers)
    expect(sorted[0].id).toBe('2')
  })
})
