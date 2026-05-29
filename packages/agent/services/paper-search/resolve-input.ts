import type { FetchFn, Paper } from '../../types'
import { withRetryFetch } from '../../utils/retry-fetch'
import { getPaperById } from './citations'
import { mapWorkFromOpenAlex, OPENALEX_BASE, OPENALEX_MAILTO, type OpenAlexWork } from './openalex-map'

export type PaperRefKind = 'doi' | 'openalex' | 's2' | 'arxiv' | 'pmid' | 'pdf-url'

export interface ParsedPaperRef {
  kind: PaperRefKind
  id: string
}

const DOI_RE = /^10\.\d{4,9}\/[^\s]+$/i
const BARE_DOI_IN_TEXT = /(?:doi[:\s]*)?(10\.\d{4,9}\/[^\s?#]+)/i

export function parsePaperInput(raw: string): ParsedPaperRef | null {
  const input = raw.trim()
  if (!input) return null

  if (DOI_RE.test(input)) {
    return { kind: 'doi', id: input }
  }

  let url: URL | null = null
  try {
    url = new URL(input.includes('://') ? input : `https://${input}`)
  } catch {
    const doiMatch = input.match(BARE_DOI_IN_TEXT)
    if (doiMatch?.[1]) return { kind: 'doi', id: doiMatch[1] }
    return null
  }

  const host = url.hostname.replace(/^www\./, '')
  const path = url.pathname

  if (host === 'doi.org' || host === 'dx.doi.org') {
    const doi = decodeURIComponent(path.replace(/^\//, ''))
    if (doi) return { kind: 'doi', id: doi }
  }

  const openAlexMatch = path.match(/\/(W\d+)\/?$/i)
  if (host === 'openalex.org' && openAlexMatch?.[1]) {
    return { kind: 'openalex', id: openAlexMatch[1] }
  }

  if (host === 'arxiv.org') {
    const arxivMatch = path.match(/\/(?:abs|pdf)\/([^/?#]+)/i)
    if (arxivMatch?.[1]) {
      return { kind: 'arxiv', id: arxivMatch[1].replace(/\.pdf$/i, '') }
    }
  }

  if (host === 'semanticscholar.org') {
    const s2Match = path.match(/\/paper\/(?:[^/]+\/)?([0-9a-f-]{36}|\d+)/i)
    if (s2Match?.[1]) return { kind: 's2', id: s2Match[1] }
  }

  if (host === 'pubmed.ncbi.nlm.nih.gov') {
    const pmidMatch = path.match(/\/(\d+)\/?$/i)
    if (pmidMatch?.[1]) return { kind: 'pmid', id: pmidMatch[1] }
  }

  const doiInUrl = input.match(BARE_DOI_IN_TEXT)
  if (doiInUrl?.[1]) return { kind: 'doi', id: doiInUrl[1] }

  if (/\.pdf(?:$|[?#])/i.test(path)) {
    return { kind: 'pdf-url', id: url.toString() }
  }

  return null
}

async function fetchOpenAlexByDoi(fetchFn: FetchFn, doi: string): Promise<Paper | null> {
  const retryFetch = withRetryFetch(fetchFn)
  const url = `${OPENALEX_BASE}/works/https://doi.org/${encodeURIComponent(doi)}?mailto=${OPENALEX_MAILTO}`
  const res = await retryFetch(url)
  if (!res.ok) return null
  const work = (await res.json()) as OpenAlexWork
  return mapWorkFromOpenAlex(work)
}

async function fetchOpenAlexByArxiv(fetchFn: FetchFn, arxivId: string): Promise<Paper | null> {
  const retryFetch = withRetryFetch(fetchFn)
  const url = `${OPENALEX_BASE}/works?filter=ids.arxiv:${encodeURIComponent(arxivId)}&per-page=1&mailto=${OPENALEX_MAILTO}`
  const res = await retryFetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as { results?: OpenAlexWork[] }
  const work = data.results?.[0]
  return work ? mapWorkFromOpenAlex(work) : null
}

async function fetchOpenAlexByPmid(fetchFn: FetchFn, pmid: string): Promise<Paper | null> {
  const retryFetch = withRetryFetch(fetchFn)
  const url = `${OPENALEX_BASE}/works?filter=ids.pmid:${encodeURIComponent(pmid)}&per-page=1&mailto=${OPENALEX_MAILTO}`
  const res = await retryFetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as { results?: OpenAlexWork[] }
  const work = data.results?.[0]
  return work ? mapWorkFromOpenAlex(work) : null
}

function paperFromPdfUrl(url: string): Paper {
  let title = 'PDF 论文'
  try {
    const parsed = new URL(url)
    const name = decodeURIComponent(parsed.pathname.split('/').pop() ?? '')
    if (name) title = name.replace(/\.pdf$/i, '')
  } catch {
    // keep default title
  }
  return {
    id: `pdf-url-${Date.now()}`,
    title,
    authors: ['未知'],
    primaryAuthor: '未知',
    year: new Date().getFullYear(),
    abstract: '(通过 PDF 链接导入，未能自动获取摘要；分析将基于可用元数据)',
    url,
    pdfUrl: url,
    source: 'import',
  }
}

export function createPaperFromPdf(path: string, extractedText: string): Paper {
  const filename = path.split(/[/\\]/).pop()?.replace(/\.pdf$/i, '') ?? 'Imported PDF'
  const lines = extractedText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3)

  let title = filename
  if (lines[0] && lines[0].length >= 8 && lines[0].length <= 300) {
    title = lines[0]
  }

  const abstract =
    lines.slice(1, 25).join(' ').slice(0, 2000) ||
    '(从本地 PDF 导入，未能提取摘要；分析将基于正文片段)'

  return {
    id: `local-pdf-${Date.now()}`,
    title,
    authors: ['未知'],
    primaryAuthor: '未知',
    year: new Date().getFullYear(),
    abstract,
    url: path,
    pdfUrl: path,
    source: 'local-pdf',
  }
}

export async function resolvePaperFromInput(
  fetchFn: FetchFn,
  input: string,
  s2ApiKey?: string,
): Promise<Paper> {
  const parsed = parsePaperInput(input)
  if (!parsed) {
    throw new Error('无法识别论文链接或 DOI，请检查输入格式')
  }

  if (parsed.kind === 'pdf-url') {
    return paperFromPdfUrl(parsed.id)
  }

  if (parsed.kind === 'doi') {
    const fromOa = await fetchOpenAlexByDoi(fetchFn, parsed.id)
    if (fromOa) return fromOa
    const fromId = await getPaperById(fetchFn, `DOI:${parsed.id}`, s2ApiKey)
    if (fromId) return fromId
    const fromDoi = await getPaperById(fetchFn, parsed.id, s2ApiKey)
    if (fromDoi) return fromDoi
    throw new Error(`未找到 DOI 对应的论文：${parsed.id}`)
  }

  if (parsed.kind === 'arxiv') {
    const fromOa = await fetchOpenAlexByArxiv(fetchFn, parsed.id)
    if (fromOa) return fromOa
    const fromS2 = await getPaperById(fetchFn, `arXiv:${parsed.id}`, s2ApiKey)
    if (fromS2) return fromS2
    throw new Error(`未找到 arXiv 论文：${parsed.id}`)
  }

  if (parsed.kind === 'pmid') {
    const fromOa = await fetchOpenAlexByPmid(fetchFn, parsed.id)
    if (fromOa) return fromOa
    throw new Error(`未找到 PubMed 论文：${parsed.id}`)
  }

  if (parsed.kind === 'openalex') {
    const paper = await getPaperById(fetchFn, parsed.id, s2ApiKey)
    if (paper) return paper
    throw new Error(`未找到 OpenAlex 论文：${parsed.id}`)
  }

  if (parsed.kind === 's2') {
    const paper = await getPaperById(fetchFn, parsed.id, s2ApiKey)
    if (paper) return paper
    throw new Error(`未找到 Semantic Scholar 论文：${parsed.id}`)
  }

  throw new Error('无法解析论文输入')
}
