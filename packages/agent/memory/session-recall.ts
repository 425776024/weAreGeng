import type { AgentToolDeps } from '../tools/deps'
import { createAcademicMemory, type AcademicMemoryLlmConfig } from './academic-memory'

export interface SessionMemoryHit {
  sessionId: string
  sessionTitle?: string
  role: string
  content: string
  createdAt: string
  score?: number
  source: 'keyword' | 'semantic'
}

function mergeHits(keyword: SessionMemoryHit[], semantic: SessionMemoryHit[], limit: number) {
  const seen = new Set<string>()
  const merged: SessionMemoryHit[] = []

  for (const hit of [...semantic, ...keyword]) {
    const key = `${hit.sessionId}:${hit.content.slice(0, 80)}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(hit)
    if (merged.length >= limit) break
  }

  return merged
}

/** 混合关键词（SQLite）+ 语义（Mastra Memory）检索会话记忆。 */
export async function recallSessionMemory(options: {
  query: string
  sessionId?: string
  limit?: number
  memoryDbPath?: string
  llm?: AcademicMemoryLlmConfig
  keywordSearch?: AgentToolDeps['recallMemory']
}): Promise<SessionMemoryHit[]> {
  const limit = options.limit ?? 10
  const keywordHits: SessionMemoryHit[] = []

  if (options.keywordSearch) {
    const rows = await options.keywordSearch(options.query, {
      sessionId: options.sessionId,
      limit,
    })
    keywordHits.push(
      ...rows.map((r) => ({
        sessionId: r.sessionId,
        sessionTitle: r.sessionTitle,
        role: r.role,
        content: r.content,
        createdAt: r.createdAt,
        source: 'keyword' as const,
      })),
    )
  }

  if (!options.memoryDbPath || !options.llm?.apiKey) {
    return keywordHits.slice(0, limit)
  }

  try {
    const memory = await createAcademicMemory(options.memoryDbPath, options.llm)
    if (!memory) return keywordHits.slice(0, limit)

    const semantic = await memory.searchMessages({
      query: options.query,
      resourceId: 'wearegeng-desktop',
      topK: limit,
      filter: options.sessionId ? { threadId: options.sessionId } : undefined,
    })

    const semanticHits: SessionMemoryHit[] = semantic.results
      .filter((r) => r.text)
      .map((r) => ({
        sessionId: r.threadId,
        role: 'assistant',
        content: r.text ?? '',
        createdAt: r.observedAt?.toISOString() ?? new Date().toISOString(),
        score: r.score,
        source: 'semantic' as const,
      }))

    return mergeHits(keywordHits, semanticHits, limit)
  } catch (err) {
    console.warn('[session-recall] semantic search failed:', err)
    return keywordHits.slice(0, limit)
  }
}
