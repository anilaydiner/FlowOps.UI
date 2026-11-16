import type { components } from "./schema"

export type ProblemDetail = components["schemas"]["ProblemDetail"]

export interface FieldViolation {
  field?: string
  message?: string
}

/**
 * Typed error for non-2xx responses. The backend uses RFC 7807 ProblemDetails
 * with a `correlationId` extension and per-field `violations` on validation 400s.
 */
export class ApiError extends Error {
  readonly status: number
  readonly type?: string
  readonly instance?: string
  readonly properties: Record<string, unknown>
  readonly violations: FieldViolation[]
  readonly correlationId: string | undefined

  constructor(detail: ProblemDetail, status: number) {
    super(detail.detail ?? detail.title ?? `Request failed with status ${status}`)
    this.name = "ApiError"
    this.status = status
    this.type = detail.type
    this.instance = detail.instance
    this.properties = detail.properties ?? {}

    // The backend emits RFC 7807 extensions at the TOP LEVEL:
    //   { "violations": { "email": "..." }, "correlationId": "..." }
    // where violations is a field→message object (nested paths like
    // "steps[0].code" are allowed). Support an array shape and the
    // `properties.*` nesting as fallbacks.
    const d = detail as unknown as Record<string, unknown>
    const raw = d.violations ?? this.properties.violations
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      this.violations = Object.entries(raw as Record<string, unknown>).map(
        ([field, message]) => ({ field, message: String(message) })
      )
    } else if (Array.isArray(raw)) {
      this.violations = raw as FieldViolation[]
    } else {
      this.violations = []
    }

    const c = d.correlationId ?? this.properties.correlationId
    this.correlationId = typeof c === "string" ? c : undefined
  }
}

// ---------------------------------------------------------------------------
// Token / session storage
//
// The backend issues a PAIR per login/refresh: a short-lived JWT access token
// and a single-use refresh token bound to a server-side session (7d per token,
// 30d maximum session lifetime). Refresh ROTATES: the old refresh token is
// consumed, a new pair is issued, and reusing a consumed token revokes the
// whole session.
// ---------------------------------------------------------------------------

const TOKEN_KEY = "flowops.token"
const REFRESH_KEY = "flowops.refreshToken"
const ACCESS_EXPIRES_KEY = "flowops.accessExpiresAt"
const SESSION_EXPIRES_KEY = "flowops.sessionExpiresAt"

/** Subset of the backend AuthResponse that we persist. */
export interface StoredSession {
  token?: string
  refreshToken?: string
  /** seconds — access token lifetime */
  expiresIn?: number
  /** ISO instant — absolute session deadline */
  sessionExpiresAt?: string
}

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  /** Epoch ms at which the current access token expires (null = unknown). */
  getAccessExpiresAt: (): number | null => {
    const v = Number(localStorage.getItem(ACCESS_EXPIRES_KEY))
    return Number.isFinite(v) ? v : null
  },
  /** ISO instant of the absolute session deadline (null = unknown). */
  getSessionExpiresAt: (): string | null =>
    localStorage.getItem(SESSION_EXPIRES_KEY),
  /**
   * Persist a full login/refresh response (access + refresh + deadlines).
   */
  storeAuthResponse: (res: StoredSession): void => {
    if (res.token) localStorage.setItem(TOKEN_KEY, res.token)
    if (res.refreshToken) localStorage.setItem(REFRESH_KEY, res.refreshToken)
    else localStorage.removeItem(REFRESH_KEY)
    const expiresAt =
      typeof res.expiresIn === "number" && Number.isFinite(res.expiresIn)
        ? Date.now() + res.expiresIn * 1000
        : null
    if (expiresAt !== null) localStorage.setItem(ACCESS_EXPIRES_KEY, String(expiresAt))
    else localStorage.removeItem(ACCESS_EXPIRES_KEY)
    if (res.sessionExpiresAt) localStorage.setItem(SESSION_EXPIRES_KEY, res.sessionExpiresAt)
    else localStorage.removeItem(SESSION_EXPIRES_KEY)
  },
  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(ACCESS_EXPIRES_KEY)
    localStorage.removeItem(SESSION_EXPIRES_KEY)
  },
}

