export function usesMimoApiKeyAuth(baseUrl: string, apiKey: string): boolean {
  return apiKey.startsWith('tp-') || baseUrl.includes('xiaomimimo')
}

export function buildLlmAuthHeaders(baseUrl: string, apiKey: string): Record<string, string> {
  if (usesMimoApiKeyAuth(baseUrl, apiKey)) {
    return { 'api-key': apiKey }
  }
  return { Authorization: `Bearer ${apiKey}` }
}
