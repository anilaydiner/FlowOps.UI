import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react"
import {
  adminApi,
  type PermissionResponse,
  type RoleResponse,
} from "@/api/endpoints"
import {
  apiErrorText,
  fieldErrors,
  generalError,
  isClientError,
} from "@/api/error-text"
import { ErrorBanner, FieldError } from "@/components/field-error"
import { formatDate } from "@/lib/format"
import { CardShell, PageHeader } from "@/components/page"
import { Spinner } from "@/components/spinner"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface RoleFormState {
  code: string
  name: string
  description: string
  permissions: string[]
}

const EMPTY_FORM: RoleFormState = {
  code: "",
  name: "",
  description: "",
  permissions: [],
}

export function AdminRolesPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM)
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)

  /** Show API errors inline; only toast when there is nothing to show inline. */
  const fail = (err: unknown) => {
    setFieldErrs(fieldErrors(err))
    setBanner(generalError(err))
    if (!isClientError(err)) toast.error(apiErrorText(err))
  }
  /** Update form + clear the inline error for the touched field. */
  const update = (patch: Partial<RoleFormState>) => {
    setForm((f) => ({ ...f, ...patch }))
    setFieldErrs((fe) => {
      const next = { ...fe }
      for (const key of Object.keys(patch)) delete next[key]
      return next
    })
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["roles"] })
    queryClient.invalidateQueries({ queryKey: ["permissions"] })
  }

  const { data: rolesData, isPending: rolesPending } = useQuery({
    queryKey: ["roles"],
    queryFn: () => adminApi.roles({ size: 100 }),
  })
  const roles = rolesData?.content ?? []

  const { data: permsData, isPending: permsPending } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => adminApi.permissions({ size: 200 }),
  })
  const permissions = (permsData?.content ?? []).filter(
    (p) => p.code !== undefined,
  ) as PermissionResponse[]

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createRole({
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        permissions: form.permissions,
      }),
    onSuccess: () => {
      toast.success("Role created")
      setDialogOpen(false)
      invalidate()
    },
    onError: fail,
  })
  const updateMutation = useMutation({
    mutationFn: () =>
      adminApi.updateRole(editingId as number, {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        permissions: form.permissions,
      }),
    onSuccess: () => {
      toast.success("Role updated")
      setDialogOpen(false)
      invalidate()
    },
    onError: fail,
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteRole(id),
    onSuccess: () => {
      toast.success("Role deleted")
      invalidate()
    },
    onError: (err) => toast.error(apiErrorText(err)),
  })

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFieldErrs({})
    setBanner(null)
    setDialogOpen(true)
  }
  const openEdit = (role: RoleResponse) => {
    setEditingId(role.id ?? null)
    setFieldErrs({})
    setBanner(null)
    setForm({
      code: role.code ?? "",
      name: role.name ?? "",
      description: role.description ?? "",
      permissions: role.permissions ?? [],
    })
    setDialogOpen(true)
  }
  const togglePermission = (code: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(code)
        ? f.permissions.filter((c) => c !== code)
        : [...f.permissions, code],
    }))
    setFieldErrs((fe) => {
      const next = { ...fe }
      delete next.permissions
      return next
    })
  }

  const confirmDelete = (role: RoleResponse) => {
    if (!confirm(`Delete role "${role.name ?? role.code}"? Users may lose access to protected areas.`)) return
    deleteMutation.mutate(role.id as number)
  }

  if (rolesPending || permsPending) {
    return <Spinner label="Loading roles…" />
  }

  const formValid = form.code.trim() !== "" && form.name.trim() !== ""

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Assign permission sets to roles. Roles drive step eligibility on the approval workflow."
        actions={
          <Button onClick={openCreate}>
            <Plus />
            New role
          </Button>
        }
      />

      <CardShell
        title="Roles"
        description={`${roles.length} role${roles.length === 1 ? "" : "s"}`}
      >
        <div className="flex flex-col gap-3">
          {roles.length === 0 && (
            <p className="text-sm text-muted-foreground">No roles defined yet.</p>
          )}
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  <span className="font-medium">{role.name}</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {role.code}
                  </Badge>
                </div>
                {role.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {role.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(role.permissions ?? []).length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No permissions
                    </span>
                  ) : (
                    (role.permissions ?? []).map((p) => (
                      <Badge key={p} variant="secondary" className="font-mono text-xs">
                        {p}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Created {role.createdAt ? formatDate(role.createdAt) : "—"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(role)}>
                  <Pencil />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => confirmDelete(role)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardShell>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId === null ? "New role" : "Edit role"}
            </DialogTitle>
            <DialogDescription>
              Roles control who can act on each approval step and which admin
              screens are visible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <ErrorBanner message={banner} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="role-code">
                  Code{" "}
                  <span className="text-xs text-muted-foreground">
                    (immutable key, e.g. MANAGER)
                  </span>
                </Label>
                <Input
                  id="role-code"
                  placeholder="MANAGER"
                  value={form.code}
                  aria-invalid={!!fieldErrs.code}
                  aria-describedby={fieldErrs.code ? "role-code-error" : undefined}
                  onChange={(e) =>
                    update({ code: e.target.value.toUpperCase() })
                  }
                />
                <FieldError id="role-code-error" message={fieldErrs.code} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="role-name">Display name</Label>
                <Input
                  id="role-name"
                  placeholder="Department Manager"
                  value={form.name}
                  aria-invalid={!!fieldErrs.name}
                  aria-describedby={fieldErrs.name ? "role-name-error" : undefined}
                  onChange={(e) => update({ name: e.target.value })}
                />
                <FieldError id="role-name-error" message={fieldErrs.name} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea
                id="role-desc"
                rows={2}
                placeholder="What this role can approve"
                value={form.description}
                aria-invalid={!!fieldErrs.description}
                aria-describedby={fieldErrs.description ? "role-desc-error" : undefined}
                onChange={(e) => update({ description: e.target.value })}
              />
              <FieldError id="role-desc-error" message={fieldErrs.description} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>
                Permissions{" "}
                <span className="text-xs text-muted-foreground">
                  ({form.permissions.length} selected)
                </span>
              </Label>
              <div className="max-h-48 flex-col gap-1 overflow-y-auto rounded-md border p-3">
                {permissions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No permissions available.
                  </p>
                )}
                {permissions.map((p) => (
                  <label
                    key={p.code}
                    className="flex cursor-pointer items-start gap-2 py-1"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={form.permissions.includes(p.code as string)}
                      onChange={() => togglePermission(p.code as string)}
                    />
                    <span className="min-w-0">
                      <span className="font-mono text-xs">{p.code}</span>
                      {p.description && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <FieldError message={fieldErrs.permissions} />
            </div>
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
              {editingId === null ? "Create role" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
