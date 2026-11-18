import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import {
  requestsApi,
  type RequestResponse,
} from "@/api/endpoints"
import { attentionLabel } from "@/lib/execution"
import { formatDate } from "@/lib/format"
import { ExecutionStateBadge, JobBadge } from "@/components/status-badge"
import { RecoveryConsole } from "@/components/recovery-console"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ExecutionCardProps {
  requestId: number
  request: RequestResponse
  /** Permission gate for the operator recovery history (request:blocked:read). */
  canReadRecoveries?: boolean
  /** Permission gate for the recovery console (execution:read). */
  canReadRecovery?: boolean
  /** Permission gate for reconcile commands (execution:reconcile). */
  canReconcile?: boolean
  /** Permission gate for retry commands (execution:retry). */
  canRetry?: boolean
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <div className="rounded-lg border bg-muted/30 p-3">{children}</div>
    </div>
  )
}

function Count({ label, value }: { label: string; value?: number }) {
  if (!value) return null
  return (
    <span className="text-muted-foreground">
      {label}: <strong className="font-medium text-foreground">{value}</strong>
    </span>
  )
}

/**
 * Full execution surface for a request: live progress + attention, jobs,
 * frozen plan, approval roster and operator recovery history.
 * Render only when the request has an execution surface (see hasExecution).
 */
export function ExecutionCard({
  requestId,
  request,
  canReadRecoveries,
  canReadRecovery,
  canReconcile,
  canRetry,
}: ExecutionCardProps) {
  const progress = request.executionProgress
  const jobs = request.executionJobs ?? []
  const counts = progress?.jobs
  const reasons = progress?.attentionReasons ?? []

  const planQ = useQuery({
    queryKey: ["execution-plan", requestId],
    queryFn: () => requestsApi.executionPlan(requestId),
    staleTime: 60_000,
    retry: false,
  })
  const participantsQ = useQuery({
    queryKey: ["request-participants", requestId],
    queryFn: () => requestsApi.participants(requestId),
    staleTime: 60_000,
    retry: false,
  })
  const recoveriesQ = useQuery({
    queryKey: ["request-recoveries", requestId],
    queryFn: () => requestsApi.recoveries(requestId),
    enabled: canReadRecoveries === true,
    staleTime: 30_000,
    retry: false,
  })

  const participants = participantsQ.data ?? []
  const recoveries = recoveriesQ.data ?? []
  const plan = planQ.data

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Execution
          <ExecutionStateBadge state={progress?.state} />
        </CardTitle>
        <CardDescription>
          Durable execution progress, jobs, and recovery history
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Progress summary */}
        {counts && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              Jobs: <strong>{counts.total ?? 0}</strong>
              {progress?.expectedJobs != null && (
                <span className="text-muted-foreground">
                  {" "}
                  of {progress.expectedJobs} expected
                </span>
              )}
            </span>
            <Count label="completed" value={counts.completed} />
            <Count label="running" value={counts.running} />
            <Count label="retrying" value={counts.retrying} />
            <Count label="uncertain" value={counts.uncertain} />
            <Count label="dead letter" value={counts.deadLetter} />
            <Count label="cancelled" value={counts.cancelled} />
          </div>
        )}

        {/* Attention reasons */}
        {reasons.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
              <AlertTriangle className="size-4" />
              Execution needs attention
            </div>
            <ul className="mt-2 list-disc pl-6 text-sm text-amber-800 dark:text-amber-200">
              {reasons.map((r) => (
                <li key={r}>{attentionLabel(r)}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Jobs */}
        {jobs.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Jobs</h3>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Lease expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job, i) => (
                  <TableRow key={job.id ?? i}>
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
                      {job.attemptCount ?? job.retryCount ?? 0}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(job.startedAt ?? job.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-sm">
                      {job.leaseExpiresAt ? (
                        formatDate(job.leaseExpiresAt)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        )}

        {/* Frozen execution plan */}
        <Section title="Frozen execution plan">
          {planQ.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : !plan?.known ? (
            <p className="text-sm text-muted-foreground">
              No frozen plan recorded — legacy request or not yet approved.
            </p>
          ) : (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                Plan {plan.plan?.id} · planned {formatDate(plan.plan?.plannedAt)}
                · type {plan.plan?.typeCode}
              </p>
              <ol className="flex flex-col gap-1.5">
                {(plan.plan?.actions ?? []).map((a, i) => (
                  <li key={a.position ?? i} className="text-sm">
                    <span className="font-medium">
                      {(a.position ?? i) + 1}. {a.action}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      idem {a.idempotencyKey}
                      {a.correlationId ? ` · corr ${a.correlationId}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Section>

        {/* Approval roster */}
        <Section title="Approval roster">
          {participantsQ.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No roster recorded (legacy request).
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {participants.map((p, i) => (
                <li key={p.id ?? i} className="flex items-center gap-2 text-sm">
                  <span>User #{p.userId}</span>
                  {p.currentAssignment && (
                    <Badge variant="outline" className="text-xs">
                      current
                    </Badge>
                  )}
                  {p.assignedAt && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(p.assignedAt)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Operator recovery history */}
        {canReadRecoveries === true && (
          <Section title="Operator recovery history">
            {recoveriesQ.isPending ? (
              <Skeleton className="h-10 w-full" />
            ) : recoveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recovery actions recorded.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {recoveries.map((r, i) => (
                  <li key={r.id ?? i} className="text-sm">
                    <span className="font-medium">
                      Episode {r.blockEpisode ?? "—"}
                    </span>{" "}
                    — {r.reason}
                    <span className="ml-2 text-xs text-muted-foreground">
                      user #{r.actorId} · {formatDate(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {/* Recovery console (execution:read) */}
        {canReadRecovery === true && (
          <Section title="Recovery console">
            <RecoveryConsole
              requestId={requestId}
              requestVersion={request.version ?? 0}
              canReconcile={canReconcile}
              canRetry={canRetry}
            />
          </Section>
        )}
      </CardContent>
    </Card>
  )
}
