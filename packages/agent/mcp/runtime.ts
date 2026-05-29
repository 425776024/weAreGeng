import type { AgentToolDeps } from '../tools/deps'
import { buildMastraTools } from '../tools/mastra-tools'
import { runMastraAcademicAgent } from '../agents/mastra-agent'
import { createAgentLanguageModel } from '../models/resolve-llm'
import { DEFAULT_SOURCES } from '../types'
import { buildMcpAgentDeps, resolveMcpDataDir } from './build-deps'
import { connectSemanticScholarMcp } from './client'
import { DEFAULT_SEMANTIC_SCHOLAR_MCP } from './config'

function envLlm() {
  return {
    baseUrl: process.env.WEAREGENG_LLM_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: process.env.WEAREGENG_LLM_API_KEY ?? '',
    model: process.env.WEAREGENG_LLM_MODEL ?? 'gpt-4o-mini',
    temperature: Number(process.env.WEAREGENG_LLM_TEMPERATURE ?? '0.2'),
  }
}

function envSearch() {
  return {
    enabled: process.env.WEAREGENG_SEARCH_ENABLED !== '0',
    provider: process.env.WEAREGENG_SEARCH_PROVIDER ?? 'duckduckgo',
    apiKey: process.env.WEAREGENG_SEARCH_API_KEY ?? '',
  }
}

/** MCP stdio 子进程 Tool deps（Cursor 等外部客户端接入，与 Tauri 应用共用数据目录）。 */
export function buildMcpToolDeps(): AgentToolDeps {
  const projectRoot = process.env.WEAREGENG_PROJECT_ROOT ?? process.cwd()
  const dataDir = process.env.WEAREGENG_DATA_DIR ?? resolveMcpDataDir(projectRoot)
  const llm = envLlm()

  return buildMcpAgentDeps({
    projectRoot,
    dataDir,
    llm,
    search: envSearch(),
    sources: DEFAULT_SOURCES,
    memoryDbPath: process.env.WEAREGENG_MEMORY_DB_PATH,
  })
}

export function getMcpTools() {
  return buildMastraTools(buildMcpToolDeps())
}

export async function runNodeAcademicAgent(prompt: string) {
  const deps = buildMcpToolDeps()
  const llm = envLlm()
  const model = createAgentLanguageModel({
    baseUrl: llm.baseUrl,
    apiKey: llm.apiKey,
    model: llm.model,
  })

  const mcpEnabled =
    process.env.WEAREGENG_MCP_S2_ENABLED === '1' ||
    process.env.WEAREGENG_SEMANTIC_SCHOLAR_MCP === '1'
  const external = mcpEnabled
    ? await connectSemanticScholarMcp({
        ...DEFAULT_SEMANTIC_SCHOLAR_MCP,
        enabled: true,
        apiKey: process.env.WEAREGENG_S2_API_KEY,
      })
    : { tools: {}, errors: {} }

  return runMastraAcademicAgent(prompt, [], {
    model,
    deps,
    externalTools: external.tools,
    memoryDbPath: process.env.WEAREGENG_MEMORY_DB_PATH,
    memoryLlm: llm.apiKey ? { baseUrl: llm.baseUrl, apiKey: llm.apiKey } : undefined,
  })
}
