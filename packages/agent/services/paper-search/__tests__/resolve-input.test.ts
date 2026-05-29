import { describe, expect, it } from 'vitest'
import { createPaperFromPdf, parsePaperInput } from '../resolve-input'

describe('parsePaperInput', () => {
  it('parses bare DOI', () => {
    expect(parsePaperInput('10.1038/nature12373')).toEqual({ kind: 'doi', id: '10.1038/nature12373' })
  })

  it('parses doi.org URL', () => {
    expect(parsePaperInput('https://doi.org/10.1038/nature12373')).toEqual({
      kind: 'doi',
      id: '10.1038/nature12373',
    })
  })

  it('parses OpenAlex URL', () => {
    expect(parsePaperInput('https://openalex.org/W2741809800')).toEqual({
      kind: 'openalex',
      id: 'W2741809800',
    })
  })

  it('parses arXiv URL', () => {
    expect(parsePaperInput('https://arxiv.org/abs/2301.00001')).toEqual({
      kind: 'arxiv',
      id: '2301.00001',
    })
  })

  it('parses Semantic Scholar URL', () => {
    expect(parsePaperInput('https://www.semanticscholar.org/paper/Some-Title/abc12345-6789-0123-abcd-ef0123456789')).toEqual({
      kind: 's2',
      id: 'abc12345-6789-0123-abcd-ef0123456789',
    })
  })

  it('parses direct PDF URL', () => {
    const parsed = parsePaperInput('https://example.com/papers/sample-paper.pdf')
    expect(parsed?.kind).toBe('pdf-url')
    expect(parsed?.id).toBe('https://example.com/papers/sample-paper.pdf')
  })

  it('returns null for empty input', () => {
    expect(parsePaperInput('')).toBeNull()
    expect(parsePaperInput('   ')).toBeNull()
  })
})

describe('createPaperFromPdf', () => {
  it('uses first substantial line as title', () => {
    const text = 'Deep Learning for Science\nAlice Smith\nAbstract\nThis paper studies models.'
    const paper = createPaperFromPdf('/tmp/deep-learning.pdf', text)
    expect(paper.title).toBe('Deep Learning for Science')
    expect(paper.source).toBe('local-pdf')
    expect(paper.abstract).toContain('Alice Smith')
  })
})
