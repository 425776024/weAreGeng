#!/usr/bin/env node
/**
 * WeAreGeng MCP Server — stdio transport (@mastra/mcp MCPServer)
 */
import { MCPServer } from '@mastra/mcp'
import { buildMastraTools, mergeToolRecords } from '../tools/mastra-tools'
import { buildMcpToolDeps } from './runtime.js'
import { connectSemanticScholarMcp } from './client.js'
import { DEFAULT_SEMANTIC_SCHOLAR_MCP } from './config.js'
import { MCP_SERVER_INFO } from './server.js'

async function main() {
  const deps = buildMcpToolDeps()
  let tools = buildMastraTools(deps)

  const s2Enabled =
    process.env.WEAREGENG_MCP_S2_ENABLED === '1' ||
    process.env.WEAREGENG_SEMANTIC_SCHOLAR_MCP === '1'

  if (s2Enabled) {
    const external = await connectSemanticScholarMcp({
      ...DEFAULT_SEMANTIC_SCHOLAR_MCP,
      enabled: true,
      apiKey: process.env.WEAREGENG_S2_API_KEY,
    })
    if (Object.keys(external.errors).length) {
      console.error('[we-are-geng-mcp] external MCP errors:', external.errors)
    }
    tools = mergeToolRecords(tools, external.tools)
  }

  const server = new MCPServer({
    name: MCP_SERVER_INFO.name,
    version: MCP_SERVER_INFO.version,
    tools,
  })

  await server.startStdio()
}

main().catch((err) => {
  console.error('[we-are-geng-mcp]', err)
  process.exit(1)
})
