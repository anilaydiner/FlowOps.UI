import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Plus, Trash2 } from "lucide-react"
import {
  adminApi,
  type RequestTypeResponse,
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
import { Textarea } from "@/components/ui/textarea"

interface FieldDef {
  key: string
  label: string
}
interface RuleForm {
  type: "string" | "number"
  min: string
  max: string
  pattern: string
}
interface FormState {
  code: string
  name: string
  description: string
  departmentCode: string
  workflowCode: string
  active: boolean
  fields: FieldDef[]
  rules: Record<string, RuleForm>
}

const EMPTY_RULE: RuleForm = { type: "string", min: "", max: "", pattern: "" }

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  description: "",
  departmentCode: "",
  workflowCode: "",
  active: true,
  fields: [{ key: "", label: "" }],
  rules: {},
}

export function AdminRequestTypesPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)

  /** Show API errors inline; only toast when there is nothing to show inline. */
  const fail = (err: unknown) => {
    setFieldErrs(fieldErrors(err))
    setBanner(generalError(err))
    if (!isClientError(err)) toast.error(apiErrorText(err))
  }
  /** Update form + clear the inline error for the touched field. */
  const update = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }))
    setFieldErrs((fe) => {
      const next = { ...fe }
      for (const key of Object.keys(patch)) delete next[key]
      return next
    })
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "request-types"] })
    queryClient.invalidateQueries({ queryKey: ["request-types"] })
  }

  const { data, isPending } = useQuery({
    queryKey: ["admin", "request-types"],
    queryFn: () => adminApi.requestTypes(),
    staleTime: 60_000,
  })

  const { data: deptsData } = useQuery({
    queryKey: ["departments"],
    queryFn: () => adminApi.departments({ size: 100 }),
    staleTime: 5 * 60_000,
  })
  const departments = (deptsData?.content ?? []).filter((d) => d.code !== undefined)

  const { data: workflowsData } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => adminApi.workflows({ size: 100 }),
    staleTime: 5 * 60_000,
  })
  const workflows = (workflowsData?.content ?? []).filter((w) => w.code !== undefined)

  const createMutation = useMutation({
    mutationFn: () => adminApi.createRequestType(serialize(form)),
    onSuccess: () => {
      toast.success("Request type created")
      setDialogOpen(false)
      invalidate()
    },
    onError: fail,
  })
  const updateMutation = useMutation({
    mutationFn: () => adminApi.updateRequestType(editingId as number, serialize(form)),
    onSuccess: () => {
      toast.success("Request type updated")
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
  const openEdit = (t: RequestTypeResponse) => {
    setEditingId(t.id ?? null)
    setFieldErrs({})
    setBanner(null)
    const fields = Object.entries(t.requiredFields ?? {}).map(
      ([key, label]) => ({ key, label: String(label) }),
    )
    const rules: Record<string, RuleForm> = {}
    for (const f of fields) {
      const raw = (t.validationRules?.[f.key] ?? {}) as Record<string, unknown>
      rules[f.key] = {
        type: raw.type === "number" ? "number" : "string",
        min: raw.min !== undefined ? String(raw.min) : "",
        max: raw.max !== undefined ? String(raw.max) : "",
        pattern: raw.pattern !== undefined ? String(raw.pattern) : "",
      }
    }
    setForm({
      code: t.code ?? "",
      name: t.name ?? "",
      description: t.description ?? "",
      departmentCode: t.departmentCode ?? "",
      workflowCode: "",
      active: t.active !== false,
      fields: fields.length > 0 ? fields : [{ key: "", label: "" }],
      rules,
    })
    setDialogOpen(true)
  }

  const setField = (i: number, patch: Partial<FieldDef>) =>
    setForm((f) => {
      const fields = f.fields.map((fd, idx) => (idx === i ? { ...fd, ...patch } : fd))
      const rules = { ...f.rules }
      if (patch.key !== undefined && patch.key !== f.fields[i].key) {
        // Move the rule entry to the new key, dropping orphans.
        const oldKey = f.fields[i].key
        const next: Record<string, RuleForm> = {}
        for (const [k, r] of Object.entries(rules)) {
          if (k === oldKey && patch.key) next[patch.key] = r
          else if (k !== oldKey) next[k] = r
        }
        if (!patch.key) delete rules[oldKey]
        return { ...f, fields, rules: patch.key ? next : rules }
      }
      return { ...f, fields }
    })
  const removeField = (i: number) =>
    setForm((f) => {
      const key = f.fields[i].key
      const rules = { ...f.rules }
      if (key) delete rules[key]
      return {
        ...f,
        fields: f.fields.filter((_, idx) => idx !== i),
        rules,
      }
    })
  const setRule = (key: string, patch: Partial<RuleForm>) =>
    setForm((f) => ({
      ...f,
      rules: { ...f.rules, [key]: { ...(f.rules[key] ?? EMPTY_RULE), ...patch } },
    }))

  const types = data?.content ?? []
  if (isPending && types.length === 0) {
    return <Spinner label="Loading request types…" />
  }

  const validKeys = form.fields.map((f) => f.key).filter(Boolean)
  const formValid =
    form.code.trim() !== "" && form.name.trim() !== "" && validKeys.length > 0

  return (
    <div>
      <PageHeader
        title="Request Types"
        description="Configurable request types with required fields and validation rules."
        actions={
          <Button onClick={openCreate}>
            <Plus />
            New type
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        {types.map((t) => (
          <div
            key={t.id ?? t.code}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t.name}</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {t.code}
                </Badge>
                <Badge variant={t.active ? "outline" : "destructive"}>
                  {t.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {t.description && (
                <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.keys(t.requiredFields ?? {}).map((f) => (
                  <Badge key={f} variant="secondary" className="font-mono text-xs">
                    {f}
                  </Badge>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {t.departmentName ?? "no department"} ·{" "}
                {Object.keys(t.validationRules ?? {}).length} validation rule(s)
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                <Pencil />
                Edit
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId === null ? "New request type" : "Edit request type"}
            </DialogTitle>
            <DialogDescription>
              Required fields drive the request form; validation rules are
              enforced on the server and mirrored client-side.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <ErrorBanner message={banner} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rt-code">
                  Code{" "}
                  <span className="text-xs text-muted-foreground">(immutable key)</span>
                </Label>
                <Input
                  id="rt-code"
                  placeholder="EXPENSE"
                  value={form.code}
                  aria-invalid={!!fieldErrs.code}
                  aria-describedby={fieldErrs.code ? "rt-code-error" : undefined}
                  onChange={(e) =>
                    update({ code: e.target.value.toUpperCase() })
                  }
                />
                <FieldError id="rt-code-error" message={fieldErrs.code} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rt-name">Name</Label>
                <Input
                  id="rt-name"
                  placeholder="Expense Reimbursement"
                  value={form.name}
                  aria-invalid={!!fieldErrs.name}
                  aria-describedby={fieldErrs.name ? "rt-name-error" : undefined}
                  onChange={(e) => update({ name: e.target.value })}
                />
                <FieldError id="rt-name-error" message={fieldErrs.name} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rt-desc">Description</Label>
              <Textarea
                id="rt-desc"
                rows={2}
                value={form.description}
                aria-invalid={!!fieldErrs.description}
                aria-describedby={fieldErrs.description ? "rt-desc-error" : undefined}
                onChange={(e) => update({ description: e.target.value })}
              />
              <FieldError id="rt-desc-error" message={fieldErrs.description} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Owning department</Label>
                <Select
                  value={form.departmentCode || "none"}
                  onValueChange={(v) =>
                    update({ departmentCode: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.code} value={d.code as string}>
                        {d.name} ({d.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fieldErrs.departmentCode} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Approval workflow</Label>
                <Select
                  value={form.workflowCode || "none"}
                  onValueChange={(v) =>
                    update({ workflowCode: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {workflows.map((w) => (
                      <SelectItem key={w.code} value={w.code as string}>
                        {w.name} ({w.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fieldErrs.workflowCode} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="rt-active"
                checked={form.active}
                onCheckedChange={(v) => update({ active: v === true })}
              />
              <Label htmlFor="rt-active">Active</Label>
              <FieldError message={fieldErrs.active} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>
                Required fields{" "}
                <span className="text-xs text-muted-foreground">
                  (key + label shown in the form)
                </span>
              </Label>
              <div className="flex flex-col gap-2">
                {form.fields.map((fd, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      className="w-1/2 font-mono text-xs"
                      placeholder="key (e.g. amount)"
                      value={fd.key}
                      onChange={(e) =>
                        setField(i, { key: e.target.value.trim() })
                      }
                    />
                    <Input
                      className="w-1/2"
                      placeholder="Label (e.g. Expense amount)"
                      value={fd.label}
                      onChange={(e) => setField(i, { label: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={form.fields.length <= 1}
                      onClick={() => removeField(i)}
                      title="Remove field"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    fields: [...f.fields, { key: "", label: "" }],
                  }))
                }
              >
                <Plus />
                Add field
              </Button>
            </div>

            {validKeys.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>
                  Validation rules{" "}
                  <span className="text-xs text-muted-foreground">
                    (per field; blank = required string)
                  </span>
                </Label>
                <div className="flex flex-col gap-2 rounded-md border p-3">
                  <div className="grid grid-cols-[1fr_88px_64px_64px_1fr] gap-2 text-xs text-muted-foreground">
                    <span>Field</span>
                    <span>Type</span>
                    <span>Min</span>
                    <span>Max</span>
                    <span>Pattern (regex)</span>
                  </div>
                  {validKeys.map((key) => (
                    <div
                      key={key}
                      className="grid grid-cols-[1fr_88px_64px_64px_1fr] items-center gap-2"
                    >
                      <span className="truncate font-mono text-xs">{key}</span>
                      <Select
                        value={form.rules[key]?.type ?? "string"}
                        onValueChange={(v) =>
                          setRule(key, {
                            type: v as "string" | "number",
                            min: v === "string" ? "" : form.rules[key]?.min ?? "",
                            max: v === "string" ? "" : form.rules[key]?.max ?? "",
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">string</SelectItem>
                          <SelectItem value="number">number</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-8 text-xs"
                        placeholder="min"
                        value={form.rules[key]?.min ?? ""}
                        disabled={form.rules[key]?.type !== "number"}
                        onChange={(e) => setRule(key, { min: e.target.value })}
                      />
                      <Input
                        className="h-8 text-xs"
                        placeholder="max"
                        value={form.rules[key]?.max ?? ""}
                        disabled={form.rules[key]?.type !== "number"}
                        onChange={(e) => setRule(key, { max: e.target.value })}
                      />
                      <Input
                        className="h-8 font-mono text-xs"
                        placeholder="^[0-9]+d$"
                        value={form.rules[key]?.pattern ?? ""}
                        disabled={form.rules[key]?.type === "number"}
                        onChange={(e) => setRule(key, { pattern: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingId === null
                  ? createMutation.mutate()
                  : updateMutation.mutate()
              }
              disabled={
                !formValid || createMutation.isPending || updateMutation.isPending
              }
            >
              {editingId === null ? "Create type" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function serialize(f: FormState): {
  code: string
  name: string
  description?: string
  departmentCode?: string
  workflowCode?: string
  requiredFields: Record<string, string>
  validationRules: Record<string, unknown>
} {
  const requiredFields: Record<string, string> = {}
  for (const fd of f.fields) {
    if (fd.key) requiredFields[fd.key] = fd.label || fd.key
  }
  const validationRules: Record<string, unknown> = {}
  for (const key of Object.keys(requiredFields)) {
    const r = f.rules[key]
    if (!r) continue
    const rule: Record<string, unknown> = {}
    if (r.type === "number") {
      rule.type = "number"
      if (r.min !== "" && !Number.isNaN(Number(r.min))) rule.min = Number(r.min)
      if (r.max !== "" && !Number.isNaN(Number(r.max))) rule.max = Number(r.max)
    } else if (r.pattern.trim()) {
      rule.pattern = r.pattern.trim()
    }
    if (Object.keys(rule).length > 0) validationRules[key] = rule
  }
  return {
    code: f.code.trim(),
    name: f.name.trim(),
    description: f.description.trim() || undefined,
    departmentCode: f.departmentCode || undefined,
    workflowCode: f.workflowCode || undefined,
    requiredFields,
    validationRules,
  }
}
