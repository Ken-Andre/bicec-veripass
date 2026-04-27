const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const TOKEN_KEY = 'veripass_access_token'

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText || 'Request failed'
    try {
      const body = await res.json()
      if (body.detail) detail = body.detail
    } catch { /* ignore */ }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>
}

export async function apiGet<T = any>(path: string, options?: RequestOptions): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...options?.headers,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: 'GET',
    headers,
  })
  return handleResponse<T>(res)
}

export async function apiPost<T = any>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiPatch<T = any>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: 'PATCH',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiDelete<T = any>(path: string, options?: RequestOptions): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...options?.headers,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: 'DELETE',
    headers,
  })
  return handleResponse<T>(res)
}
