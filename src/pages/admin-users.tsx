import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Trash2, UserPlus } from "lucide-react"
import {
  adminApi,
  type UserResponse,
} from "@/api/endpoints"
import {
  apiErrorText,
  fieldErrors,
  generalError,
  isClientError,
} from "@/api/error-text"
import { ErrorBanner, FieldError } from "@/components/field-error"
import { formatDate } from "@/lib/format"
import { PageHeader } from "@/components/page"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface UserFormState {
  username: string
  displayName: string
  email: string
  departmentCode: string
  roles: string[]
  password: string
}

const EMPTY_FORM: UserFormState = {
  username: "",
  displayName: "",
  email: "",
  departmentCode: "",
  roles: [],
  password: "",
}

export function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)

  /** Show API errors inline; only toast when there is nothing to show inline. */
  const fail = (err: unknown) => {
    setFieldErrs(fieldErrors(err))
    setBanner(generalError(err))
    if (!isClientError(err)) toast.error(apiErrorText(err))
  }
  /** Update form + clear the inline error for the touched field. */
  const update = (patch: Partial<UserFormState>) => {
    setForm((f) => ({ ...f, ...patch }))
    setFieldErrs((fe) => {
      const next = { ...fe }
      for (const key of Object.keys(patch)) delete next[key]
      return next
    })
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    queryClient.invalidateQueries({ queryKey: ["users"] })
  }

  const { data, isPending } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminApi.users({ size: 100 }),
    staleTime: 60_000,
  })

  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: () => adminApi.roles({ size: 100 }),
    staleTime: 5 * 60_000,
  })
  const roles = (rolesData?.content ?? []).filter((r) => r.code !== undefined)

  const { data: deptsData } = useQuery({
    queryKey: ["departments"],
    queryFn: () => adminApi.departments({ size: 100 }),
    staleTime: 5 * 60_000,
  })
  const departments = (deptsData?.content ?? []).filter((d) => d.code !== undefined)

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createUser({
        username: form.username.trim(),
        displayName: form.displayName.trim() || undefined,
        email: form.email.trim() || undefined,
        departmentCode: form.departmentCode || undefined,
        roles: form.roles,
        password: form.password,
      }),
    onSuccess: () => {
      toast.success("User created")
      setDialogOpen(false)
      invalidate()
    },
    onError: fail,
  })
  const updateMutation = useMutation({
    mutationFn: () =>
      adminApi.updateUser(editingId as number, {
        username: form.username.trim(),
        displayName: form.displayName.trim() || undefined,
        email: form.email.trim() || undefined,
        departmentCode: form.departmentCode || undefined,
        roles: form.roles,
        password: form.password || undefined,
      }),
    onSuccess: () => {
      toast.success("User updated")
      setDialogOpen(false)
      invalidate()
    },
    onError: fail,
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => {
      toast.success("User deleted")
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
  const openEdit = (u: UserResponse) => {
    setEditingId(u.id ?? null)
    setFieldErrs({})
    setBanner(null)
    setForm({
      username: u.username ?? "",
      displayName: u.displayName ?? "",
      email: u.email ?? "",
      departmentCode: u.departmentCode ?? "",
      roles: u.roles ?? [],
      password: "",
    })
    setDialogOpen(true)
  }
  const toggleRole = (code: string) => {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(code)
        ? f.roles.filter((c) => c !== code)
        : [...f.roles, code],
    }))
    setFieldErrs((fe) => {
      const next = { ...fe }
      delete next.roles
      return next
    })
  }
  const confirmDelete = (u: UserResponse) => {
    if (!confirm(`Delete user "${u.username}"?`)) return
    deleteMutation.mutate(u.id as number)
  }

  const users = data?.content ?? []
  if (isPending && users.length === 0) {
    return <Spinner label="Loading users…" />
  }

  const formValid =
    form.username.trim() !== "" &&
    (editingId === null ? form.password.length >= 6 : form.password === "" || form.password.length >= 6)

  return (
    <div>
      <PageHeader
        title="Users"
        description="Enterprise accounts, their departments, and roles."
        actions={
          <Button onClick={openCreate}>
            <UserPlus />
            New user
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{u.displayName ?? u.username}</span>
                <span className="text-xs text-muted-foreground">@{u.username}</span>
                <Badge variant={u.active ? "outline" : "destructive"}>
                  {u.active ? "Active" : "Disabled"}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {u.email ?? "no email"}
                {u.departmentName ? ` · ${u.departmentName}` : ""}
                {u.createdAt ? ` · created ${formatDate(u.createdAt)}` : ""}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(u.roles ?? []).map((r) => (
                  <Badge key={r} variant="secondary" className="font-mono text-xs">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                <Pencil />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => confirmDelete(u)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId === null ? "New user" : "Edit user"}
            </DialogTitle>
            <DialogDescription>
              {editingId === null
                ? "Create an account and assign roles."
                : "Update account details. Leave the password blank to keep the current one."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <ErrorBanner message={banner} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="user-username">Username</Label>
                <Input
                  id="user-username"
                  placeholder="jdoe"
                  value={form.username}
                  disabled={editingId !== null}
                  aria-invalid={!!fieldErrs.username}
                  aria-describedby={fieldErrs.username ? "user-username-error" : undefined}
                  onChange={(e) => update({ username: e.target.value })}
                />
                <FieldError id="user-username-error" message={fieldErrs.username} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="user-display">Display name</Label>
                <Input
                  id="user-display"
                  placeholder="Jane Doe"
                  value={form.displayName}
                  aria-invalid={!!fieldErrs.displayName}
                  aria-describedby={fieldErrs.displayName ? "user-display-error" : undefined}
                  onChange={(e) => update({ displayName: e.target.value })}
                />
                <FieldError id="user-display-error" message={fieldErrs.displayName} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                placeholder="jane.doe@example.com"
                value={form.email}
                aria-invalid={!!fieldErrs.email}
                aria-describedby={fieldErrs.email ? "user-email-error" : undefined}
                onChange={(e) => update({ email: e.target.value })}
              />
              <FieldError id="user-email-error" message={fieldErrs.email} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Department</Label>
              <Select
                value={form.departmentCode || "none"}
                onValueChange={(v) =>
                  update({ departmentCode: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
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
              <Label>
                Roles{" "}
                <span className="text-xs text-muted-foreground">
                  ({form.roles.length} selected)
                </span>
              </Label>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border p-3">
                {roles.length === 0 && (
                  <p className="text-sm text-muted-foreground">No roles available.</p>
                )}
                {roles.map((r) => (
                  <label key={r.code} className="flex cursor-pointer items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={form.roles.includes(r.code as string)}
                      onChange={() => toggleRole(r.code as string)}
                    />
                    <span className="font-mono text-xs">{r.code}</span>
                    <span className="text-xs text-muted-foreground">{r.name}</span>
                  </label>
                ))}
              </div>
              <FieldError message={fieldErrs.roles} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-password">
                Password{" "}
                {editingId !== null && (
                  <span className="text-xs text-muted-foreground">
                    (blank = keep current)
                  </span>
                )}
              </Label>
              <Input
                id="user-password"
                type="password"
                placeholder={editingId === null ? "Minimum 6 characters" : "New password"}
                value={form.password}
                aria-invalid={!!fieldErrs.password}
                aria-describedby={fieldErrs.password ? "user-password-error" : undefined}
                onChange={(e) => update({ password: e.target.value })}
              />
              <FieldError id="user-password-error" message={fieldErrs.password} />
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
              {editingId === null ? "Create user" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
