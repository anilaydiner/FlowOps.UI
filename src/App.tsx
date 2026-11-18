import { Suspense, lazy, type ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider, useAuth } from "@/auth/auth"
import { AppShell } from "@/components/app-shell"
import { Spinner } from "@/components/spinner"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { LoginPage } from "@/pages/login"

const DashboardPage = lazy(() =>
  import("@/pages/dashboard").then((m) => ({ default: m.DashboardPage })),
)
const RequestsListPage = lazy(() =>
  import("@/pages/requests-list").then((m) => ({ default: m.RequestsListPage })),
)
const RequestCreatePage = lazy(() =>
  import("@/pages/request-create").then((m) => ({ default: m.RequestCreatePage })),
)
const RequestDetailPage = lazy(() =>
  import("@/pages/request-detail").then((m) => ({ default: m.RequestDetailPage })),
)
const QueuePage = lazy(() =>
  import("@/pages/queue").then((m) => ({ default: m.QueuePage })),
)
const BlockedRequestsPage = lazy(() =>
  import("@/pages/blocked-requests").then((m) => ({
    default: m.BlockedRequestsPage,
  })),
)
const ExecutionRolloutPage = lazy(() =>
  import("@/pages/execution-rollout").then((m) => ({
    default: m.ExecutionRolloutPage,
  })),
)
const NotificationsPage = lazy(() =>
  import("@/pages/notifications").then((m) => ({ default: m.NotificationsPage })),
)
const ForgotPasswordPage = lazy(() =>
  import("@/pages/forgot-password").then((m) => ({ default: m.ForgotPasswordPage })),
)
const ResetPasswordPage = lazy(() =>
  import("@/pages/reset-password").then((m) => ({ default: m.ResetPasswordPage })),
)
const AdminUsersPage = lazy(() =>
  import("@/pages/admin-users").then((m) => ({ default: m.AdminUsersPage })),
)
const AdminRolesPage = lazy(() =>
  import("@/pages/admin-roles").then((m) => ({ default: m.AdminRolesPage })),
)
const AdminRequestTypesPage = lazy(() =>
  import("@/pages/admin-request-types").then((m) => ({
    default: m.AdminRequestTypesPage,
  })),
)
const AdminWorkflowsPage = lazy(() =>
  import("@/pages/admin-workflows").then((m) => ({ default: m.AdminWorkflowsPage })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth()
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading session…" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth()
  if (ready && user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
        <TooltipProvider>
          <Toaster richColors position="top-right" closeButton />
          <BrowserRouter>
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center">
                  <Spinner label="Loading…" />
                </div>
              }
            >
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicOnly>
                    <LoginPage />
                  </PublicOnly>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <PublicOnly>
                    <ForgotPasswordPage />
                  </PublicOnly>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <PublicOnly>
                    <ResetPasswordPage />
                  </PublicOnly>
                }
              />
              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/requests" element={<RequestsListPage />} />
                <Route path="/requests/new" element={<RequestCreatePage />} />
                <Route
                  path="/requests/:id"
                  element={<RequestDetailPage />}
                />
                <Route path="/queue" element={<QueuePage />} />
                <Route path="/blocked" element={<BlockedRequestsPage />} />
                <Route path="/rollout" element={<ExecutionRolloutPage />} />
                <Route
                  path="/notifications"
                  element={<NotificationsPage />}
                />
                <Route
                  path="/admin/users"
                  element={
                    <RequireAdmin>
                      <AdminUsersPage />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/roles"
                  element={
                    <RequireAdmin>
                      <AdminRolesPage />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/types"
                  element={
                    <RequireAdmin>
                      <AdminRequestTypesPage />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/workflows"
                  element={
                    <RequireAdmin>
                      <AdminWorkflowsPage />
                    </RequireAdmin>
                  }
                />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
