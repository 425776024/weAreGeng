import { createOpenAI } from '@ai-sdk/openai'
import type { MastraModelConfig } from '@mastra/core/llm'
import { buildLlmAuthHeaders, usesMimoApiKeyAuth } from './llm-auth'

export interface AgentLlmConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export function createAgentLanguageModel(config: AgentLlmConfig): MastraModelConfig {
  if (!config.apiKey) {
    throw new Error('请先在设置页配置 LLM API Key')
  }

  const baseURL = config.baseUrl.replace(/\/$/, '')
  const isMimo = usesMimoApiKeyAuth(baseURL, config.apiKey)
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL,
    headers: isMimo ? buildLlmAuthHeaders(baseURL, config.apiKey) : undefined,
    fetch: isMimo
      ? async (url, init) => {
          const headers = new Headers(init?.headers)
          headers.delete('authorization')
          headers.set('api-key', config.apiKey)
          return fetch(url, { ...init, headers })
        }
      : undefined,
  })
  return openai(config.model) as MastraModelConfig
}
