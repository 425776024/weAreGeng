export * from './types'
export { searchPapers } from './services/paper-search'
export { analyzePaperWithLlm, analyzePapersBatch } from './services/analyzer'
export { buildAgentTools, toOpenAiTools, executeTool } from './tools'
export { buildMastraTools, mergeToolRecords } from './tools/mastra-tools'
export type { AgentMessage, AgentRunResult } from './agents/types'
export { runMastraAcademicAgent } from './agents/mastra-agent'
export { searchAuthors } from './services/paper-search/authors'
export { investigatePerson } from './services/investigate-person'
export type { PersonInvestigationReport } from './services/person-analyzer'
export { createAcademicMemory } from './memory/academic-memory'
export { createAgentLanguageModel } from './models/resolve-llm'
export {
  connectSemanticScholarMcp,
  loadExternalMcpTools,
  disconnectSemanticScholarMcp,
} from './mcp/client'
export { DEFAULT_SEMANTIC_SCHOLAR_MCP } from './mcp/config'
export { MCP_SERVER_INFO, MCP_CURSOR_CONFIG } from './mcp/server'
