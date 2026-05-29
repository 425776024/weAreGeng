import { describe, expect, it, vi } from 'vitest'
import { parseRetryAfterMs, withRetryFetch } from '../retry-fetch'

describe('parseRetryAfterMs', () => {
  it('caps large Retry-After seconds', () => {
    const res = new Response(null, { status: 429, headers: { 'Retry-After': '33448' } })
    expect(parseRetryAfterMs(res, 30_000)).toBe(30_000)
  })

  it('parses small Retry-After seconds', () => {
    const res = new Response(null, { status: 429, headers: { 'Retry-After': '2' } })
    expect(parseRetryAfterMs(res, 30_000)).toBe(2000)
  })
})

describe('withRetryFetch', () => {
  it('retries on 429 then succeeds', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const retryFetch = withRetryFetch(fetchFn, { baseDelayMs: 1, maxAttempts: 3 })
    const res = await retryFetch('https://api.example.com')
    expect(res.status).toBe(200)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('returns non-retryable errors immediately', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('bad request', { status: 400 }))
    const retryFetch = withRetryFetch(fetchFn, { baseDelayMs: 1 })
    const res = await retryFetch('https://api.example.com')
    expect(res.status).toBe(400)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('does not wait hours when Retry-After is huge', async () => {
    vi.useFakeTimers()
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('rate limited', { status: 429, headers: { 'Retry-After': '33448' } }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))

    const retryFetch = withRetryFetch(fetchFn, { baseDelayMs: 1, maxDelayMs: 100, maxAttempts: 3 })
    const promise = retryFetch('https://api.example.com')
    await vi.advanceTimersByTimeAsync(150)
    const res = await promise
    expect(res.status).toBe(200)
    vi.useRealTimers()
  })
})
