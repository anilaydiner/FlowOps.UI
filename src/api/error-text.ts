import { ApiError } from "./client"

const GENERIC = /^request validation failed$/i

/** Human-readable message for any thrown value, with correlation id for support. */
export function apiErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    const base = err.message
    if (err.violations.length > 0) {
      const fields = err.violations
        .map((v) => (v.field ? `${v.field}: ${v.message ?? "invalid"}` : v.message ?? "invalid"))
        .join("; ")
      return `${base} (${fields})`
    }
    if (err.correlationId) {
      return `${base} [ref: ${err.correlationId}]`
    }
    return base
  }
  if (err instanceof Error) return err.message
  return "Something went wrong. Please try again."
}

/**
 * Per-field validation messages keyed by backend field name
 * (e.g. { "username": "...", "steps[1].code": "..." }).
 * Empty object when the error has no field-level detail.
 */
export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (err instanceof ApiError) {
    for (const v of err.violations) {
      if (v.field && v.message) out[v.field] = v.message
    }
  }
  return out
}

/**
 * A meaningful message to show as a banner when there are NO per-field
 * violations (e.g. "Username already exists: admin", "Role not found: NOPE").
 * Returns null when the detail is just the generic "Request validation failed"
 * (covered by inline field errors) or when there is nothing to show.
 */
export function generalError(err: unknown): string | null {
  if (err instanceof ApiError) {
    if (err.violations.length === 0) {
      const text = err.message
      if (text && !GENERIC.test(text)) {
        return err.correlationId ? `${text} [ref: ${err.correlationId}]` : text
      }
    }
    return null
  }
  if (err instanceof Error && err.message) return err.message
  return "Something went wrong. Please try again."
}

/** True for errors that should surface as inline/banner (4xx + known 404/409). */
export function isClientError(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500
}