// ---------------------------------------------------------------------------
// Refresh-token rotation — SINGLE-FLIGHT.
//
// The refresh token is single-use server-side: two concurrent rotations would
// make the second one look like token reuse and revoke the entire session.
// So every caller (proactive or reactive) shares one in-flight request.
// ---------------------------------------------------------------------------

/** Refresh 30s before the access token actually expires (clock skew, in-flight requests). */
const PROACTIVE_WINDOW_MS = 30_000

let refreshInFlight: Promise<boolean> | null = null

/**
 * Rotate the stored refresh token. Concurrent callers await the same promise.
 * Returns true when a fresh pair was stored, false when the session is gone
 * (no refresh token, expired, revoked, password changed, reuse detected).
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function doRefresh(): Promise<boolean> {
  const rt = tokenStore.getRefresh()
  if (!rt) return false
  try {
    // Raw fetch on purpose: a 401 from /auth/refresh must NOT be retried
    // through api() — that would recurse into refresh forever.
    const res = await fetch(
      new URL("/api/v1/auth/refresh", window.location.origin).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-Id": crypto.randomUUID(),
        },
        body: JSON.stringify({ refreshToken: rt }),
        cache: "no-store",
      }
    )
    if (!res.ok) return false
    const data = (await res.json()) as StoredSession
    if (!data.token) return false
    tokenStore.storeAuthResponse(data)
    return true
  } catch {
    // Network error / offline — keep stored tokens; a later 401 can retry.
    return false
  }
}

// ---------------------------------------------------------------------------
// Request pipeline
// ---------------------------------------------------------------------------

export type QueryParamValue = string | number | boolean | undefined | null
export type QueryParams = Record<string, QueryParamValue>

export interface ApiInit {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  query?: QueryParams
  /** Skip the 401 refresh/redirect handling (used by the login call itself). */
  noRedirectOn401?: boolean
}

function buildUrl(path: string, query?: QueryParams): URL {
  const url = new URL(`/api/v1${path}`, window.location.origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url
}

async function requestOnce(path: string, init?: ApiInit): Promise<Response> {
  const headers = new Headers()
  const token = tokenStore.get()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init?.body !== undefined) headers.set("Content-Type", "application/json")
  headers.set("X-Correlation-Id", crypto.randomUUID())
  return fetch(buildUrl(path, init?.query).toString(), {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : undefined
  } catch {
    return text
  }
}

export async function api<T>(path: string, init?: ApiInit): Promise<T> {
  const isAuthPath = path.startsWith("/auth/")

  // PROACTIVE: access token already expired (or expiring within the safety
  // window) → rotate before sending, so the first request uses a live token.
  if (
    !init?.noRedirectOn401 &&
    !isAuthPath &&
    tokenStore.get() !== null &&
    tokenStore.getRefresh() !== null
  ) {
    const exp = tokenStore.getAccessExpiresAt()
    if (exp !== null && Date.now() >= exp - PROACTIVE_WINDOW_MS) {
      await refreshSession()
    }
  }

  let res = await requestOnce(path, init)

  // REACTIVE: server rejected the access token → rotate once, retry once.
  if (res.status === 401 && !init?.noRedirectOn401 && !isAuthPath) {
    const rotated = await refreshSession()
    if (!rotated) {
      // Session is gone (expired, revoked, password changed, reuse detected).
      const data = await readBody(res)
      tokenStore.clear()
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login?reason=expired")
      }
      throw new ApiError((data ?? {}) as ProblemDetail, res.status)
    }
    // Exactly one retry with the fresh pair — never re-rotates (no loops).
    res = await requestOnce(path, init)
  }

  if (res.status === 204) return undefined as T

  const data = await readBody(res)
  if (!res.ok) throw new ApiError((data ?? {}) as ProblemDetail, res.status)
  return data as T
}
