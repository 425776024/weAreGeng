import type { FetchFn } from '../types'

export interface RetryFetchOptions {
  maxAttempts?: number
  baseDelayMs?: number
  /** 单次重试等待上限，避免 Retry-After 极大值导致长时间阻塞 */
  maxDelayMs?: number
  retryStatuses?: number[]
  /** 默认关闭，避免调查时控制台刷屏 */
  logRetries?: boolean
}

const DEFAULT_RETRY_STATUSES = [429, 500, 502, 503, 504]
const DEFAULT_MAX_DELAY_MS = 30_000

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 解析 Retry-After（秒数或 HTTP-date），并限制在合理范围内 */
export function parseRetryAfterMs(res: Response, maxDelayMs: number): number | null {
  const header = res.headers.get('retry-after')?.trim()
  if (!header) return null

  const asSeconds = Number(header)
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return Math.min(asSeconds * 1000, maxDelayMs)
  }

  const asDate = Date.parse(header)
  if (Number.isFinite(asDate)) {
    return Math.min(Math.max(0, asDate - Date.now()), maxDelayMs)
  }

  return null
}

function backoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  return Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)
}

/** 带指数退避的 fetch，用于 OpenAlex / S2 等 API rate limit。 */
export function withRetryFetch(
  fetchFn: FetchFn,
  options: RetryFetchOptions = {},
): FetchFn {
  const maxAttempts = options.maxAttempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 500
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
  const retryStatuses = options.retryStatuses ?? DEFAULT_RETRY_STATUSES
  const logRetries = options.logRetries ?? false

  return async (url, init) => {
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchFn(url, init)
        if (res.ok || !retryStatuses.includes(res.status) || attempt === maxAttempts) {
          return res
        }
        const retryAfter = parseRetryAfterMs(res, maxDelayMs)
        const delay = retryAfter ?? backoffDelay(attempt, baseDelayMs, maxDelayMs)
        if (logRetries) {
          console.warn(`[retry-fetch] ${res.status} ${url} — retry ${attempt}/${maxAttempts} in ${delay}ms`)
        }
        await sleep(delay)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt === maxAttempts) throw lastError
        const delay = backoffDelay(attempt, baseDelayMs, maxDelayMs)
        if (logRetries) {
          console.warn(`[retry-fetch] network error — retry ${attempt}/${maxAttempts} in ${delay}ms`)
        }
        await sleep(delay)
      }
    }
    throw lastError ?? new Error('retry-fetch exhausted')
  }
}
