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
  logout: () => void
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
    meApi
      .get()
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        tokenStore.clear()
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
    tokenStore.set(res.token)
    const me = await meApi.get()
    setUser(me)
  }, [])

  const logout = useCallback(() => {
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
