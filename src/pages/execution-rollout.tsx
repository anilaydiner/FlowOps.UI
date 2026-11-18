import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import {
  executionRolloutApi,
  type RolloutReport,
} from "@/api/endpoints"
import { apiErrorText } from "@/api/error-text"
import { formatDate } from "@/lib/format"
import { PageHeader } from "@/components/page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { XCircle as XIcon } from "lucide-react"

type Phase = "PRE_ENABLE" | "POST_ENABLE"

// ── Status badge for check rows ─────────────────────────────────
function CheckBadge({ status }: { status?: string }) {
  if (!status) return null
  const styles: Record<string, string> = {
    PASS: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    BLOCKER: "bg-red-500/10 text-red-600 dark:text-red-400",
    ATTENTION: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }
  const icons: Record<string, React.ReactNode> = {
    PASS: <CheckCircle2 className="size-3" />,
    BLOCKER: <XCircle className="size-3" />,
    ATTENTION: <AlertTriangle className="size-3" />,
  }
  return (
    <Badge variant="outline" className={`gap-1 text-xs ${styles[status] ?? ""}`}>
      {icons[status]}
      {status}
    </Badge>
  )
}

// ── Main page ────────────────────────────────────────────────────
export function ExecutionRolloutPage() {
  const [phase, setPhase] = useState<Phase>("PRE_ENABLE")

  const q = useQuery({
    queryKey: ["rollout-report", phase],
    queryFn: () => executionRolloutApi.check(phase),
    staleTime: 30_000,
    retry: false,
  })

  const report = q.data as RolloutReport | undefined

  // ── Error states ───────────────────────────────────────────────
  if (q.isError) {
    const msg = apiErrorText(q.error)
    const is403 = (q.error as { status?: number })?.status === 403
    return (
      <div>
        <PageHeader title="Execution Rollout" />
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            {is403 ? (
              <>
                <ShieldCheck className="size-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Access denied</p>
                  <p className="text-sm text-muted-foreground">
                    Requires <code className="rounded bg-muted px-1">execution:rollout:read</code> (global scope).
                  </p>
                </div>
              </>
            ) : (
              <>
                <XIcon className="size-5 text-destructive" />
                <p className="text-sm">{msg}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────
  if (q.isPending) {
    return (
      <div>
        <PageHeader
          title="Execution Rollout"
          description="Machine checks, provider contracts, and manual acceptance"
        />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (!report) return null

  const blockers = (report.checks ?? []).filter((c) => c.status === "BLOCKER")
  const attentions = (report.checks ?? []).filter((c) => c.status === "ATTENTION")
  const passes = (report.checks ?? []).filter((c) => c.status === "PASS")

  return (
    <div>
      <PageHeader
        title="Execution Rollout"
        description="Machine checks, provider contracts, and manual acceptance for the durable execution rollout"
        actions={
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            {(["PRE_ENABLE", "POST_ENABLE"] as Phase[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={phase === p ? "default" : "ghost"}
                className={phase === p ? "" : "text-muted-foreground"}
                onClick={() => setPhase(p)}
              >
                {p === "PRE_ENABLE" ? "Pre-enable" : "Post-enable"}
              </Button>
            ))}
          </div>
        }
      />

      {/* Overall status banner */}
      <div
        className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${
          report.machineChecksPassed
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950"
            : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950"
        }`}
      >
        {report.machineChecksPassed ? (
          <CheckCircle2
            className={`size-5 ${report.machineChecksPassed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          />
        ) : (
          <XCircle
            className={`size-5 ${report.machineChecksPassed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          />
        )}
        <div>
          <p className={`font-medium ${report.machineChecksPassed ? "text-emerald-800 dark:text-emerald-200" : "text-red-800 dark:text-red-200"}`}>
            {report.machineChecksPassed
              ? "All machine checks passed"
              : `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} · ${attentions.length} attention item${attentions.length === 1 ? "" : "s"}`}
          </p>
          <p className={`text-sm ${report.machineChecksPassed ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
            Phase: {report.phase} · Checked {formatDate(report.checkedAt)}
          </p>
        </div>
      </div>

      {/* Checks table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Machine checks</CardTitle>
          <CardDescription>
            {passes.length} pass · {attentions.length} attention · {blockers.length} blocker
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Check</TableHead>
                <TableHead className="text-center w-16">Count</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report.checks ?? []).map((c, i) => (
                <TableRow
                  key={c.code ?? i}
                  className={
                    c.status === "BLOCKER"
                      ? "bg-red-50/50 dark:bg-red-950/20"
                      : c.status === "ATTENTION"
                        ? "bg-amber-50/50 dark:bg-amber-950/20"
                        : ""
                  }
                >
                  <TableCell>
                    <CheckBadge status={c.status} />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{c.code}</span>
                  </TableCell>
                  <TableCell className="text-center text-sm">{c.count ?? 0}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.summary}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Provider contracts */}
      {(report.contracts ?? []).length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="size-4" />
              Provider contracts
            </CardTitle>
            <CardDescription>
              Declared timeout budgets and transport configuration per action
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(report.contracts ?? []).map((ct, i) => (
              <div
                key={ct.action ?? i}
                className="rounded-lg border bg-muted/30 p-3"
              >
                <p className="mb-2 font-medium">{ct.action}</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                  {Object.entries(ct.contract ?? {}).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="font-mono text-xs">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Manual acceptance */}
      {(report.manualAcceptanceRequired ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4" />
              Manual acceptance required
            </CardTitle>
            <CardDescription>
              These items require human sign-off outside the machine checks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {(report.manualAcceptanceRequired ?? []).map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
