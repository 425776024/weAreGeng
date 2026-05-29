export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCallId?: string
  name?: string
  toolCalls?: string
  toolResults?: string
}

export interface AgentRunResult {
  messages: AgentMessage[]
  finalAnswer: string
}
