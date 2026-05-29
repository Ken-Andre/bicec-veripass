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

async function handleBlobResponse(res: Response): Promise<{ blob: Blob; filename: string | null }> {
  if (!res.ok) {
    let detail = res.statusText || 'Request failed'
    try {
      const body = await res.json()
      if (body.detail) detail = body.detail
    } catch { /* ignore */ }
    throw new ApiError(res.status, detail)
  }
  const disposition = res.headers.get('Content-Disposition') || res.headers.get('content-disposition')
  const filenameMatch = disposition?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)
  return {
    blob: await res.blob(),
    filename: filenameMatch ? decodeURIComponent(filenameMatch[1].replace(/"$/g, '')) : null,
  }
}

async function handleBlobResponseWithMetadata(
  res: Response,
): Promise<{ blob: Blob; filename: string | null; contentType: string | null }> {
  const { blob, filename } = await handleBlobResponse(res)
  const contentType = res.headers.get('Content-Type') || res.headers.get('content-type')
  return { blob, filename, contentType }
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

export async function apiGetBlob(
  path: string,
  options?: RequestOptions,
): Promise<{ blob: Blob; filename: string | null; contentType: string | null }> {
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
  return handleBlobResponseWithMetadata(res)
}

export async function apiPost<T = any>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const token = getToken()
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options?.headers,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: 'POST',
    headers,
    body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiDownload(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<{ blob: Blob; filename: string | null }> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...options?.headers,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleBlobResponse(res)
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
