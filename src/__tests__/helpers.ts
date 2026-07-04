import { vi } from 'vitest'

/**
 * Minimal `Response`-like object matching what `apiFetch` reads:
 * `ok`, `status`, `text()` (for the success path) and `json()` (for errors).
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response
}

export function errorResponse(detail: unknown, status: number): Response {
  return {
    ok: false,
    status,
    statusText: `HTTP ${status}`,
    text: async () => JSON.stringify({ detail }),
    json: async () => ({ detail }),
  } as unknown as Response
}

interface FetchCall {
  url: string
  method: string
  body: string | undefined
}

/** Reads the (url, method, body) of a recorded mock fetch call. */
export function readCall(call: [unknown, unknown]): FetchCall {
  const url = String(call[0])
  const init = (call[1] ?? {}) as RequestInit
  return {
    url,
    method: (init.method ?? 'GET').toUpperCase(),
    body: init.body as string | undefined,
  }
}

/**
 * Routes mocked fetch by (method, url-substring). Each matcher fires once per
 * request; the first matching route wins. Avoids order-fragile
 * `mockResolvedValueOnce` chains while still exercising the real request layer.
 */
export function routeFetch(
  routes: Array<{ method?: string; match: string; response: Response }>,
): void {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const route = routes.find(
      (r) => url.includes(r.match) && (r.method ?? 'GET').toUpperCase() === method,
    )
    if (!route) {
      throw new Error(`No mock route for ${method} ${url}`)
    }
    return route.response
  })
}
