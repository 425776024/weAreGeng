import type { Paper } from '../types'
import type { WebSearchResult } from './web-search'

export interface OpensourceClaim {
  claim: string
  source: 'abstract' | 'title' | 'web'
  keywords: string[]
}

export interface OpensourceCheckItem {
  claim: string
  repoHints: string[]
  webHits: WebSearchResult[]
  verified: boolean
  confidence: 'high' | 'medium' | 'low'
  note: string
}

export interface OpensourceCheckResult {
  paperId: string
  paperTitle: string
  items: OpensourceCheckItem[]
  summary: string
}

const OSS_PATTERNS = [
  /开源/g,
  /open[\s-]?source/gi,
  /github\.com\/[\w.-]+\/[\w.-]+/gi,
  /gitlab\.com\/[\w.-]+\/[\w.-]+/gi,
  /code available/gi,
  /source code/gi,
  /repository/gi,
  /我们(?:已)?(?:公开|发布|上传)/g,
]

function extractRepoHints(text: string): string[] {
  const hints = new Set<string>()
  const urlMatch = text.match(/https?:\/\/(?:github|gitlab)\.com\/[^\s)]+/gi)
  for (const u of urlMatch ?? []) hints.add(u)
  const nameMatch = text.match(/(?:github|GitHub)[:\s]+([\w.-]+\/[\w.-]+)/g)
  for (const m of nameMatch ?? []) {
    const repo = m.split(/[:\s]+/).pop()
    if (repo) hints.add(`https://github.com/${repo}`)
  }
  return [...hints]
}

export function extractOpensourceClaims(paper: Paper): OpensourceClaim[] {
  const text = `${paper.title}\n${paper.abstract ?? ''}`
  const claims: OpensourceClaim[] = []

  for (const pattern of OSS_PATTERNS) {
    if (pattern.test(text)) {
      claims.push({
        claim: text.slice(0, 200),
        source: 'abstract',
        keywords: ['开源', 'open source', 'github', 'code'],
      })
      break
    }
  }

  return claims
}

function repoLooksValid(hit: WebSearchResult): boolean {
  const u = hit.url.toLowerCase()
  return u.includes('github.com') || u.includes('gitlab.com') || u.includes('gitee.com')
}

/** 根据摘要声称 + 联网结果，判断「说开源但找不到仓库」 */
export function verifyOpensourceClaims(
  paper: Paper,
  webResults: WebSearchResult[],
): OpensourceCheckResult {
  const claims = extractOpensourceClaims(paper)
  const items: OpensourceCheckItem[] = []

  if (!claims.length) {
    return {
      paperId: paper.id,
      paperTitle: paper.title,
      items: [],
      summary: '摘要/标题中未检测到明确的开源声称。',
    }
  }

  const repoHits = webResults.filter(repoLooksValid)
  const repoHints = extractRepoHints(`${paper.abstract} ${webResults.map((r) => r.snippet).join(' ')}`)

  for (const claim of claims) {
    const verified = repoHits.length > 0 || repoHints.length > 0
    items.push({
      claim: claim.claim.slice(0, 300),
      repoHints,
      webHits: repoHits.slice(0, 5),
      verified,
      confidence: verified ? (repoHints.length ? 'high' : 'medium') : 'high',
      note: verified
        ? `找到 ${repoHits.length} 条疑似代码仓库链接`
        : '论文声称开源/公开代码，但联网检索未找到 GitHub/GitLab 等仓库，高度可疑',
    })
  }

  const unverified = items.filter((i) => !i.verified).length
  const summary =
    unverified === 0
      ? '开源声称与联网检索结果基本一致。'
      : `${items.length} 条开源相关声称中，${unverified} 条未找到可验证的公开仓库。`

  return {
    paperId: paper.id,
    paperTitle: paper.title,
    items,
    summary,
  }
}
