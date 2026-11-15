import type { ReactNode } from "react"

/** Inline per-field error message. Renders nothing when `message` is empty. */
export function FieldError({
  id,
  message,
}: {
  id?: string
  message?: string | null
}) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  )
}

/** Banner for errors that aren't tied to a specific field. */
export function ErrorBanner({
  message,
  children,
}: {
  message?: string | null
  children?: ReactNode
}) {
  if (!message && !children) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <span className="min-w-0 flex-1">
        {message ?? children}
      </span>
    </div>
  )
}
