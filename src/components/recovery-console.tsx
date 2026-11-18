import { useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import {
  executionRecoveryApi,
  type RecoveryJob,
} from "@/api/endpoints"
import { formatDate } from "@/lib/format"
import { JobBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

interface RecoveryConsoleProps {
  requestId: number
  requestVersion: number
  canReconcile?: boolean
  canRetry?: boolean
}

/**
 * Durable execution recovery console — job-level reconcile/retry commands,
 * attempt history, attempt events, and immutable command receipts.
 * Gated by execution:read (view), execution:reconcile, execution:retry.
 */
export function RecoveryConsole({
  requestId,
  requestVersion,
  canReconcile,
  canRetry,
}: RecoveryConsoleProps) {
  const queryClient = useQueryClient()
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null)
  const [commandJob, setCommandJob] = useState<RecoveryJob | null>(null)
  const [commandKind, setCommandKind] = useState<"reconcile" | "retry">("reconcile")
  const [reason, setReason] = useState("")
  const [commandError, setCommandError] = useState<string | null>(null)

  // ── Recovery history (jobs + command receipts) ──────────────────
  const historyQ = useQuery({
    queryKey: ["recovery-history", requestId],
    queryFn: () => executionRecoveryApi.history(requestId),
    staleTime: 30_000,
    retry: false,
  })
  const jobs = historyQ.data?.jobs ?? []
  const receipts = historyQ.data?.commands ?? []

  // ── Attempts + events for the expanded job ─────────────────────
  const attemptsQ = useQuery({
    queryKey: ["recovery-attempts", requestId, expandedJobId],
    queryFn: () => executionRecoveryApi.attempts(requestId, expandedJobId!),
    enabled: expandedJobId != null,
    staleTime: 30_000,
    retry: false,
  })
  const eventsQ = useQuery({
    queryKey: ["recovery-events", requestId, expandedJobId],
    queryFn: () => executionRecoveryApi.events(requestId, expandedJobId!),
    enabled: expandedJobId != null,
    staleTime: 30_000,
    retry: false,
  })

  // ── Command mutation (reconcile / retry) ───────────────────────
  const commandMutation = useMutation({
    mutationFn: () => {
      const cmd = {
        commandId: crypto.randomUUID(),
        expectedVersion: requestVersion,
        reason,
      }
      if (commandKind === "reconcile")
        return executionRecoveryApi.reconcile(requestId, commandJob!.id!, cmd)
      return executionRecoveryApi.retry(requestId, commandJob!.id!, cmd)
    },
    onSuccess: () => {
      toast.success(
        commandKind === "reconcile"
          ? "Reconcile command issued"
          : "Retry authorized",
      )
      resetDialog()
      queryClient.invalidateQueries({ queryKey: ["recovery-history", requestId] })
      queryClient.invalidateQueries({ queryKey: ["request", requestId] })
      queryClient.invalidateQueries({ queryKey: ["requests"] })
    },
    onError: (e: Error) => setCommandError(e.message),
  })

  const isDialogOpen = commandJob !== null
  const isMutating = commandMutation.isPending

  const openDialog = (kind: "reconcile" | "retry", job: RecoveryJob) => {
    setCommandKind(kind)
    setCommandJob(job)
    setReason("")
    setCommandError(null)
  }
  const resetDialog = () => {
    setCommandJob(null)
    setReason("")
    setCommandError(null)
  }
  const handleCommand = () => {
    if (!reason.trim()) {
      setCommandError("Reason is required.")
      return
    }
    commandMutation.mutate()
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Jobs */}
      {historyQ.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No execution jobs recorded in the recovery log.
        </p>
      ) : (
        <div>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Job</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job, i) => {
                const expanded = expandedJobId === job.id
                return (
                  <JobRow
                    key={job.id ?? i}
                    job={job}
                    expanded={expanded}
                    canReconcile={canReconcile}
                    canRetry={canRetry}
                    onToggle={() =>
                      setExpandedJobId(expanded ? null : job.id ?? null)
                    }
                    onReconcile={() => openDialog("reconcile", job)}
                    onRetry={() => openDialog("retry", job)}
                  />
                )
              })}
            </TableBody>
          </Table>
          </div>

          {/* Expanded job details: attempts + events */}
          {expandedJobId != null && (
            <div className="mt-2 rounded-lg border bg-muted/30 p-3">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Attempts */}
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                    Attempt history
                  </h4>
                  {attemptsQ.isPending ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (attemptsQ.data?.attempts?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No recorded attempts.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {attemptsQ.data!.attempts!.map((a, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium">#{a.number}</span>{" "}
                          {a.action}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {a.authorizedAt ? formatDate(a.authorizedAt) : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {attemptsQ.data?.baseline && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Baseline: {attemptsQ.data.baseline.status} ·{" "}
                      {attemptsQ.data.baseline.observedAttemptCount ?? 0} attempt
                      {attemptsQ.data.baseline.observedAttemptCount === 1 ? "" : "s"} ·{" "}
                      {attemptsQ.data.baseline.firstStartedAt
                        ? formatDate(attemptsQ.data.baseline.firstStartedAt)
                        : "unknown start"}
                      {attemptsQ.data.baseline.startInferred
                        ? " (inferred)"
                        : ""}
                    </p>
                  )}
                </div>

                {/* Events */}
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                    Attempt events
                  </h4>
                  {eventsQ.isPending ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (eventsQ.data?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No events recorded.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {eventsQ.data!.map((e, i) => (
                        <li key={e.sequence ?? i} className="text-sm">
                          <Badge
                            variant="outline"
                            className="mr-2 text-xs"
                          >
                            {e.kind}
                          </Badge>
                          {e.attemptNumber != null && (
                            <span>attempt #{e.attemptNumber}</span>
                          )}
                          {e.outcome && (
                            <span className="ml-1">→ {e.outcome}</span>
                          )}
                          {e.at && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {formatDate(e.at)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Command history */}
      {receipts.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Command history</h4>
          <ul className="flex flex-col gap-2">
            {receipts.map((c, i) => (
              <li
                key={c.commandId ?? i}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-2 text-sm"
              >
                <Badge
                  variant="outline"
                  className={
                    c.kind === "RETRY"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "bg-green-500/10 text-green-600 dark:text-green-400"
                  }
                >
                  {c.kind}
                </Badge>
                <span className="text-muted-foreground">
                  Job #{c.jobId}
                </span>
                {c.actorName && <span>{c.actorName}</span>}
                <span className="text-xs text-muted-foreground">
                  {formatDate(c.recordedAt ?? c.createdAt)}
                </span>
                {c.disposition && (
                  <span className="text-xs">{c.disposition}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Command dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) resetDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {commandKind === "reconcile"
                ? "Reconcile Job"
                : "Authorize Retry"}
            </DialogTitle>
            <DialogDescription>
              {commandKind === "reconcile"
                ? "Query the provider for the current outcome without executing. This is safe and idempotent."
                : "Authorize one safe retry of the held work with the original idempotency key and input."}
            </DialogDescription>
          </DialogHeader>

          {commandJob && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Job </span>
                  <span className="font-medium">
                    {commandJob.action}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status </span>
                  <JobBadge status={commandJob.status} />
                </div>
                <div>
                  <span className="text-muted-foreground">Attempts </span>
                  <span>
                    {commandJob.attemptCount ?? 0}
                    {commandJob.maxRetries != null
                      ? ` / ${commandJob.maxRetries}`
                      : ""}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Version </span>
                  <span className="font-mono">{requestVersion}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="cmd-reason">Reason</Label>
                <Textarea
                  id="cmd-reason"
                  rows={3}
                  placeholder="Explain why this command is being issued…"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    setCommandError(null)
                  }}
                />
              </div>

              {commandError && (
                <p className="text-sm text-destructive" role="alert">
                  {commandError}
                </p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={resetDialog}>
                  Cancel
                </Button>
                <Button onClick={handleCommand} disabled={isMutating}>
                  {commandKind === "reconcile" ? (
                    <>
                      <RefreshCw className="size-4" />
                      {isMutating ? "Reconciling…" : "Reconcile"}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-4" />
                      {isMutating ? "Authorizing…" : "Authorize Retry"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Single job row with expand toggle + action buttons. */
function JobRow({
  job,
  expanded,
  canReconcile,
  canRetry,
  onToggle,
  onReconcile,
  onRetry,
}: {
  job: RecoveryJob
  expanded: boolean
  canReconcile?: boolean
  canRetry?: boolean
  onToggle: () => void
  onReconcile: () => void
  onRetry: () => void
}) {
  return (
    <TableRow
      className="cursor-pointer"
      onClick={onToggle}
      tabIndex={0}
      role="button"
      aria-expanded={expanded}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      <TableCell className="w-8">
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
      </TableCell>
      <TableCell>
        <div className="font-medium">{job.action}</div>
        {job.lastError && (
          <div className="mt-0.5 max-w-md text-xs text-destructive">
            {job.lastError}
          </div>
        )}
      </TableCell>
      <TableCell>
        <JobBadge status={job.status} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm">
        {job.attemptCount ?? 0}
        {job.maxRetries != null && (
          <span className="text-muted-foreground"> / {job.maxRetries}</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {canReconcile && (
            <Button variant="outline" size="sm" onClick={onReconcile}>
              <RefreshCw className="size-3.5" />
              Reconcile
            </Button>
          )}
          {canRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
