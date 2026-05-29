import type { AgentToolDeps } from './deps'
import { ACADEMIC_TOOL_SPECS, parseToolInput, toolParameters } from './registry'

export type { AgentToolDeps, MemoryHit } from './deps'

export interface AgentToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

export function buildAgentTools(deps: AgentToolDeps): AgentToolDefinition[] {
  return ACADEMIC_TOOL_SPECS.map((spec) => ({
    name: spec.name,
    description: spec.description,
    parameters: toolParameters(spec),
    execute: async (args) => spec.execute(parseToolInput(spec, args), deps),
  }))
}

export function toOpenAiTools(tools: AgentToolDefinition[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

export async function executeTool(
  tools: AgentToolDefinition[],
  name: string,
  argsJson: string,
): Promise<string> {
  const tool = tools.find((t) => t.name === name)
  if (!tool) return JSON.stringify({ error: `未知工具: ${name}` })
  try {
    const args = JSON.parse(argsJson || '{}') as Record<string, unknown>
    const result = await tool.execute(args)
    return JSON.stringify(result)
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
  }
}
