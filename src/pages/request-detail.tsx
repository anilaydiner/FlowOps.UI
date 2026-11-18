import { useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Copy,
  MessageSquare,
  Pencil,
  Send,
  XCircle,
} from "lucide-react"
import {
  adminApi,
  requestsApi,
  type DecisionRequest,
  type RequestResponse,
  type StepDto,
} from "@/api/endpoints"
import { apiErrorText, generalError, isClientError } from "@/api/error-text"
import {
  canAct,
  extractAmount,
  type DecisionTarget,
} from "@/api/authorization"
import { formatDate } from "@/lib/format"
import { hasExecution } from "@/lib/execution"
import { useAuth } from "@/auth/auth"
import { PageHeader } from "@/components/page"
import { ExecutionCard } from "@/components/execution-card"
import { DynamicPayloadForm } from "@/components/dynamic-payload-form"
import { ActionBadge, StatusBadge, StepBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const requestId = Number(id)
  const { user, isAdmin } = useAuth()
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["request", requestId] })
    queryClient.invalidateQueries({ queryKey: ["requests"] })
    queryClient.invalidateQueries({ queryKey: ["queue"] })
  }

  const { data: req, isPending, error } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => requestsApi.get(requestId),
    enabled: Number.isFinite(requestId),
    staleTime: 5_000,
  })

  const [editingDraft, setEditingDraft] = useState(false)
  const [auditType, setAuditType] = useState("")
  const [auditFrom, setAuditFrom] = useState("")
  const [auditTo, setAuditTo] = useState("")

  const { data: audit, isFetching: auditFetching } = useQuery({
    queryKey: ["request-audit", requestId, auditType, auditFrom, auditTo],
    queryFn: () =>
      requestsApi.audit(requestId, {
        ...(auditType ? { type: auditType } : {}),
        ...(auditFrom
          ? { from: new Date(auditFrom).toISOString() }
          : {}),
        ...(auditTo ? { to: new Date(auditTo).toISOString() } : {}),
      }),
    enabled: Number.isFinite(requestId),
    staleTime: 15_000,
  })

  // Request type config (requiredFields + validationRules) for draft editing.
  const { data: typesData } = useQuery({
    queryKey: ["request-types"],
    queryFn: () => adminApi.requestTypes(),
    staleTime: 5 * 60_000,
  })

  const [decideOpen, setDecideOpen] = useState(false)
  const [action, setAction] = useState<DecisionRequest["action"]>("APPROVE")
  const [justification, setJustification] = useState("")
  const [delegatedTo, setDelegatedTo] = useState<string>("")
  const [clarification, setClarification] = useState("")
  const [pendingAnswers, setPendingAnswers] = useState<Record<number, string>>({})
  const [decideErr, setDecideErr] = useState<string | null>(null)

  // Delegate candidates for the DELEGATE picker: only users who would pass
  // the same approval gate for THIS request (server-enforced — the raw users
  // endpoint is not used, so out-of-scope / junior / requester are excluded).
  // Fetched lazily, only while the picker is relevant.
  const delegatees = useQuery({
    queryKey: ["eligible-delegatees", requestId],
    queryFn: () => requestsApi.eligibleDelegatees(requestId),
    enabled: decideOpen && action === "DELEGATE" && Number.isFinite(requestId),
    staleTime: 30_000,
  })

  const requestRef = req as RequestResponse | undefined

  const isRequester =
    user?.id !== undefined &&
    requestRef?.requester?.id === user.id
  const currentStep = (requestRef?.steps ?? []).find((s) => s.state === "PENDING")

  // ── Decision gate (permission-based, mirrors the server) ────────────────
  // The backend authorizes actions through permission + scope + SoD — not
  // through role codes. So we derive the user's effective permission set
  // from their roles (catalogs below) and evaluate it against THIS request,
  // instead of matching user.roles against the step's requiredRole. That
  // automatically covers delegatees too: the delegation gate requires the
  // delegatee to hold the same approval permission, so they pass here as
  // well. Catalogs are cached under the shared ["roles"] / ["permissions"]
  // keys used by the admin pages.
  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: () => adminApi.roles({ size: 100 }),
    staleTime: 5 * 60_000,
  })
  const { data: permsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => adminApi.permissions({ size: 200 }),
    staleTime: 5 * 60_000,
  })

  const decisionTarget = useMemo<DecisionTarget | null>(() => {
    if (!requestRef) return null
    return {
      requesterId: requestRef.requester?.id ?? null,
      typeCode: requestRef.typeCode ?? null,
      departmentCode: requestRef.departmentCode ?? null,
      stepCode: currentStep?.code ?? null,
      amount: extractAmount(requestRef.payload ?? null),
    }
  }, [requestRef, currentStep])

  const canApprove = useMemo(
    () =>
      user !== undefined &&
      decisionTarget !== null &&
      canAct(
        user,
        rolesData?.content ?? [],
        permsData?.content ?? [],
        "request:approve",
        decisionTarget,
      ),
    [user, decisionTarget, rolesData, permsData],
  )
  const canReject = useMemo(
    () =>
      user !== undefined &&
      decisionTarget !== null &&
      canAct(
        user,
        rolesData?.content ?? [],
        permsData?.content ?? [],
        "request:reject",
        decisionTarget,
      ),
    [user, decisionTarget, rolesData, permsData],
  )

  const canDecide =
    requestRef !== undefined &&
    requestRef.status === "IN_REVIEW" &&
    currentStep !== undefined &&
    (canApprove || canReject)

  // Operator recovery history is gated by request:blocked:read.
  const canReadRecoveries = useMemo(
    () =>
      user !== undefined &&
      decisionTarget !== null &&
      canAct(
        user,
        rolesData?.content ?? [],
        permsData?.content ?? [],
        "request:blocked:read",
        decisionTarget,
      ),
    [user, decisionTarget, rolesData, permsData],
  )

  // Recovery console is gated by execution:read / execution:reconcile / execution:retry.
  const canReadRecovery = useMemo(
    () =>
      user !== undefined &&
      decisionTarget !== null &&
      canAct(
        user,
        rolesData?.content ?? [],
        permsData?.content ?? [],
        "execution:read",
        decisionTarget,
      ),
    [user, decisionTarget, rolesData, permsData],
  )
  const canReconcile = useMemo(
    () =>
      user !== undefined &&
      decisionTarget !== null &&
      canAct(
        user,
        rolesData?.content ?? [],
        permsData?.content ?? [],
        "execution:reconcile",
        decisionTarget,
      ),
    [user, decisionTarget, rolesData, permsData],
  )
  const canRetry = useMemo(
    () =>
      user !== undefined &&
      decisionTarget !== null &&
      canAct(
        user,
        rolesData?.content ?? [],
        permsData?.content ?? [],
        "execution:retry",
        decisionTarget,
      ),
    [user, decisionTarget, rolesData, permsData],
  )

  const submitMutation = useMutation({
    mutationFn: () => requestsApi.submit(requestId),
    onSuccess: () => {
      toast.success("Request submitted for approval")
      invalidate()
    },
    onError: (err) => toast.error(apiErrorText(err)),
  })
  const cancelMutation = useMutation({
    mutationFn: () => requestsApi.cancel(requestId),
    onSuccess: () => {
      toast.success("Request cancelled")
      invalidate()
    },
    onError: (err) => toast.error(apiErrorText(err)),
  })
  const closeMutation = useMutation({
    mutationFn: () => requestsApi.close(requestId),
    onSuccess: () => {
      toast.success("Request closed")
      invalidate()
    },
    onError: (err) => toast.error(apiErrorText(err)),
  })
  const saveDraftMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      requestsApi.updateDraft(requestId, payload),
    onSuccess: () => {
      toast.success("Draft updated")
      setEditingDraft(false)
      invalidate()
    },
    onError: (err) => toast.error(apiErrorText(err)),
  })
  const decideMutation = useMutation({
    mutationFn: () =>
      requestsApi.decide(requestId, {
        action,
        justification: justification.trim() || undefined,
        delegatedTo:
          action === "DELEGATE" && delegatedTo ? Number(delegatedTo) : undefined,
      }),
    onSuccess: () => {
      toast.success(`Decision recorded: ${action}`)
      setDecideOpen(false)
      setJustification("")
      setDelegatedTo("")
      setAction("APPROVE")
      setDecideErr(null)
      invalidate()
    },
    onError: (err) => {
      // 4xx (self-delegation, inactive, no permission, unknown user) → keep
      // the dialog open and show the reason inline; 5xx → toast and close.
      if (isClientError(err)) {
        setDecideErr(generalError(err) ?? apiErrorText(err))
      } else {
        toast.error(apiErrorText(err))
        setDecideOpen(false)
      }
    },
  })
  const clarificationMutation = useMutation({
    mutationFn: () => requestsApi.askClarification(requestId, clarification.trim()),
    onSuccess: () => {
      toast.success("Clarification requested")
      setClarification("")
      invalidate()
    },
    onError: (err) => toast.error(apiErrorText(err)),
  })
  const answerMutation = useMutation({
    mutationFn: (vars: { clarificationId: number; answer: string }) =>
      requestsApi.answerClarification(requestId, vars.clarificationId, vars.answer),
    onSuccess: () => {
      toast.success("Answer sent")
      setPendingAnswers({})
      invalidate()
    },
    onError: (err) => toast.error(apiErrorText(err)),
  })

  if (isPending) {
    return (
      <div>
        <Skeleton className="mb-4 h-10 w-64" />
        <Skeleton className="mb-4 h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (error || !requestRef) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-destructive">
          <XCircle className="size-5" />
          {(error as Error | undefined)?.message ?? "Request not found."}
        </CardContent>
      </Card>
    )
  }

  const status = requestRef.status ?? ""
  const canEditDraft =
    status === "DRAFT" && (isRequester || isAdmin)
  const draftType = typesData?.content?.find(
    (t) => t.code === requestRef.typeCode,
  )

  const copyCorrelationId = () => {
    void navigator.clipboard.writeText(requestRef.correlationId ?? "")
    toast.success("Correlation ID copied")
  }

  return (
    <div>
      <PageHeader
        title={`${requestRef.typeName} #${requestRef.id}`}
        description={`${requestRef.typeCode} · dept ${requestRef.departmentCode ?? "—"}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={copyCorrelationId}
              title="Copy correlation ID"
            >
              <Copy />
            </Button>
            {requestRef.status === "DRAFT" && (
              <>
                {canEditDraft && (
                  <Button
                    variant="outline"
                    onClick={() => setEditingDraft((v) => !v)}
                  >
                    <Pencil />
                    {editingDraft ? "Hide editor" : "Edit"}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Cancel this draft? This cannot be undone.")) {
                      cancelMutation.mutate()
                    }
                  }}
                  disabled={cancelMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                >
                  <Send />
                  Submit
                </Button>
              </>
            )}
            {canDecide && (
              <Button
                onClick={() => {
                  setDecideErr(null)
                  setAction(canApprove ? "APPROVE" : "REJECT")
                  setDecideOpen(true)
                }}
              >
                <CheckCircle2 />
                Make decision
              </Button>
            )}
            {(status === "EXECUTED" || status === "REJECTED") &&
              (isRequester || isAdmin) && (
                <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
                  Close request
                </Button>
              )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <StatusBadge status={status} />
        <span>
          Requester:{" "}
          <strong>
            {requestRef.requester?.displayName ?? requestRef.requester?.username}
          </strong>
        </span>
        <span>
          Created: {formatDate(requestRef.createdAt)}
        </span>
        {requestRef.submittedAt && (
          <span>Submitted: {formatDate(requestRef.submittedAt)}</span>
        )}
        <span className="font-mono text-xs text-muted-foreground">
          {requestRef.correlationId}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {editingDraft && canEditDraft ? "Edit draft" : "Details"}
              </CardTitle>
              <CardDescription>
                {editingDraft && canEditDraft
                  ? "Update the payload before submitting"
                  : "Submitted payload"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {editingDraft && canEditDraft ? (
                draftType ? (
                  <DynamicPayloadForm
                    type={draftType}
                    initial={requestRef.payload ?? {}}
                    submitting={saveDraftMutation.isPending}
                    submitLabel="Save draft"
                    onSubmit={(payload) => saveDraftMutation.mutate(payload)}
                    onCancel={() => setEditingDraft(false)}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Request type configuration is not available yet.
                  </p>
                )
              ) : (
              <dl className="flex flex-col gap-3">
                {Object.entries(requestRef.payload ?? {}).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      {key}
                    </dt>
                    <dd className="whitespace-pre-wrap break-words text-sm">
                      {typeof value === "object"
                        ? JSON.stringify(value, null, 2)
                        : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
              )}
            </CardContent>
          </Card>

          {(requestRef.clarifications?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Clarifications</CardTitle>
                <CardDescription>
                  Questions and answers about this request
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {requestRef.clarifications.map((c) => (
                  <div key={c.id} className="flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="mt-0.5 size-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{c.question}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.answer
                            ? "Answered"
                            : "Awaiting answer"}{" "}
                          · {formatDate(c.createdAt)}
                        </div>
                      </div>
                    </div>
                    {c.answer ? (
                      <div className="ml-6 rounded-md bg-muted p-3 text-sm">
                        {c.answer}
                      </div>
                    ) : (
                      (isRequester || isAdmin) && (
                        <div className="ml-6 flex flex-col gap-2">
                          <Textarea
                            rows={2}
                            placeholder="Write your answer…"
                            value={pendingAnswers[c.id ?? 0] ?? ""}
                            onChange={(e) =>
                              setPendingAnswers((p) => ({
                                ...p,
                                [c.id ?? 0]: e.target.value,
                              }))
                            }
                          />
                          <div>
                            <Button
                              size="sm"
                              onClick={() =>
                                answerMutation.mutate({
                                  clarificationId: c.id ?? 0,
                                  answer: (pendingAnswers[c.id ?? 0] ?? "").trim(),
                                })
                              }
                              disabled={
                                !(pendingAnswers[c.id ?? 0] ?? "").trim() ||
                                answerMutation.isPending
                              }
                            >
                              Send answer
                            </Button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ))}
                <Separator />
                <div className="flex flex-col gap-2">
                  <Textarea
                    rows={2}
                    placeholder="Ask a clarification question…"
                    value={clarification}
                    onChange={(e) => setClarification(e.target.value)}
                  />
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => clarificationMutation.mutate()}
                      disabled={!clarification.trim() || clarificationMutation.isPending}
                    >
                      Ask question
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Approval steps</CardTitle>
              <CardDescription>Workflow progress and decisions</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {(requestRef.steps ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {status === "DRAFT"
                    ? "Steps appear after the request is submitted."
                    : "No step data available."}
                </p>
              )}
              {(requestRef.steps ?? []).map((step) => (
                <StepCard key={step.id ?? step.position} step={step} />
              ))}
            </CardContent>
          </Card>

          {hasExecution(requestRef) && (
            <ExecutionCard
              requestId={requestId}
              request={requestRef}
              canReadRecoveries={canReadRecoveries}
              canReadRecovery={canReadRecovery}
              canReconcile={canReconcile}
              canRetry={canRetry}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Append-only audit trail</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={auditType || "all"}
                    onValueChange={(v) => setAuditType(v === "all" ? "" : v)}
                  >
                    <SelectTrigger className="h-8 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {["STATUS", "SUBMITTED", "DECISION", "JOB", "SLA"].map(
                        (t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="datetime-local"
                    className="h-8 w-auto"
                    value={auditFrom}
                    onChange={(e) => setAuditFrom(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="datetime-local"
                    className="h-8 w-auto"
                    value={auditTo}
                    onChange={(e) => setAuditTo(e.target.value)}
                  />
                </div>
                {(auditType || auditFrom || auditTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setAuditType("")
                      setAuditFrom("")
                      setAuditTo("")
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
              <div className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
                {(audit ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {auditFetching
                      ? "Loading events…"
                      : "No events match."}
                  </p>
                )}
                {(audit ?? []).map((evt, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <EventIcon type={evt.type} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">
                        {formatDate(evt.at)}
                        {evt.actor ? ` · ${evt.actor}` : ""}
                      </div>
                      <div>{evt.summary}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={decideOpen} onOpenChange={setDecideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make a decision</DialogTitle>
            <DialogDescription>
              {currentStep
                ? `Step: ${currentStep.name} (role ${currentStep.requiredRole})`
                : "Decide on this request"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {decideErr && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {decideErr}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(["APPROVE", "REJECT", "DELEGATE", "OVERRIDE"] as const).map((a) => {
                // Same gate the server applies: APPROVE/DELEGATE need
                // request:approve (scope-matched), REJECT needs
                // request:reject. OVERRIDE is not implemented yet (409).
                const allowed =
                  a === "APPROVE" || a === "DELEGATE"
                    ? canApprove
                    : a === "REJECT"
                      ? canReject
                      : false
                return (
                  <Button
                    key={a}
                    size="sm"
                    variant={action === a ? "default" : "outline"}
                    disabled={!allowed}
                    title={
                      allowed
                        ? undefined
                        : "You don't have permission for this action on this request"
                    }
                    onClick={() => setAction(a)}
                  >
                    {a}
                  </Button>
                )
              })}
            </div>
            {action === "DELEGATE" && (
              <div className="flex flex-col gap-2">
                <Label>Delegate to</Label>
                <Select
                  value={delegatedTo}
                  onValueChange={setDelegatedTo}
                  disabled={delegatees.isPending}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        delegatees.isPending ? "Loading eligible users…" : "Choose a user"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(delegatees.data ?? []).map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.displayName ?? u.username}
                        {u.departmentCode ? ` (${u.departmentCode})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {delegatees.isError && (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    {apiErrorText(delegatees.error)}
                  </p>
                )}
                {!delegatees.isPending &&
                  !delegatees.isError &&
                  (delegatees.data ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No other user is eligible to take this decision.
                    </p>
                  )}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>
                Justification{" "}
                {(action === "REJECT" || action === "OVERRIDE") && (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              <Textarea
                rows={3}
                placeholder="Explain your decision (visible in the audit trail)"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecideOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => decideMutation.mutate()}
              disabled={
                decideMutation.isPending ||
                ((action === "REJECT" || action === "OVERRIDE") &&
                  !justification.trim()) ||
                (action === "DELEGATE" && !delegatedTo)
              }
            >
              Confirm {action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StepCard({ step }: { step: StepDto }) {
  const state = step.state ?? ""
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {step.position ?? "?"}
            </span>
            <span className="font-medium">{step.name}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Role: {step.requiredRole}
            {step.rule ? ` · ${step.rule}` : ""}
            {step.requiredApprovals ? ` · ${step.requiredApprovals} approvals` : ""}
          </div>
        </div>
        <StepBadge state={state} />
      </div>

      {(step.skipReason || step.blockedReason) && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {step.blockedReason ?? step.skipReason}
        </div>
      )}

      {(step.decisions?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {step.decisions.map((d, i) => (
            <div key={d.id ?? i} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ActionBadge action={d.action} />
                  <span>{d.actorUsername}</span>
                  {d.justification && (
                    <span className="truncate text-muted-foreground">
                      “{d.justification}”
                    </span>
                  )}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {formatDate(d.createdAt)}
                  {d.delegatedTo ? " · delegated" : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EventIcon({ type }: { type?: string }) {
  switch (type) {
    case "DECISION":
      return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
    case "JOB":
      return <CircleDashed className="mt-0.5 size-4 shrink-0 text-sky-600" />
    case "SLA":
      return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
    default:
      return <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
  }
}
