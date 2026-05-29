import { invoke } from '@tauri-apps/api/core'

export interface LlmToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface LlmChatResult {
  content: string
  toolCalls?: LlmToolCall[]
  finishReason?: string
}

export async function llmChat(options: {
  messages: Array<Record<string, unknown>>
  maxTokens?: number
  jsonMode?: boolean
  tools?: unknown[]
}): Promise<LlmChatResult> {
  const res = await invoke<{
    content: string
    toolCalls?: LlmToolCall[]
    finishReason?: string
  }>('llm_chat', {
    request: {
      messages: options.messages,
      maxTokens: options.maxTokens ?? 2048,
      responseFormat: options.jsonMode ? { type: 'json_object' } : undefined,
      tools: options.tools?.length ? options.tools : undefined,
    },
  })
  return {
    content: res.content,
    toolCalls: res.toolCalls as LlmToolCall[] | undefined,
    finishReason: res.finishReason,
  }
}

export async function llmChatText(options: {
  messages: Array<{ role: string; content: string }>
  maxTokens?: number
  jsonMode?: boolean
}): Promise<string> {
  const res = await llmChat({ ...options, messages: options.messages })
  return res.content
}
