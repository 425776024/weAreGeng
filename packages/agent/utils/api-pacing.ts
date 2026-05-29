import type { FetchFn } from '../types'
import { sleep } from './retry-fetch'

/** 按域名最小请求间隔（毫秒），避免对同一站点密集轰炸 */
const HOST_GAP_MS: Record<string, number> = {
  'api.openalex.org': 900,
  'api.semanticscholar.org': 1200,
}

const DEFAULT_GAP_MS = 700

type HostState = { chain: Promise<void>; lastDoneAt: number }
const hostState = new Map<string, HostState>()

function hostKey(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'default'
  }
}

function gapForHost(key: string): number {
  return HOST_GAP_MS[key] ?? DEFAULT_GAP_MS
}

function getHostState(key: string): HostState {
  let state = hostState.get(key)
  if (!state) {
    state = { chain: Promise.resolve(), lastDoneAt: 0 }
    hostState.set(key, state)
  }
  return state
}

/** 同一域名上的请求串行排队，并保持最小间隔 */
export function paceExternalApi<T>(url: string, run: () => Promise<T>): Promise<T> {
  const key = hostKey(url)
  const gap = gapForHost(key)
  const state = getHostState(key)

  const scheduled = state.chain.then(async () => {
    const wait = state.lastDoneAt + gap - Date.now()
    if (wait > 0) await sleep(wait)
    try {
      return await run()
    } finally {
      state.lastDoneAt = Date.now()
    }
  })

  state.chain = scheduled.then(
    () => undefined,
    () => undefined,
  )
  return scheduled
}

export function pacedFetch(fetchFn: FetchFn): FetchFn {
  return (url, init) => paceExternalApi(url, () => fetchFn(url, init))
}
