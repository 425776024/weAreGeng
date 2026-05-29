import type { AgentMessage, AgentRunResult } from '../agents/types'
import type { SourcesConfig } from '../types'

export interface WorkerLlmConfig {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
}

export interface WorkerSearchConfig {
  enabled: boolean
  provider: string
  apiKey: string
}

export interface WorkerMcpConfig {
  semanticScholarEnabled: boolean
}

export interface WorkerInitPayload {
  type: 'init'
  projectRoot: string
  dataDir: string
  memoryDbPath?: string
  config: {
    llm: WorkerLlmConfig
    search: WorkerSearchConfig
    sources: SourcesConfig
    mcp?: WorkerMcpConfig
  }
  mcpS2Enabled?: boolean
}

export interface WorkerRunPayload {
  type: 'run'
  id: string
  userInput: string
  history: AgentMessage[]
  sessionId?: string
}

export interface WorkerInvestigatePayload {
  type: 'investigate'
  id: string
  name: string
  university?: string
  maxPapers?: number
}

export interface WorkerProxyResultPayload {
  type: 'proxy_result'
  requestId: string
  ok: boolean
  result?: unknown
  error?: string
}

export type WorkerInbound =
  | WorkerInitPayload
  | WorkerRunPayload
  | WorkerInvestigatePayload
  | WorkerProxyResultPayload

export interface WorkerReadyEvent {
  type: 'ready'
}

export interface WorkerChunkEvent {
  type: 'chunk'
  id: string
  delta: string
}

export interface WorkerDoneEvent {
  type: 'done'
  id: string
  result: AgentRunResult
}

export interface WorkerErrorEvent {
  type: 'error'
  id?: string
  message: string
}

export interface WorkerProxyEvent {
  type: 'proxy'
  requestId: string
  tool: string
  args: Record<string, unknown>
}

export interface WorkerInvestigateStepEvent {
  type: 'investigate_step'
  id: string
  stepId: string
  label: string
  status: string
  detail?: string
}

export interface WorkerInvestigatePartialEvent {
  type: 'investigate_partial'
  id: string
  patch: Record<string, unknown>
}

export interface WorkerInvestigateDoneEvent {
  type: 'investigate_done'
  id: string
  report: unknown
}

export type WorkerOutbound =
  | WorkerReadyEvent
  | WorkerChunkEvent
  | WorkerDoneEvent
  | WorkerErrorEvent
  | WorkerProxyEvent
  | WorkerInvestigateStepEvent
  | WorkerInvestigatePartialEvent
  | WorkerInvestigateDoneEvent

export function encodeLine(message: WorkerInbound | WorkerOutbound): string {
  return `${JSON.stringify(message)}\n`
}
