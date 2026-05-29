import type { FetchFn } from '../types'

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

export interface WebSearchConfig {
  enabled: boolean
  provider: string
  apiKey?: string
}

export async function webSearch(
  fetchFn: FetchFn,
  config: WebSearchConfig,
  query: string,
  limit = 8,
): Promise<WebSearchResult[]> {
  if (!config.enabled || !query.trim()) return []

  const q = query.trim()
  switch (config.provider) {
    case 'serper':
      return searchSerper(fetchFn, config.apiKey ?? '', q, limit)
    case 'tavily':
      return searchTavily(fetchFn, config.apiKey ?? '', q, limit)
    default:
      return searchDuckDuckGo(fetchFn, q, limit)
  }
}

async function searchSerper(
  fetchFn: FetchFn,
  apiKey: string,
  query: string,
  limit: number,
): Promise<WebSearchResult[]> {
  if (!apiKey) throw new Error('Serper 需要 API Key')
  const res = await fetchFn('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({ q: query, num: limit }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Serper 搜索失败 (${res.status}): ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>
  }
  return (data.organic ?? []).slice(0, limit).map((item) => ({
    title: item.title ?? '',
    url: item.link ?? '',
    snippet: item.snippet ?? '',
  }))
}

async function searchTavily(
  fetchFn: FetchFn,
  apiKey: string,
  query: string,
  limit: number,
): Promise<WebSearchResult[]> {
  if (!apiKey) throw new Error('Tavily 需要 API Key')
  const res = await fetchFn('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: limit,
      search_depth: 'basic',
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Tavily 搜索失败 (${res.status}): ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>
  }
  return (data.results ?? []).slice(0, limit).map((item) => ({
    title: item.title ?? '',
    url: item.url ?? '',
    snippet: item.content ?? '',
  }))
}

async function searchDuckDuckGo(
  fetchFn: FetchFn,
  query: string,
  limit: number,
): Promise<WebSearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
  const res = await fetchFn(url)
  if (!res.ok) return []
  const data = (await res.json()) as {
    AbstractText?: string
    AbstractURL?: string
    Heading?: string
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>
  }
  const results: WebSearchResult[] = []
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.Heading ?? query,
      url: data.AbstractURL,
      snippet: data.AbstractText,
    })
  }
  for (const topic of data.RelatedTopics ?? []) {
    if (topic.Text && topic.FirstURL) {
      results.push({ title: topic.Text.slice(0, 80), url: topic.FirstURL, snippet: topic.Text })
    }
    for (const sub of topic.Topics ?? []) {
      if (sub.Text && sub.FirstURL) {
        results.push({ title: sub.Text.slice(0, 80), url: sub.FirstURL, snippet: sub.Text })
      }
    }
    if (results.length >= limit) break
  }
  return results.slice(0, limit)
}
