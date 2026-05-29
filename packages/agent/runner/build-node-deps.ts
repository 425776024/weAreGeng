import { join } from 'node:path'
import type { SourcesConfig } from '../types'
import type { AgentToolDeps } from '../tools/deps'
import type { LlmChatFn } from '../services/analyzer'
import { searchExpertsOnDisk } from '../services/experts-node'
import { recallSessionMemory } from '../memory/session-recall'
import type { WorkerLlmConfig, WorkerSearchConfig } from './protocol'
import { pacedFetch } from '../utils/api-pacing'
import { buildLlmAuthHeaders } from '../models/llm-auth'

export type ToolProxyFn = (tool: string, args: Record<string, unknown>) => Promise<unknown>

export interface BuildNodeDepsOptions {
  projectRoot: string
  dataDir: string
  llm: WorkerLlmConfig
  search: WorkerSearchConfig
  sources?: Partial<SourcesConfig>
  sessionId?: string
  memoryDbPath?: string
  proxyTool: ToolProxyFn
}

const rawNodeFetch = async (url: string, init?: RequestInit) => fetch(url, init)
/** 外网学术 API 调用带最小间隔，降低 429 */
export const nodeFetch = pacedFetch(rawNodeFetch)

function createNodeLlmChat(llm: WorkerLlmConfig): LlmChatFn {
  const baseUrl = llm.baseUrl.replace(/\/$/, '')
  return async (opts) => {
    if (!llm.apiKey) {
      throw new Error('请先在设置页配置 LLM API Key')
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

/** Tauri Node 子进程：所有本地 I/O 与联网搜索经 Rust proxy 转发。 */
export function buildNodeAgentDeps(opts: BuildNodeDepsOptions): AgentToolDeps {
  process.env.WEAREGENG_DATA_DIR = opts.dataDir
  const proxy = opts.proxyTool

  const keywordRecall = async (query: string, options?: { sessionId?: string; limit?: number }) => {
    const res = (await proxy('recall_memory', {
      query,
      sessionId: options?.sessionId,
      limit: options?.limit,
    })) as {
      memories: Array<{
        sessionId: string
        sessionTitle?: string
        role: string
        content: string
        createdAt: string
      }>
    }
    return (res.memories ?? []).map((m) => ({
      sessionId: m.sessionId,
      sessionTitle: m.sessionTitle,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }))
  }

  return {
    fetch: nodeFetch,
    llmChat: createNodeLlmChat(opts.llm),
    sources: opts.sources,
    s2ApiKey: opts.search.apiKey || undefined,
    sessionId: opts.sessionId,
    searchExperts: (name) =>
      searchExpertsOnDisk(name) as unknown as Array<Record<string, unknown>>,
    readPdf: async (path) => {
      const res = (await proxy('read_local_pdf', { path })) as {
        pages: number
        text: string
        truncated: boolean
      }
      return res
    },
    readLocalFile: async (path) => {
      const res = (await proxy('read_local_file', { path })) as { content: string }
      return { content: res.content, truncated: res.content.length > 12_000 }
    },
    listAnalyses: async (limit = 10) => {
      const res = (await proxy('recall_analyses', { limit })) as {
        analyses: Array<Record<string, unknown>>
      }
      return res.analyses ?? []
    },
    recallMemory: async (query, options) => {
      const hits = await recallSessionMemory({
        query,
        sessionId: options?.sessionId ?? opts.sessionId,
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
    },
    saveAnalysis: async (input) => {
      const res = (await proxy('save_analysis', {
        paperId: input.paperId,
        paperJson: JSON.stringify(input.paper),
        summary: input.summary,
        score: input.score,
        flagsJson: JSON.stringify(input.flags ?? []),
        fullText: input.fullText,
      })) as { ok: boolean; id?: string }
      return res
    },
    webSearch: opts.search.enabled
      ? async (query) => {
          const res = (await proxy('web_search', { query, limit: 8 })) as {
            results: Array<{ title: string; url: string; snippet: string }>
          }
          return res.results ?? []
        }
      : undefined,
  }
}

export function resolveDataDir(projectRoot: string, override?: string): string {
  return override ?? join(projectRoot, 'data', 'experts')
}
