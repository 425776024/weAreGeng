import { createTool } from '@mastra/core/tools'
import type { ToolsInput } from '@mastra/core/agent'
import type { AgentToolDeps } from './deps'
import { ACADEMIC_TOOL_SPECS } from './registry'

export function buildMastraTools(deps: AgentToolDeps): ToolsInput {
  const tools: ToolsInput = {}
  for (const spec of ACADEMIC_TOOL_SPECS) {
    tools[spec.name] = createTool({
      id: spec.name,
      description: spec.description,
      inputSchema: spec.schema,
      execute: async (input) => spec.execute(input as Record<string, unknown>, deps),
    })
  }
  return tools
}

export function mergeToolRecords(local: ToolsInput, external?: ToolsInput): ToolsInput {
  if (!external || Object.keys(external).length === 0) return local
  return { ...local, ...external }
}
