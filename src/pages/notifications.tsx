import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckCheck } from "lucide-react"
import { notificationsApi, type NotificationResponse } from "@/api/endpoints"
import { apiErrorText } from "@/api/error-text"
import { formatDate, formatRelative } from "@/lib/format"
import { PageHeader } from "@/components/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)

  const { data, isPending } = useQuery({
    queryKey: ["notifications", page],
    queryFn: () => notificationsApi.list({ page, size: 25 }),
    staleTime: 10_000,
  })

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] })
    queryClient.invalidateQueries({ queryKey: ["unread-count"] })
  }

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      toast.success("All notifications marked as read")
      refetch()
    },
    onError: (err) => toast.error(apiErrorText(err)),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => refetch(),
    onError: (err) => toast.error(apiErrorText(err)),
  })

  const items = data?.content ?? []
  const unread = items.filter((n) => !n.read).length

  const open = (n: NotificationResponse) => {
    if (!n.read && n.id) markReadMutation.mutate(n.id)
    if (n.requestId) navigate(`/requests/${n.requestId}`)
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Your delivery feed — approvals, status changes, and system events."
        actions={
          unread > 0 ? (
            <Button
              variant="outline"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
            >
              <CheckCheck />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {isPending &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          {!isPending && items.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => open(n)}
              className={[
                "flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-accent/60",
                !n.read ? "bg-primary/[0.03]" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  n.read ? "bg-transparent" : "bg-primary",
                ].join(" ")}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span
                    className={[
                      "truncate text-sm",
                      n.read ? "text-muted-foreground" : "font-medium",
                    ].join(" ")}
                  >
                    {n.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(n.createdAt)}
                  </span>
                </span>
                {n.body && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {n.body}
                  </span>
                )}
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {formatDate(n.createdAt)}
                </span>
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      {(data?.totalPages ?? 0) > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page + 1} / {data?.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= (data?.totalPages ?? 1) - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
