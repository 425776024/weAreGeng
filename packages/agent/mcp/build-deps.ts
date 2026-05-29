import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import type { FetchFn, SourcesConfig } from '../types'
import type { AgentToolDeps } from '../tools/deps'
import type { LlmChatFn } from '../services/analyzer'
import { searchExpertsOnDisk } from '../services/experts-node'
import { webSearch } from '../services/web-search'
import { recallSessionMemory } from '../memory/session-recall'
import {
  listAnalysisRows,
  openDesktopDb,
  resolveDesktopDbPath,
  saveAnalysisRow,
  searchMessageRows,
} from '../services/desktop-db'
import { nodeFetch } from '../runner/build-node-deps'
import { buildLlmAuthHeaders } from '../models/llm-auth'
import type { WorkerLlmConfig, WorkerSearchConfig } from '../runner/protocol'

export interface BuildMcpDepsOptions {
  projectRoot: string
  dataDir: string
  llm: WorkerLlmConfig
  search: WorkerSearchConfig
  sources?: Partial<SourcesConfig>
  memoryDbPath?: string
}

function createNodeLlmChat(llm: WorkerLlmConfig): LlmChatFn {
  const baseUrl = llm.baseUrl.replace(/\/$/, '')
  return async (opts) => {
    if (!llm.apiKey) {
      throw new Error('请配置 WEAREGENG_LLM_API_KEY 或设置页 LLM API Key')
    }
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildLlmAuthHeaders(baseUrl, llm.apiKey),
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: llm.temperature,
        max_tokens: opts.maxTokens ?? 2048,
        messages: opts.messages,
        ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`LLM 请求失败 (${res.status}): ${body.slice(0, 300)}`)
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content ?? ''
    if (!content) throw new Error('LLM 返回为空')
    return { content }
  }
}

async function readPdfFromPath(path: string) {
  const { PDFParse } = await import('pdf-parse')
  const buffer = await readFile(path)
  const parser = new PDFParse({ data: buffer })
  try {
    const textResult = await parser.getText()
    const text = textResult.text ?? ''
    const maxChars = 100_000
    return {
      pages: textResult.pages?.length ?? 0,
      text: text.slice(0, maxChars),
      truncated: text.length > maxChars,
    }
  } finally {
    await parser.destroy()
  }
}

/** MCP stdio 子进程专用：直连本地文件 / SQLite（不经过 Tauri Rust proxy）。 */
export function buildMcpAgentDeps(opts: BuildMcpDepsOptions): AgentToolDeps {
  process.env.WEAREGENG_DATA_DIR = opts.dataDir

  const desktopDbPath = resolveDesktopDbPath()
  const keywordRecall = desktopDbPath
    ? async (query: string, options?: { sessionId?: string; limit?: number }) => {
        const db = openDesktopDb(desktopDbPath)
        return searchMessageRows(db, query, options?.sessionId, options?.limit ?? 10)
      }
    : undefined

  return {
    fetch: nodeFetch as FetchFn,
    llmChat: createNodeLlmChat(opts.llm),
    sources: opts.sources,
    s2ApiKey: opts.search.apiKey || undefined,
    searchExperts: (name) =>
      searchExpertsOnDisk(name) as unknown as Array<Record<string, unknown>>,
    readPdf: async (path) => readPdfFromPath(path),
    readLocalFile: async (path) => {
      const content = await readFile(path, 'utf8')
      const maxChars = 12_000
      return { content: content.slice(0, maxChars), truncated: content.length > maxChars }
    },
    listAnalyses: desktopDbPath
      ? async (limit = 10) => {
          const db = openDesktopDb(desktopDbPath)
          const rows = await listAnalysisRows(db, limit)
          return rows.map((r) => ({
            paperId: r.paperId,
            summary: r.summary,
            score: r.score,
            analyzedAt: r.analyzedAt,
          }))
        }
      : undefined,
    recallMemory: keywordRecall
      ? async (query, options) => {
          const hits = await recallSessionMemory({
            query,
            sessionId: options?.sessionId,
            limit: options?.limit,
            memoryDbPath: opts.memoryDbPath,
            llm: opts.llm.apiKey
              ? { baseUrl: opts.llm.baseUrl, apiKey: opts.llm.apiKey }
              : undefined,
            keywordSearch: keywordRecall,
          })
          return hits.map((h) => ({
            sessionId: h.sessionId,
            sessionTitle: h.sessionTitle,
            role: h.role,
            content: h.content,
            createdAt: h.createdAt,
            score: h.score,
            source: h.source,
          }))
        }
      : undefined,
    saveAnalysis: desktopDbPath
      ? async (input) => {
          const db = openDesktopDb(desktopDbPath)
          const id = `analysis-${Date.now()}`
          await saveAnalysisRow(db, {
            id,
            paperId: input.paperId,
            paperJson: JSON.stringify(input.paper),
            summary: input.summary,
            score: input.score,
            flagsJson: JSON.stringify(input.flags ?? []),
            analyzedAt: new Date().toISOString(),
            fullText: input.fullText,
          })
          return { ok: true, id }
        }
      : undefined,
    webSearch: opts.search.enabled
      ? async (query) =>
          webSearch(
            nodeFetch,
            {
              enabled: opts.search.enabled,
              provider: opts.search.provider,
              apiKey: opts.search.apiKey || undefined,
            },
            query,
          )
      : undefined,
  }
}

export function resolveMcpDataDir(projectRoot: string, override?: string): string {
  return override ?? join(projectRoot, 'data', 'experts')
}
