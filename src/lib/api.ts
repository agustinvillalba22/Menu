import type { ValidationErrorItem } from './types'

/**
 * Error thrown when the backend responds with a non-2xx status.
 * `detail` mirrors FastAPI's error body: a plain string for HTTPException,
 * or an array of validation items for 422 responses.
 * `code` is the string detail when present (useful for programmatic checks),
 * otherwise null.
 */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string | ValidationErrorItem[]
  readonly code: string | null

  constructor(status: number, detail: string | ValidationErrorItem[]) {
    const message = typeof detail === 'string' ? detail : 'Validation error'
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.code = typeof detail === 'string' ? detail : null
  }
}

interface ErrorBody {
  detail?: string | ValidationErrorItem[]
}

async function extractDetail(res: Response): Promise<string | ValidationErrorItem[]> {
  try {
    const body = (await res.json()) as ErrorBody
    if (body && body.detail !== undefined) {
      return body.detail
    }
    return res.statusText
  } catch {
    return res.statusText
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })

  if (!res.ok) {
    throw new ApiError(res.status, await extractDetail(res))
  }

  // 204 No Content or an empty body: resolve without parsing to avoid a
  // JSON parse crash (e.g. POST /auth/logout returns 204).
  if (res.status === 204) {
    return undefined as T
  }
  const text = await res.text()
  if (text === '') {
    return undefined as T
  }
  return JSON.parse(text) as T
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' })
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
