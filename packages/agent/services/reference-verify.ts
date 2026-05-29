import type { FetchFn, Paper } from '../types'
import { getPaperById } from './paper-search/citations'

export interface ReferenceCheckItem {
  citedTitle?: string
  citedId?: string
  found: boolean
  resolvedTitle?: string
  issue?: string
}

export interface ReferenceCheckResult {
  paperId: string
  paperTitle: string
  totalChecked: number
  missingCount: number
  items: ReferenceCheckItem[]
  summary: string
}

/** 抽查论文参考文献是否可解析（不存在/无法检索视为可疑） */
export async function verifyPaperReferences(
  fetchFn: FetchFn,
  paper: Paper,
  references: Paper[],
  s2ApiKey?: string,
): Promise<ReferenceCheckResult> {
  const items: ReferenceCheckItem[] = []
  let missingCount = 0

  for (const ref of references.slice(0, 12)) {
    if (!ref.title || ref.title.length < 4) {
      items.push({
        citedTitle: ref.title,
        citedId: ref.id,
        found: false,
        issue: '参考文献标题缺失或过短',
      })
      missingCount++
      continue
    }

    // 已在引用链中返回的视为存在
    if (ref.id && ref.source) {
      items.push({
        citedTitle: ref.title,
        citedId: ref.id,
        found: true,
        resolvedTitle: ref.title,
      })
      continue
    }

    // 尝试 DOI / ID 二次解析
    let found = false
    let resolvedTitle: string | undefined
    if (ref.doi || ref.id) {
      const resolved = await getPaperById(fetchFn, ref.doi ?? ref.id, s2ApiKey).catch(() => null)
      if (resolved?.title) {
        found = true
        resolvedTitle = resolved.title
      }
    }

    if (!found) {
      missingCount++
      items.push({
        citedTitle: ref.title,
        citedId: ref.id,
        found: false,
        issue: '无法在 OpenAlex/S2 检索到该参考文献',
      })
    } else {
      items.push({
        citedTitle: ref.title,
        citedId: ref.id,
        found: true,
        resolvedTitle,
      })
    }
  }

  const summary =
    missingCount === 0
      ? `已检查 ${items.length} 条参考文献，均可检索到。`
      : `${items.length} 条参考文献中有 ${missingCount} 条无法验证或可能不存在，需人工复核。`

  return {
    paperId: paper.id,
    paperTitle: paper.title,
    totalChecked: items.length,
    missingCount,
    items,
    summary,
  }
}
