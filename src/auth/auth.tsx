import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { authApi, meApi, type UserResponse } from "@/api/endpoints"
import { ApiError, tokenStore } from "@/api/client"

interface AuthContextValue {
  user: UserResponse | null
  /** True once the initial session check has finished. */
  ready: boolean
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  /** Revokes the session server-side, then clears local state. Always resolves. */
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [ready, setReady] = useState(false)

  // Restore session on first load.
  useEffect(() => {
    let cancelled = false
    const token = tokenStore.get()
    if (!token) {
      setReady(true)
      return
    }
    // Absolute session deadline passed (30d max) → nothing to restore.
    // (The api() interceptor would also discover this via a failed refresh,
    // but checking locally avoids the round-trip.)
    const sessionExpiresAt = tokenStore.getSessionExpiresAt()
    if (sessionExpiresAt && Date.parse(sessionExpiresAt) <= Date.now()) {
      tokenStore.clear()
      setReady(true)
      return
    }
    // An expired ACCESS token is fine: meApi.get() goes through the
    // interceptor, which rotates the refresh token on 401 before retrying.
    meApi
      .get()
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        // Only clear if the interceptor didn't already sign the user out.
        if (!tokenStore.get()) tokenStore.clear()
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password)
    if (!res.token) throw new ApiError({ title: "Login failed" }, 500)
    // Persist the full pair: access token + refresh token + deadlines.
    tokenStore.storeAuthResponse(res)
    const me = await meApi.get()
    setUser(me)
  }, [])

  const logout = useCallback(async () => {
    // Revoke server-side first (best effort — the session may already be dead,
    // and local sign-out must always succeed regardless).
    try {
      await authApi.logout()
    } catch {
      // ignore
    }
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      isAdmin: (user?.roles ?? []).includes("ADMIN"),
      login,
      logout,
    }),
    [user, ready, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>")
  return ctx
}
