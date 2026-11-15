const dtf = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : dtf.format(d)
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const diffMs = Date.now() - d.getTime()
  const min = Math.round(diffMs / 60_000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  return `${days}d ago`
}

export function formatMoney(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(n)) return String(value ?? "—")
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}
