import { Agent } from '@mastra/core/agent'
import type { ToolsInput } from '@mastra/core/agent'
import type { MessageListInput } from '@mastra/core/agent/message-list'
import type { MastraModelConfig } from '@mastra/core/llm'
import type { Memory } from '@mastra/memory'
import type { AgentToolDeps } from '../tools/deps'
import { buildMastraTools, mergeToolRecords } from '../tools/mastra-tools'
import { createAcademicMemory } from '../memory/academic-memory'
import type { AgentMessage, AgentRunResult } from './types'
import { SYSTEM_PROMPT } from './shared'

export type { AgentMessage, AgentRunResult }

export interface MastraAgentRunOptions {
  model: MastraModelConfig
  deps: AgentToolDeps
  externalTools?: ToolsInput
  sessionId?: string
  memoryDbPath?: string
  memoryLlm?: { baseUrl: string; apiKey: string }
  onStream?: (delta: string) => void
}

function buildAgent(model: MastraModelConfig, tools: ToolsInput, memory?: Memory) {
  return new Agent({
    id: 'academic-agent',
    name: 'WeAreGeng Academic Agent',
    instructions: SYSTEM_PROMPT,
    model,
    tools,
    ...(memory ? { memory } : {}),
  })
}

function toMastraMessages(history: AgentMessage[], userInput: string) {
  const prior = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  return [...prior, { role: 'user' as const, content: userInput }]
}

function buildTraceFromOutput(
  history: AgentMessage[],
  userInput: string,
  output: {
    text: string
    steps?: Array<{
      toolCalls?: Array<{ toolName?: string; payload?: { toolName?: string } }>
      toolResults?: Array<{ toolName?: string; result?: unknown; output?: unknown }>
    }>
  },
): AgentMessage[] {
  const trace: AgentMessage[] = [...history, { role: 'user', content: userInput }]

  for (const step of output.steps ?? []) {
    for (const call of step.toolCalls ?? []) {
      const name = call.toolName ?? call.payload?.toolName ?? 'tool'
      trace.push({ role: 'assistant', content: `[调用 ${name}]` })
    }
    for (const result of step.toolResults ?? []) {
      const name = result.toolName ?? 'tool'
      const payload = result.result ?? result.output
      const content =
        typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}).slice(0, 800)
      trace.push({ role: 'tool', content, name })
    }
  }

  trace.push({ role: 'assistant', content: output.text || '（无回复）' })
  return trace
}

function buildRunOptions(options: MastraAgentRunOptions, useMastraMemory: boolean) {
  const base = { maxSteps: 16 as const }
  if (!useMastraMemory || !options.sessionId) return base
  return {
    ...base,
    memory: {
      thread: options.sessionId,
      resource: 'wearegeng-desktop',
    },
  }
}

/** Node.js 编排：Mastra Agent + createTool + Memory + 可选 MCP 外部 Tool */
export async function runMastraAcademicAgent(
  userInput: string,
  history: AgentMessage[] = [],
  options: MastraAgentRunOptions,
): Promise<AgentRunResult> {
  const localTools = buildMastraTools(options.deps)
  const tools = mergeToolRecords(localTools, options.externalTools)
  const memory = options.memoryDbPath
    ? await createAcademicMemory(options.memoryDbPath, options.memoryLlm)
    : undefined
  const agent = buildAgent(options.model, tools, memory)
  const useMastraMemory = Boolean(memory && options.sessionId)
  const messages = (
    useMastraMemory
      ? [{ role: 'user' as const, content: userInput }]
      : toMastraMessages(history, userInput)
  ) as MessageListInput
  const runOptions = buildRunOptions(options, useMastraMemory)

  if (options.onStream) {
    const stream = await agent.stream(messages, runOptions)
    const reader = stream.textStream.getReader()
    let streamed = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        streamed += value
        options.onStream(value)
      }
    }
    const full = await stream.getFullOutput()
    const answer = full.text || streamed || '（无回复）'
    return {
      messages: buildTraceFromOutput(history, userInput, {
        text: answer,
        steps: full.steps as Parameters<typeof buildTraceFromOutput>[2]['steps'],
      }),
      finalAnswer: answer,
    }
  }

  const output = await agent.generate(messages, runOptions)
  const answer = output.text || '（无回复）'
  return {
    messages: buildTraceFromOutput(history, userInput, {
      text: answer,
      steps: output.steps as Parameters<typeof buildTraceFromOutput>[2]['steps'],
    }),
    finalAnswer: answer,
  }
}
