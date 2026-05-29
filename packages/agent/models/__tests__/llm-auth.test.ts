import { describe, expect, it } from 'vitest'
import { buildLlmAuthHeaders, usesMimoApiKeyAuth } from '../llm-auth'

describe('llm-auth', () => {
  it('detects MiMo Token Plan credentials', () => {
    expect(
      usesMimoApiKeyAuth('https://token-plan-cn.xiaomimimo.com/v1', 'tp-abc'),
    ).toBe(true)
    expect(usesMimoApiKeyAuth('https://api.openai.com/v1', 'sk-abc')).toBe(false)
  })

  it('uses api-key header for MiMo', () => {
    expect(
      buildLlmAuthHeaders('https://token-plan-cn.xiaomimimo.com/v1', 'tp-abc'),
    ).toEqual({ 'api-key': 'tp-abc' })
  })

  it('uses Bearer auth for OpenAI-compatible providers', () => {
    expect(buildLlmAuthHeaders('https://api.openai.com/v1', 'sk-abc')).toEqual({
      Authorization: 'Bearer sk-abc',
    })
  })
})
