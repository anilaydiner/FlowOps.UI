import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { MailCheck } from "lucide-react"
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

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [fieldErr, setFieldErr] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => authApi.forgotPassword(email.trim()),
    onSuccess: (res) => {
      // Always 202 — show the uniform message; never reveal whether the
      // address exists.
      setSent(
        res?.message ??
          "If that address is registered, a password-reset link is on its way."
      )
    },
    onError: (err) => {
      const f = fieldErrors(err)
      setFieldErr(f.email ?? null)
      setError(generalError(err) ?? apiErrorText(err))
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErr(null)
    mutation.mutate()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="size-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground flex">
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
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              Enter the email address on your account and we&apos;ll send you a
              secure reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-3 text-sm">
                  <MailCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{sent}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  The link is single-use and expires after 30 minutes. Check
                  your spam folder if it doesn&apos;t arrive soon.
                </p>
                <Button variant="ghost" onClick={() => navigate("/login")}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <ErrorBanner message={error} />
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fp-email">Email</Label>
                  <Input
                    id="fp-email"
                    type="email"
                    autoComplete="email"
                    placeholder="jane.doe@example.com"
                    value={email}
                    required
                    aria-invalid={!!fieldErr}
                    aria-describedby={fieldErr ? "fp-email-error" : undefined}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setFieldErr(null)
                      setError(null)
                    }}
                  />
                  <FieldError id="fp-email-error" message={fieldErr} />
                </div>
                <Button
                  type="submit"
                  disabled={mutation.isPending || email.trim() === ""}
                >
                  {mutation.isPending ? "Sending…" : "Send reset link"}
                </Button>
                <div className="text-center">
                  <Link
                    to="/login"
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Back to sign in
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
