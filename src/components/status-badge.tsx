import { Badge } from "@/components/ui/badge"

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600",
  SUBMITTED: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
  IN_REVIEW:
    "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700",
  APPROVED:
    "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700",
  EXECUTED: "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-700",
  CLOSED: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700",
  REJECTED:
    "bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  CANCELLED:
    "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600",
  EXPIRED:
    "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700",
}

const STEP_STYLES: Record<string, string> = {
  PENDING:
    "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700",
  SATISFIED:
    "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700",
  SKIPPED:
    "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700",
  BLOCKED:
    "bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
}

const ACTION_STYLES: Record<string, string> = {
  APPROVE:
    "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700",
  REJECT:
    "bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  DELEGATE:
    "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-700",
  OVERRIDE:
    "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700",
}

const JOB_STYLES: Record<string, string> = {
  PLANNED:
    "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600",
  STARTED:
    "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700",
  COMPLETED:
    "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700",
  FAILED:
    "bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
}

const EXECUTION_STATE_STYLES: Record<string, string> = {
  NOT_PLANNED:
    "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700",
  QUEUED:
    "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600",
  RUNNING:
    "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700",
  RETRYING:
    "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700",
  COMPLETION_PENDING:
    "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700",
  COMPLETED:
    "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700",
  STOPPED:
    "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600",
  UNKNOWN:
    "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700",
  RECONCILIATION_REQUIRED:
    "bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
}

function styleFor(
  kind: "status" | "step" | "action" | "job" | "execution",
  key?: string,
): string {
  if (!key) return ""
  const map =
    kind === "status"
      ? STATUS_STYLES
      : kind === "step"
        ? STEP_STYLES
        : kind === "action"
          ? ACTION_STYLES
          : kind === "job"
            ? JOB_STYLES
            : EXECUTION_STATE_STYLES
  return map[key] ?? "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600"
}

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null
  return (
    <Badge variant="outline" className={styleFor("status", status)}>
      {status.replace(/_/g, " ")}
    </Badge>
  )
}

export function StepBadge({ state }: { state?: string }) {
  if (!state) return null
  return (
    <Badge variant="outline" className={styleFor("step", state)}>
      {state.replace(/_/g, " ")}
    </Badge>
  )
}

export function ActionBadge({ action }: { action?: string }) {
  if (!action) return null
  return <Badge variant="outline" className={styleFor("action", action)}>{action}</Badge>
}

export function JobBadge({ status }: { status?: string }) {
  if (!status) return null
  return <Badge variant="outline" className={styleFor("job", status)}>{status}</Badge>
}

export function ExecutionStateBadge({ state }: { state?: string }) {
  if (!state) return null
  return (
    <Badge variant="outline" className={styleFor("execution", state)}>
      {state.replace(/_/g, " ")}
    </Badge>
  )
}
