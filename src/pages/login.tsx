import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { apiErrorText } from "@/api/error-text"
import { ApiError } from "@/api/client"
import { useAuth } from "@/auth/auth"
import { ErrorBanner } from "@/components/field-error"
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

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
      toast.success("Signed in")
      navigate("/dashboard", { replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Invalid username or password"
          : apiErrorText(err)
      )
      setBusy(false)
    }
  }

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
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Use your enterprise credentials to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <ErrorBanner message={error} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setError(null)
                  }}
                  placeholder="e.g. alice"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(null)
                  }}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              <div className="text-center">
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Forgot your password?
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
