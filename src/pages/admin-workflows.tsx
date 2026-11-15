import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { cn } from "cn"
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react"
import {
  adminApi,
  type WorkflowResponse,
} from "@/api/endpoints"
import {
  apiErrorText,
  fieldErrors,
  generalError,
  isClientError,
} from "@/api/error-text"
import { ErrorBanner, FieldError } from "@/components/field-error"
import { PageHeader } from "@/components/page"
import { Spinner } from "@/components/spinner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Textarea } from "@/components/ui/textarea"

type CompletionRule = "ANY_OF" | "ALL_OF" | "K_OF_N"

interface StepForm {
  code: string
  name: string
  requiredRole: string
  completionRule: CompletionRule
  requiredApprovals: string
  slaMinutes: string
  escalationRole: string
  terminal: boolean
  condition: string
}
interface WorkflowFormState {
  code: string
  name: string
  description: string
  active: boolean
  steps: StepForm[]
}

const EMPTY_STEP: StepForm = {
  code: "",
  name: "",
  requiredRole: "",
  completionRule: "ANY_OF",
  requiredApprovals: "1",
  slaMinutes: "",
  escalationRole: "",
  terminal: false,
  condition: "",
}

const EMPTY_FORM: WorkflowFormState = {
  code: "",
  name: "",
  description: "",
  active: true,
  steps: [{ ...EMPTY_STEP }],
}

