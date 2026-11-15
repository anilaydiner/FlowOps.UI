import { useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { KeyRound, LockKeyhole } from "lucide-react"
import { authApi } from "@/api/endpoints"
import { apiErrorText, fieldErrors, generalError } from "@/api/error-text"
import { ErrorBanner, FieldError } from "@/components/field-error"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const MIN_LEN = 8
const MAX_LEN = 100

export function ResetPasswordPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const mutation = useMutation({
    mutationFn: () => authApi.resetPassword(token ?? "", password),
    onSuccess: () => {
      setDone(true)
      // Token is single-use — scrub it from the URL immediately.
      if (searchParams.has("token")) {
        searchParams.delete("token")
        setSearchParams(searchParams, { replace: true })
      }
    },
    onError: (err) => {
      const f = fieldErrors(err)
      setPwErr(f.newPassword ?? null)
      // Covers "Invalid or expired reset link" (detail-only 400).
      setError(generalError(err) ?? (f.newPassword ? null : apiErrorText(err)))
    },
  })

  const localConfirm =
    confirm !== "" && password !== confirm ? "Passwords do not match." : null

  const valid =
    password.length >= MIN_LEN &&
    password.length <= MAX_LEN &&
    confirm === password &&
    confirm !== ""

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!token || !valid) return
    setError(null)
    setPwErr(null)
    mutation.mutate()
  }

  const missingToken = !token

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            F
          </div>
          <div className="leading-tight">
            <div className="text-lg font-semibold">FlowOps</div>
            <div className="text-xs text-muted-foreground">
              Centralized Request &amp; Approval Platform
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {done ? "Password updated" : "Choose a new password"}
            </CardTitle>
            <CardDescription>
              {done
                ? "Your password was changed. Sign in with the new one."
                : "Set a new password for your account. It must be at least 8 characters."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-3 text-sm">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    Done. Any previous reset links for this account are no
                    longer valid.
                  </span>
                </div>
                <Button asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            ) : missingToken ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                  <KeyRound className="mt-0.5 size-4 shrink-0" />
                  <span>
                    This reset link is missing its token, so it can&apos;t be
                    used. Request a fresh one.
                  </span>
                </div>
                <Button asChild>
                  <Link to="/forgot-password">Request a new link</Link>
                </Button>
                <div className="text-center">
                  <Link
                    to="/login"
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Back to sign in
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <ErrorBanner message={error} />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rp-password">New password</Label>
                  <Input
                    id="rp-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder={`${MIN_LEN}–${MAX_LEN} characters`}
                    value={password}
                    aria-invalid={!!pwErr}
                    aria-describedby={pwErr ? "rp-password-error" : undefined}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setPwErr(null)
                      setError(null)
                    }}
                  />
                  <FieldError id="rp-password-error" message={pwErr} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rp-confirm">Confirm new password</Label>
                  <Input
                    id="rp-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat the new password"
                    value={confirm}
                    aria-invalid={!!localConfirm}
                    aria-describedby={localConfirm ? "rp-confirm-error" : undefined}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                  <FieldError id="rp-confirm-error" message={localConfirm} />
                </div>
                <Button type="submit" disabled={!valid || mutation.isPending}>
                  {mutation.isPending ? "Updating…" : "Update password"}
                </Button>
                <div className="text-center">
                  <Link
                    to="/forgot-password"
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Link not working? Request a new one
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
