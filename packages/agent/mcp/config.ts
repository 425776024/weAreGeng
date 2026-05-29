export interface SemanticScholarMcpConfig {
  enabled?: boolean
  /** npx package name, default @yogsoth-ai/semantic-scholar-mcp */
  packageName?: string
  apiKey?: string
  timeoutMs?: number
}

export const DEFAULT_SEMANTIC_SCHOLAR_MCP: SemanticScholarMcpConfig = {
  enabled: false,
  packageName: '@yogsoth-ai/semantic-scholar-mcp',
  timeoutMs: 60_000,
}
