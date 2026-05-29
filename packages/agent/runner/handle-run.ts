import { createAgentLanguageModel } from '../models/resolve-llm'
import { runMastraAcademicAgent } from '../agents/mastra-agent'
import type { AgentMessage, AgentRunResult } from '../agents/types'
import { connectSemanticScholarMcp } from '../mcp/client'
import { DEFAULT_SEMANTIC_SCHOLAR_MCP } from '../mcp/config'
import { buildNodeAgentDeps, type ToolProxyFn } from './build-node-deps'
import type { WorkerInitPayload } from './protocol'

export interface RunWorkerAgentOptions {
  init: WorkerInitPayload
  userInput: string
  history: AgentMessage[]
  sessionId?: string
  proxyTool: ToolProxyFn
  onStream?: (delta: string) => void
}

export async function runWorkerAgent(options: RunWorkerAgentOptions): Promise<AgentRunResult> {
  const { init, userInput, history, proxyTool, onStream } = options
  const deps = buildNodeAgentDeps({
    projectRoot: init.projectRoot,
    dataDir: init.dataDir,
    llm: init.config.llm,
    search: init.config.search,
    sources: init.config.sources,
    sessionId: options.sessionId,
    memoryDbPath: init.memoryDbPath,
    proxyTool,
  })

  const model = createAgentLanguageModel({
    baseUrl: init.config.llm.baseUrl,
    apiKey: init.config.llm.apiKey,
    model: init.config.llm.model,
  })

  const external = init.mcpS2Enabled || init.config.mcp?.semanticScholarEnabled
    ? await connectSemanticScholarMcp({
        ...DEFAULT_SEMANTIC_SCHOLAR_MCP,
        enabled: true,
        apiKey: init.config.search.apiKey || undefined,
      })
    : { tools: {}, errors: {} }

  return runMastraAcademicAgent(userInput, history, {
    model,
    deps,
    externalTools: external.tools,
    sessionId: options.sessionId,
    memoryDbPath: init.memoryDbPath,
    memoryLlm: init.config.llm.apiKey
      ? { baseUrl: init.config.llm.baseUrl, apiKey: init.config.llm.apiKey }
      : undefined,
    onStream,
  })
}
