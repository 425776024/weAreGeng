import type { ToolsInput } from '@mastra/core/agent'
import type { SemanticScholarMcpConfig } from './config'
import { DEFAULT_SEMANTIC_SCHOLAR_MCP } from './config'

export interface ExternalMcpLoadResult {
  tools: ToolsInput
  errors: Record<string, string>
  skippedReason?: string
}

let activeClient: { disconnect: () => Promise<void> } | null = null

export async function connectSemanticScholarMcp(
  config: SemanticScholarMcpConfig = DEFAULT_SEMANTIC_SCHOLAR_MCP,
): Promise<ExternalMcpLoadResult> {
  if (!config.enabled) {
    return { tools: {}, errors: {}, skippedReason: 'MCP Client 未启用' }
  }

  const { MCPClient } = await import('@mastra/mcp')

  const env: Record<string, string> = {}
  if (config.apiKey) {
    env.SS_API_KEY = config.apiKey
  }

  const mcp = new MCPClient({
    id: 'wearegeng-semantic-scholar',
    timeout: config.timeoutMs ?? DEFAULT_SEMANTIC_SCHOLAR_MCP.timeoutMs,
    servers: {
      'semantic-scholar': {
        command: 'npx',
        args: ['-y', config.packageName ?? DEFAULT_SEMANTIC_SCHOLAR_MCP.packageName!],
        env,
      },
    },
  })
  activeClient = mcp

  const { toolsets, errors } = await mcp.listToolsetsWithErrors()
  const tools: ToolsInput = {}

  for (const [serverName, serverTools] of Object.entries(toolsets)) {
    for (const [toolName, tool] of Object.entries(serverTools)) {
      tools[`${serverName}_${toolName}`] = tool
    }
  }

  return { tools, errors }
}

export async function disconnectSemanticScholarMcp(): Promise<void> {
  if (activeClient) {
    await activeClient.disconnect()
    activeClient = null
  }
}

/** 在 Node Agent 子进程中加载外部 MCP Tool。 */
export async function loadExternalMcpTools(
  config?: SemanticScholarMcpConfig,
): Promise<ExternalMcpLoadResult> {
  const cfg = { ...DEFAULT_SEMANTIC_SCHOLAR_MCP, ...config }

  if (!cfg.enabled) {
    return { tools: {}, errors: {} }
  }

  return connectSemanticScholarMcp(cfg)
}
