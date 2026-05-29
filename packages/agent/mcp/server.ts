/**
 * WeAreGeng MCP Server
 *
 * Cursor / Claude Desktop 配置示例见 MCP_CURSOR_CONFIG
 */

export const MCP_SERVER_INFO = {
  name: 'we-are-geng',
  version: '0.1.0',
  tools: [
    'search_papers',
    'get_paper',
    'get_citations',
    'analyze_paper',
    'search_experts',
    'recall_analyses',
    'recall_memory',
    'save_analysis',
    'web_search',
    'read_local_pdf',
    'read_local_file',
  ],
} as const

export const MCP_CURSOR_CONFIG = {
  mcpServers: {
    'we-are-geng': {
      command: 'npm',
      args: ['run', 'mcp:server'],
      cwd: '${workspaceFolder}',
      env: {
        WEAREGENG_LLM_API_KEY: '${env:WEAREGENG_LLM_API_KEY}',
        WEAREGENG_LLM_BASE_URL: 'https://api.openai.com/v1',
        WEAREGENG_LLM_MODEL: 'gpt-4o-mini',
      },
    },
  },
}
