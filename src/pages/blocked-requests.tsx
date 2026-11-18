import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import {
  requestsApi,
  type BlockedResponse,
  type BlockedListQuery,
} from "@/api/endpoints"
import { formatDate, formatRelative } from "@/lib/format"
import { PageHeader } from "@/components/page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

const PAGE_SIZE = 15

const BLOCK_REASONS = [
  "NO_ELIGIBLE_APPROVER",
  "INSUFFICIENT_QUORUM",
  "PARTICIPANT_UNAVAILABLE",
  "LEGACY_UNCLASSIFIED",
] as const

const REASON_STYLES: Record<string, string> = {
  NO_ELIGIBLE_APPROVER: "bg-red-500/10 text-red-600 dark:text-red-400",
  INSUFFICIENT_QUORUM: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PARTICIPANT_UNAVAILABLE:
    "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  LEGACY_UNCLASSIFIED:
    "bg-muted text-muted-foreground",
}

function ReasonBadge({ reason }: { reason?: string }) {
  if (!reason) return <span className="text-muted-foreground">—</span>
  return (
    <Badge
      variant="outline"
      className={REASON_STYLES[reason] ?? "bg-muted text-muted-foreground"}
    >
      {reason.replace(/_/g, " ")}
    </Badge>
  )
}

interface ActionTarget {
  requestId: number
  stepInstanceId: number
  expectedVersion: number
  stepCode: string
  reason: string
}

