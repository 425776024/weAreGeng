import { invoke } from '@tauri-apps/api/core'

export interface HttpProxyRequest {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
  timeoutSecs?: number
}

export interface HttpProxyResponse {
  status: number
  headers: Record<string, string>
  body: string
}

export async function httpProxy(request: HttpProxyRequest): Promise<HttpProxyResponse> {
  return invoke<HttpProxyResponse>('http_proxy', { request })
}

export async function proxiedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  if (init.headers) {
    const h = new Headers(init.headers)
    h.forEach((value, key) => {
      headers[key] = value
    })
  }

  let body: string | undefined
  if (typeof init.body === 'string') {
    body = init.body
  } else if (init.body != null) {
    body = await new Response(init.body).text()
  }

  const res = await httpProxy({
    method: init.method ?? 'GET',
    url,
    headers,
    body,
  })

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  })
}
