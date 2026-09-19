// Tunn fetch-wrapper mot PHP-API:t. Ersätter Appwrite-SDK:t.
// Hanterar bas-URL, JSON, sessionskakor, CSRF, timeout och nätverksfel på ett
// ställe så att komponenterna slipper duplicerad anropslogik.

/** Serverns gemensamma svarsformat. */
interface ApiEnvelope<T> {
  success: boolean
  data: T | null
  error: { code: string; message: string } | null
}

export class ApiError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

// Samma origin i produktion (React-build och PHP ligger på samma domän).
// VITE_API_BASE används vid lokal utveckling mot en separat PHP-server.
const BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'
const TIMEOUT_MS = 15000

// CSRF-token sätts av servern vid inloggning och skickas med skrivande anrop.
let csrfToken: string | null = null
export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** JSON-body. Utelämnas för GET. */
  body?: unknown
  signal?: AbortSignal
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`

  // Egen timeout som även avbryter om anroparen inte skickat en signal.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  // Skrivande metoder kräver CSRF-token.
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken

  let res: globalThis.Response
  try {
    res = await fetch(url, {
      method,
      headers,
      // Sessionskakan måste följa med.
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'Servern svarade inte i tid.', 0)
    }
    throw new ApiError('NETWORK_ERROR', 'Kunde inte nå servern.', 0)
  }
  clearTimeout(timer)
  return unwrap<T>(res, await res.json().catch(() => null))
}

/** Filuppladdning (multipart/form-data) — egen funktion eftersom body inte ska JSON-kodas. */
export async function apiUpload<T>(path: string, form: FormData, signal?: AbortSignal): Promise<T> {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken

  let res: globalThis.Response
  try {
    // Inget Content-Type sätts här — webbläsaren sätter multipart-gränsen själv.
    res = await fetch(url, { method: 'POST', headers, credentials: 'same-origin', body: form, signal })
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Kunde inte nå servern.', 0)
  }
  return unwrap<T>(res, await res.json().catch(() => null))
}

function unwrap<T>(res: globalThis.Response, envelope: ApiEnvelope<T> | null): T {
  if (envelope === null) {
    // Servern svarade med något som inte är JSON (t.ex. en HTML-felsida).
    throw new ApiError('BAD_RESPONSE', 'Ogiltigt svar från servern.', res.status)
  }
  if (!res.ok || !envelope.success) {
    throw new ApiError(
      envelope.error?.code ?? 'HTTP_ERROR',
      envelope.error?.message ?? `Fel från servern (${res.status}).`,
      res.status,
    )
  }
  return envelope.data as T
}
