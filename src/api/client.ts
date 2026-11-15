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

const TOKEN_KEY = "flowops.token"

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
}

export type QueryParamValue = string | number | boolean | undefined | null
export type QueryParams = Record<string, QueryParamValue>

export interface ApiInit {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  query?: QueryParams
  /** Skip the global 401 redirect (used by the login call itself). */
  noRedirectOn401?: boolean
}

export async function api<T>(path: string, init?: ApiInit): Promise<T> {
  const url = new URL(`/api/v1${path}`, window.location.origin)
  if (init?.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const headers = new Headers()
  const token = tokenStore.get()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init?.body !== undefined) headers.set("Content-Type", "application/json")
  headers.set("X-Correlation-Id", crypto.randomUUID())

  const res = await fetch(url.toString(), {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = text
  }

  if (!res.ok) {
    if (res.status === 401 && !init?.noRedirectOn401) {
      tokenStore.clear()
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login")
      }
    }
    throw new ApiError((data ?? {}) as ProblemDetail, res.status)
  }
  return data as T
}
