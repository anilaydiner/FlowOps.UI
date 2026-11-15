import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  Bell,
  FileText,
  Inbox,
} from "lucide-react"
import { notificationsApi, requestsApi } from "@/api/endpoints"
import { useAuth } from "@/auth/auth"
import { formatDate } from "@/lib/format"
import { PageHeader } from "@/components/page"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  onClick,
}: {
  label: string
  value?: number
  icon: typeof Bell
  loading: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left"
    >
      <Card className="transition-colors hover:bg-accent/40">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <div className="mt-1 text-3xl font-semibold">{value ?? 0}</div>
            )}
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()

  const myRequests = useQuery({
    queryKey: ["requests", "dashboard-mine"],
    queryFn: () =>
      requestsApi.list({ page: 0, size: 5, mine: isAdmin ? true : undefined }),
    staleTime: 15_000,
  })
  const queue = useQuery({
    queryKey: ["queue", "dashboard"],
    queryFn: () => requestsApi.queue({ page: 0, size: 1 }),
    staleTime: 15_000,
  })
  const unread = useQuery({
    queryKey: ["unread-count"],
    queryFn: () => notificationsApi.unreadCount(),
    staleTime: 15_000,
  })

  const recent = myRequests.data?.content ?? []

  return (
    <div>
      <PageHeader
        title={`Hello, ${user?.displayName ?? user?.username ?? "there"}`}
        description="Overview of your requests, approvals, and notifications."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label={isAdmin ? "My requests" : "Requests"}
          value={myRequests.data?.totalElements}
          icon={FileText}
          loading={myRequests.isPending}
          onClick={() => navigate("/requests")}
        />
        <StatCard
          label="Pending approvals"
          value={queue.data?.totalElements}
          icon={Inbox}
          loading={queue.isPending}
          onClick={() => navigate("/queue")}
        />
        <StatCard
          label="Unread notifications"
          value={unread.data?.count}
          icon={Bell}
          loading={unread.isPending}
          onClick={() => navigate("/notifications")}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recent requests</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/requests")}
          >
            View all
            <ArrowRight />
          </Button>
        </CardHeader>
        <CardContent>
          {myRequests.isPending ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <FileText className="size-7 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                No requests yet.
              </div>
              <Button onClick={() => navigate("/requests/new")}>
                Create your first request
              </Button>
            </div>
          ) : (
            <div className="flex flex-col divide-y">
              {recent.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/requests/${r.id}`)}
                  className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{r.id}
                      </span>
                      <span className="truncate text-sm font-medium">
                        {r.typeName}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {r.requester?.displayName ?? r.requester?.username} ·{" "}
                      {formatDate(r.updatedAt)}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
