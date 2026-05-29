import type { Memory } from '@mastra/memory'
import { createOpenAI } from '@ai-sdk/openai'

const memoryCache = new Map<string, Promise<Memory | undefined>>()

export interface AcademicMemoryLlmConfig {
  baseUrl: string
  apiKey: string
}

function memoryCacheKey(dbPath: string, llm?: AcademicMemoryLlmConfig) {
  return `${dbPath}:${llm?.apiKey ? 'embed' : 'no-embed'}`
}

/**
 * Mastra Memory + LibSQL 持久化 + semanticRecall（Node Agent 专用）。
 */
export async function createAcademicMemory(
  dbPath: string,
  llm?: AcademicMemoryLlmConfig,
): Promise<Memory | undefined> {
  if (!dbPath) return undefined

  const key = memoryCacheKey(dbPath, llm)
  const cached = memoryCache.get(key)
  if (cached) return cached

  const promise = (async () => {
    try {
      const { Memory: MemoryClass } = await import('@mastra/memory')
      const { LibSQLStore, LibSQLVector } = await import('@mastra/libsql')
      const url = dbPath.startsWith('file:') ? dbPath : `file:${dbPath}`

      const storage = new LibSQLStore({
        id: 'wearegeng-academic-memory',
        url,
      })

      const hasEmbedder = Boolean(llm?.apiKey)
      let vector: InstanceType<typeof LibSQLVector> | undefined
      let embedder: ReturnType<ReturnType<typeof createOpenAI>['embedding']> | undefined

      if (hasEmbedder && llm) {
        const baseUrl = llm.baseUrl.replace(/\/$/, '')
        const openai = createOpenAI({ baseURL: baseUrl, apiKey: llm.apiKey })
        embedder = openai.embedding('text-embedding-3-small')
        vector = new LibSQLVector({
          id: 'wearegeng-academic-vector',
          url,
        })
      }

      return new MemoryClass({
        storage,
        ...(vector && embedder ? { vector, embedder } : {}),
        options: {
          lastMessages: 50,
          ...(vector && embedder
            ? {
                semanticRecall: {
                  topK: 5,
                  messageRange: 2,
                  scope: 'thread' as const,
                },
              }
            : {}),
        },
      })
    } catch (err) {
      console.error('[academic-memory] init failed:', err)
      return undefined
    }
  })()

  memoryCache.set(key, promise)
  return promise
}

export function resetAcademicMemoryCache() {
  memoryCache.clear()
}
