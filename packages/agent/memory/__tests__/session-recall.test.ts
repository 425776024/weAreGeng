import { describe, expect, it, vi } from 'vitest'
import { recallSessionMemory } from '../session-recall'

describe('recallSessionMemory', () => {
  it('merges semantic hits before keyword hits without duplicates', async () => {
    const keywordSearch = vi.fn().mockResolvedValue([
      {
        sessionId: 's1',
        role: 'user',
        content: '深度学习论文',
        createdAt: '2026-01-01',
      },
    ])

    const result = await recallSessionMemory({
      query: '深度学习',
      keywordSearch,
      limit: 5,
    })

    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('keyword')
    expect(keywordSearch).toHaveBeenCalledWith('深度学习', expect.any(Object))
  })
})