export function AdminWorkflowsPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<WorkflowFormState>(EMPTY_FORM)
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)

  /** Show API errors inline; only toast when there is nothing to show inline. */
  const fail = (err: unknown) => {
    setFieldErrs(fieldErrors(err))
    setBanner(generalError(err))
    if (!isClientError(err)) toast.error(apiErrorText(err))
  }
  /** Update top-level form + clear the inline error for the touched field. */
  const update = (patch: Partial<WorkflowFormState>) => {
    setForm((f) => ({ ...f, ...patch }))
    setFieldErrs((fe) => {
      const next = { ...fe }
      for (const key of Object.keys(patch)) delete next[key]
      return next
    })
  }
  /** Inline errors for step `i`, keyed by the step field name. */
  const stepErrs = (i: number) => {
    const prefix = `steps[${i}].`
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(fieldErrs)) {
      if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v
    }
    return out
  }
  /** Step indices changed (add/remove/move) — drop stale per-step errors. */
  const clearStepErrors = () =>
    setFieldErrs((fe) => {
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(fe)) {
        if (!/^steps\[\d+\]\./.test(k)) next[k] = v
      }
      return next
    })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "workflows"] })
    queryClient.invalidateQueries({ queryKey: ["workflows"] })
  }

  const { data, isPending } = useQuery({
    queryKey: ["admin", "workflows"],
    queryFn: () => adminApi.workflows({ size: 100 }),
    staleTime: 60_000,
  })

  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: () => adminApi.roles({ size: 100 }),
    staleTime: 5 * 60_000,
  })
  const roles = (rolesData?.content ?? []).filter((r) => r.code !== undefined)

  const createMutation = useMutation({
    mutationFn: () => adminApi.createWorkflow(serialize(form)),
    onSuccess: () => {
      toast.success("Workflow created")
      setDialogOpen(false)
      invalidate()
    },
    onError: fail,
  })
  const updateMutation = useMutation({
    mutationFn: () => adminApi.updateWorkflow(editingId as number, serialize(form)),
    onSuccess: () => {
      toast.success("Workflow updated")
      setDialogOpen(false)
      invalidate()
    },
    onError: fail,
  })

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFieldErrs({})
    setBanner(null)
    setDialogOpen(true)
  }
  const openEdit = (w: WorkflowResponse) => {
    setEditingId(w.id ?? null)
    setFieldErrs({})
    setBanner(null)
    setForm({
      code: w.code ?? "",
      name: w.name ?? "",
      description: w.description ?? "",
      active: w.active !== false,
      steps: (w.steps ?? []).map((s) => ({
        code: s.code ?? "",
        name: s.name ?? "",
        requiredRole: s.requiredRole ?? "",
        completionRule: (s.rule as CompletionRule) ?? "ANY_OF",
        requiredApprovals: s.requiredApprovals !== undefined ? String(s.requiredApprovals) : "1",
        slaMinutes: s.slaMinutes !== undefined ? String(s.slaMinutes) : "",
        escalationRole: s.escalationRole ?? "",
        terminal: s.terminal === true,
        condition: s.condition ? JSON.stringify(s.condition, null, 2) : "",
      })),
    })
    setDialogOpen(true)
  }

  const setStep = (i: number, patch: Partial<StepForm>) => {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }))
    setFieldErrs((fe) => {
      const next = { ...fe }
      for (const k of Object.keys(patch)) delete next[`steps[${i}].${k}`]
      return next
    })
  }
  const removeStep = (i: number) => {
    setForm((f) => ({
      ...f,
      steps: f.steps.filter((_, idx) => idx !== i),
    }))
    clearStepErrors()
  }
  const moveStep = (i: number, dir: -1 | 1) => {
    setForm((f) => {
      const j = i + dir
      if (j < 0 || j >= f.steps.length) return f
      const steps = [...f.steps]
      ;[steps[i], steps[j]] = [steps[j], steps[i]]
      return { ...f, steps }
    })
    clearStepErrors()
  }

  const workflows = data?.content ?? []
  if (isPending && workflows.length === 0) {
    return <Spinner label="Loading workflows…" />
  }

  const formValid =
    form.code.trim() !== "" &&
    form.name.trim() !== "" &&
    form.steps.length > 0 &&
    form.steps.every((s) => s.code.trim() !== "" && s.name.trim() !== "" && s.requiredRole.trim() !== "")

  return (
    <div>
      <PageHeader
        title="Workflows"
        description="Approval step definitions applied to request types."
        actions={
          <Button onClick={openCreate}>
            <Plus />
            New workflow
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        {workflows.map((w) => (
          <div
            key={w.id ?? w.code}
            className="flex flex-col gap-3 rounded-lg border p-5 lg:flex-row lg:items-start lg:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{w.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {w.code}
                </span>
                <Badge variant={w.active ? "outline" : "destructive"}>
                  {w.active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="secondary">{(w.steps ?? []).length} steps</Badge>
              </div>
              {w.description && (
                <div className="mt-1 text-sm text-muted-foreground">{w.description}</div>
              )}
              <ol className="mt-3 flex flex-col gap-2">
                {(w.steps ?? []).map((s, i) => (
                  <li
                    key={s.id ?? i}
                    className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {s.position ?? i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {s.name}
                          {s.terminal && (
                            <span className="ml-2 text-xs text-muted-foreground">(terminal)</span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          Role: {s.requiredRole}
                          {s.rule ? ` · ${s.rule}` : ""}
                          {s.requiredApprovals ? ` · ${s.requiredApprovals} approvals` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {s.slaMinutes ? <Badge variant="secondary">SLA {s.slaMinutes}m</Badge> : null}
                      {s.escalationRole ? (
                        <Badge variant="outline">Escalate → {s.escalationRole}</Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>
                <Pencil />
                Edit
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl grid-rows-[auto_1fr_auto] max-h-[calc(100dvh-3rem)] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {editingId === null ? "New workflow" : "Edit workflow"}
            </DialogTitle>
            <DialogDescription>
              Steps run in order. K_OF_N requires the approvals count; the
              terminal step ends the workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
            <ErrorBanner message={banner} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="wf-code">
                  Code{" "}
                  <span className="text-xs text-muted-foreground">(immutable key)</span>
                </Label>
                <Input
                  id="wf-code"
                  placeholder="EXPENSE_5K"
                  value={form.code}
                  aria-invalid={!!fieldErrs.code}
                  aria-describedby={fieldErrs.code ? "wf-code-error" : undefined}
                  onChange={(e) =>
                    update({ code: e.target.value.toUpperCase() })
                  }
                />
                <FieldError id="wf-code-error" message={fieldErrs.code} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wf-name">Name</Label>
                <Input
                  id="wf-name"
                  placeholder="Expense under 5k"
                  value={form.name}
                  aria-invalid={!!fieldErrs.name}
                  aria-describedby={fieldErrs.name ? "wf-name-error" : undefined}
                  onChange={(e) => update({ name: e.target.value })}
                />
                <FieldError id="wf-name-error" message={fieldErrs.name} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="wf-desc">Description</Label>
              <Textarea
                id="wf-desc"
                rows={2}
                value={form.description}
                aria-invalid={!!fieldErrs.description}
                aria-describedby={fieldErrs.description ? "wf-desc-error" : undefined}
                onChange={(e) => update({ description: e.target.value })}
              />
              <FieldError id="wf-desc-error" message={fieldErrs.description} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="wf-active"
                checked={form.active}
                onCheckedChange={(v) => update({ active: v === true })}
              />
              <Label htmlFor="wf-active">Active</Label>
              <FieldError message={fieldErrs.active} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>
                Steps{" "}
                <span className="text-xs text-muted-foreground">
                  (in execution order)
                </span>
              </Label>
              <div className="flex flex-col gap-3">
                {form.steps.map((s, i) => {
                  const se = stepErrs(i)
                  const hasErr = Object.keys(se).length > 0
                  return (
                  <div key={i} className={cn(
                    "flex flex-col gap-3 rounded-md border p-3",
                    hasErr && "border-destructive/50"
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Step {i + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={i === 0}
                          onClick={() => moveStep(i, -1)}
                          title="Move up"
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={i === form.steps.length - 1}
                          onClick={() => moveStep(i, 1)}
                          title="Move down"
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          disabled={form.steps.length <= 1}
                          onClick={() => removeStep(i)}
                          title="Remove step"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs">Code</Label>
                        <Input
                          className="font-mono text-xs"
                          placeholder="MANAGER_APPROVAL"
                          value={s.code}
                          aria-invalid={!!se.code}
                          onChange={(e) =>
                            setStep(i, { code: e.target.value.toUpperCase() })
                          }
                        />
                        <FieldError message={se.code} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs">Name</Label>
                        <Input
                          placeholder="Manager approval"
                          value={s.name}
                          aria-invalid={!!se.name}
                          onChange={(e) => setStep(i, { name: e.target.value })}
                        />
                        <FieldError message={se.name} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs">Required role</Label>
                        <Select
                          value={s.requiredRole || "none"}
                          onValueChange={(v) =>
                            setStep(i, { requiredRole: v === "none" ? "" : v })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Choose a role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {roles.map((r) => (
                              <SelectItem key={r.code} value={r.code as string}>
                                {r.name} ({r.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError message={se.requiredRole} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs">Completion rule</Label>
                        <div className="flex items-center gap-3">
                          <Select
                            value={s.completionRule}
                            onValueChange={(v) =>
                              setStep(i, { completionRule: v as CompletionRule })
                            }
                          >
                            <SelectTrigger className="h-8 w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ANY_OF">ANY_OF</SelectItem>
                              <SelectItem value="ALL_OF">ALL_OF</SelectItem>
                              <SelectItem value="K_OF_N">K_OF_N</SelectItem>
                            </SelectContent>
                          </Select>
                          {s.completionRule === "K_OF_N" && (
                            <Input
                              className="h-8 w-24"
                              type="number"
                              min={1}
                              placeholder="approvals"
                              value={s.requiredApprovals}
                              onChange={(e) =>
                                setStep(i, { requiredApprovals: e.target.value })
                              }
                            />
                          )}
                        </div>
                        <FieldError message={se.completionRule ?? se.requiredApprovals} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs">SLA (minutes, optional)</Label>
                        <Input
                          className="h-8"
                          type="number"
                          min={1}
                          placeholder="e.g. 1440"
                          value={s.slaMinutes}
                          onChange={(e) => setStep(i, { slaMinutes: e.target.value })}
                        />
                        <FieldError message={se.slaMinutes} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs">Escalation role (optional)</Label>
                        <Select
                          value={s.escalationRole || "none"}
                          onValueChange={(v) =>
                            setStep(i, { escalationRole: v === "none" ? "" : v })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {roles.map((r) => (
                              <SelectItem key={r.code} value={r.code as string}>
                                {r.name} ({r.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError message={se.escalationRole} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`wf-terminal-${i}`}
                        checked={s.terminal}
                        onCheckedChange={(v) =>
                          setStep(i, { terminal: v === true })
                        }
                      />
                      <Label htmlFor={`wf-terminal-${i}`} className="text-xs">
                        Terminal step (ends the workflow)
                      </Label>
                      <FieldError message={se.terminal} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs">
                        Condition (JSON, optional){" "}
                        <span className="text-muted-foreground">
                          evaluated against the request payload
                        </span>
                      </Label>
                      <Textarea
                        className="font-mono text-xs"
                        rows={2}
                        placeholder='e.g. {"amount": {"lt": 5000}}'
                        value={s.condition}
                        onChange={(e) => setStep(i, { condition: e.target.value })}
                      />
                      <FieldError message={se.condition} />
                    </div>
                  </div>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    steps: [...f.steps, { ...EMPTY_STEP }],
                  }))
                }
              >
                <Plus />
                Add step
              </Button>
            </div>
            <Separator />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!serializeChecked(form)) return
                if (editingId === null) createMutation.mutate()
                else updateMutation.mutate()
              }}
              disabled={
                !formValid || createMutation.isPending || updateMutation.isPending
              }
            >
              {editingId === null ? "Create workflow" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Validates that condition JSON (if any) parses; toasts and blocks otherwise. */
function serializeChecked(f: WorkflowFormState): boolean {
  for (const [i, s] of f.steps.entries()) {
    if (!s.condition.trim()) continue
    try {
      const parsed = JSON.parse(s.condition)
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("must be a JSON object")
      }
    } catch (e) {
      toast.error(`Step ${i + 1}: invalid condition JSON — ${e instanceof Error ? e.message : "parse error"}`)
      return false
    }
  }
  return true
}

function serialize(f: WorkflowFormState): {
  code: string
  name: string
  description?: string
  active?: boolean
  steps: {
    position: number
    code: string
    name: string
    requiredRole: string
    completionRule: CompletionRule
    requiredApprovals?: number
    slaMinutes?: number
    escalationRole?: string
    terminal?: boolean
    condition?: Record<string, unknown>
  }[]
} {
  return {
    code: f.code.trim(),
    name: f.name.trim(),
    description: f.description.trim() || undefined,
    active: f.active,
    steps: f.steps.map((s, i) => {
      const step: {
        position: number
        code: string
        name: string
        requiredRole: string
        completionRule: CompletionRule
        requiredApprovals?: number
        slaMinutes?: number
        escalationRole?: string
        terminal?: boolean
        condition?: Record<string, unknown>
      } = {
        position: i + 1,
        code: s.code.trim(),
        name: s.name.trim(),
        requiredRole: s.requiredRole,
        completionRule: s.completionRule,
      }
      if (s.completionRule === "K_OF_N" && s.requiredApprovals !== "") {
        const k = Number(s.requiredApprovals)
        if (!Number.isNaN(k) && k >= 1) step.requiredApprovals = k
      }
      if (s.slaMinutes !== "") {
        const m = Number(s.slaMinutes)
        if (!Number.isNaN(m) && m >= 1) step.slaMinutes = m
      }
      if (s.escalationRole) step.escalationRole = s.escalationRole
      step.terminal = s.terminal
      if (s.condition.trim()) {
        try {
          step.condition = JSON.parse(s.condition)
        } catch {
          // Guarded by serializeChecked() before this runs.
        }
      }
      return step
    }),
  }
}
