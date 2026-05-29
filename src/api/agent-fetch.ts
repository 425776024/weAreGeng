import { proxiedFetch } from './proxy'
import type { FetchFn } from '@wearegeng/agent/types'

export const agentFetch: FetchFn = async (url, init) => {
  return proxiedFetch(url, init)
}