export function BlockedRequestsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [query, setQuery] = useState<BlockedListQuery>({
    reason: undefined,
    team: undefined,
    page: 1,
    size: PAGE_SIZE,
  })

  const setFilter = (patch: Partial<BlockedListQuery>) =>
    setQuery((q) => ({ ...q, ...patch, page: 1 }))

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["blocked", query],
    queryFn: () => requestsApi.blockedList(query),
    staleTime: 10_000,
  })

  // ── Recheck / Recover mutations ──────────────────────────────────
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null)
  const [actionType, setActionType] = useState<"recheck" | "recover">("recheck")
  const [reason, setReason] = useState("")
  const [refreshPool, setRefreshPool] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const invalidate = (requestId?: number) => {
    queryClient.invalidateQueries({ queryKey: ["blocked"] })
    queryClient.invalidateQueries({ queryKey: ["requests"] })
    if (requestId !== undefined) {
      queryClient.invalidateQueries({ queryKey: ["request", requestId] })
    }
  }

  const recheckMutation = useMutation({
    mutationFn: () =>
      requestsApi.recheck(actionTarget!.requestId, {
        stepInstanceId: actionTarget!.stepInstanceId,
        expectedVersion: actionTarget!.expectedVersion,
        reason,
      }),
    onSuccess: () => {
      toast.success("Step rechecked successfully")
      resetDialog()
      invalidate(actionTarget!.requestId)
    },
    onError: (e: Error) => setActionError(e.message),
  })

  const recoverMutation = useMutation({
    mutationFn: () =>
      requestsApi.recover(actionTarget!.requestId, {
        stepInstanceId: actionTarget!.stepInstanceId,
        expectedVersion: actionTarget!.expectedVersion,
        reason,
        refreshPool,
      }),
    onSuccess: () => {
      toast.success("Step recovered successfully")
      resetDialog()
      invalidate(actionTarget!.requestId)
    },
    onError: (e: Error) => setActionError(e.message),
  })

  const isDialogOpen = actionTarget !== null
  const isMutating = recheckMutation.isPending || recoverMutation.isPending

  const openDialog = (
    type: "recheck" | "recover",
    target: ActionTarget,
  ) => {
    setActionType(type)
    setActionTarget(target)
    setReason("")
    setRefreshPool(false)
    setActionError(null)
  }

  const resetDialog = () => {
    setActionTarget(null)
    setReason("")
    setRefreshPool(false)
    setActionError(null)
  }

  const handleAction = () => {
    if (!reason.trim()) {
      setActionError("Reason is required.")
      return
    }
    if (actionType === "recheck") recheckMutation.mutate()
    else recoverMutation.mutate()
  }

  // ── Table ────────────────────────────────────────────────────────
  const rows = data?.content ?? []
  const total = data?.totalElements ?? 0
  const page = data?.page ?? 1
  const pages = data?.totalPages ?? 0

  const columns: ColumnDef<BlockedResponse>[] = [
    {
      id: "request",
      header: "Request",
      size: 100,
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/requests/${row.original.request?.id}`)
            }}
          >
            #{row.original.request?.id}
          </button>
          {row.original.request?.typeName && (
            <div className="text-xs text-muted-foreground">
              {row.original.request.typeName}
            </div>
          )}
        </span>
      ),
    },
    {
      id: "step",
      header: "Step",
      size: 120,
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.block?.stepCode ?? "—"}
        </span>
      ),
    },
    {
      id: "reason",
      header: "Reason",
      cell: ({ row }) => (
        <ReasonBadge reason={row.original.block?.reason} />
      ),
    },
    {
      id: "team",
      header: "Team",
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.block?.team ?? "—"}
        </span>
      ),
    },
    {
      id: "episode",
      header: "Ep",
      size: 50,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.block?.episode ?? 1}
        </span>
      ),
    },
    {
      id: "blockedAt",
      header: "Blocked",
      size: 160,
      cell: ({ row }) => (
        <div className="text-right">
          <div>{formatDate(row.original.block?.blockedAt)}</div>
          <div className="text-xs text-muted-foreground">
            {formatRelative(row.original.block?.blockedAt)}
          </div>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      size: 180,
      cell: ({ row }) => {
        const block = row.original.block
        const request = row.original.request
        if (!block?.stepInstanceId || !request?.id) return null
        const target: ActionTarget = {
          requestId: request.id,
          stepInstanceId: block.stepInstanceId,
          expectedVersion: request.version ?? 0,
          stepCode: block.stepCode ?? "",
          reason: block.reason ?? "",
        }
        return (
          <div
            className="flex items-center justify-end gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDialog("recheck", target)}
            >
              <RotateCcw className="size-3.5" />
              Recheck
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDialog("recover", target)}
            >
              <CheckCircle2 className="size-3.5" />
              Recover
            </Button>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  // ── Error state ──────────────────────────────────────────────────
  if (isError) {
    const e = error as { message?: string; status?: number }
    const isForbidden = e.status === 403
    return (
      <div>
        <PageHeader
          title="Blocked Requests"
          description="Workflow steps waiting for operator intervention"
        />
        <Card>
          <CardContent className="p-6">
            {isForbidden ? (
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium">Access denied</p>
                  <p className="text-sm text-muted-foreground">
                    You need the <code>request:blocked:read</code> permission to
                    view this page.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-destructive">
                {e.message ?? "Failed to load blocked requests."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Blocked Requests"
        description="Workflow steps waiting for operator intervention"
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={query.reason ?? "all"}
          onValueChange={(v) =>
            setFilter({ reason: v === "all" ? undefined : v })
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All reasons" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reasons</SelectItem>
            {BLOCK_REASONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Filter by team…"
          className="w-44"
          value={query.team ?? ""}
          onChange={(e) =>
            setFilter({ team: e.target.value || undefined })
          }
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isPending ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead key={h.id}>
                        {h.isPlaceholder ? null : (
                          flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No blocked requests.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate(
                          `/requests/${row.original.request?.id}`,
                        )
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {total} blocked {total === 1 ? "step" : "steps"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() =>
              setQuery((q) => ({
                ...q,
                page: Math.max(1, (q.page ?? 1) - 1),
              }))
            }
          >
            <ArrowLeft />
          </Button>
          <span className="text-sm">
            Page {page} / {Math.max(pages, 1)}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= pages}
            onClick={() =>
              setQuery((q) => ({
                ...q,
                page: (q.page ?? 1) + 1,
              }))
            }
          >
            <ArrowRight />
          </Button>
        </div>
      </div>

      {/* Action dialog (Recheck / Recover) */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) resetDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "recheck" ? "Recheck Step" : "Recover Blocked Step"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "recheck"
                ? "Re-evaluate participant eligibility without reassignment. If the step becomes reachable, it will be restored to PENDING."
                : "Reassign participants and clear the block. Enable pool refresh to re-evaluate the full approval pool."}
            </DialogDescription>
          </DialogHeader>

          {actionTarget && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Request </span>
                  <span className="font-mono">#{actionTarget.requestId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Step </span>
                  <span className="font-medium">{actionTarget.stepCode}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Reason </span>
                  <ReasonBadge reason={actionTarget.reason} />
                </div>
                <div>
                  <span className="text-muted-foreground">Version </span>
                  <span className="font-mono">
                    {actionTarget.expectedVersion}
                  </span>
                </div>
              </div>

              {actionType === "recover" && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={refreshPool}
                    onChange={(e) => setRefreshPool(e.target.checked)}
                  />
                  Refresh approval pool
                </label>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="action-reason">Reason</Label>
                <Textarea
                  id="action-reason"
                  rows={3}
                  placeholder="Explain why this action is being taken…"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    setActionError(null)
                  }}
                />
              </div>

              {actionError && (
                <p className="text-sm text-destructive" role="alert">
                  {actionError}
                </p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={resetDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAction}
                  disabled={isMutating}
                >
                  {actionType === "recheck" ? (
                    <>
                      <RotateCcw className="size-4" />
                      {recheckMutation.isPending ? "Rechecking…" : "Recheck"}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      {recoverMutation.isPending ? "Recovering…" : "Recover"}
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
