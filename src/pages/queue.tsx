import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { ArrowLeft, ArrowRight, Inbox } from "lucide-react"
import { requestsApi, type RequestResponse } from "@/api/endpoints"
import { formatDate, formatRelative } from "@/lib/format"
import { PageHeader } from "@/components/page"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

const PAGE_SIZE = 20

export function QueuePage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const { data, isPending } = useQuery({
    queryKey: ["queue", page],
    queryFn: () => requestsApi.queue({ page, size: PAGE_SIZE }),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const rows = data?.content ?? []
  const totalPages = data?.totalPages ?? 0

  const columns: ColumnDef<RequestResponse>[] = [
    {
      id: "id",
      header: "ID",
      size: 70,
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">
          #{row.original.id}
        </span>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => row.original.typeName,
    },
    {
      id: "requester",
      header: "Requester",
      cell: ({ row }) =>
        row.original.requester?.displayName ??
        row.original.requester?.username ??
        "—",
    },
    {
      id: "step",
      header: "Current step",
      cell: ({ row }) => {
        const step = (row.original.steps ?? []).find((s) => s.state === "PENDING")
        if (!step) return <span className="text-muted-foreground">—</span>
        return (
          <div>
            <div className="font-medium">{step.name}</div>
            <div className="text-xs text-muted-foreground">
              Role: {step.requiredRole}
            </div>
          </div>
        )
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "submitted",
      header: "Submitted",
      cell: ({ row }) => (
        <div className="text-right">
          <div>{formatDate(row.original.submittedAt)}</div>
          <div className="text-xs text-muted-foreground">
            {formatRelative(row.original.submittedAt)}
          </div>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div>
      <PageHeader
        title="My Approvals"
        description="Requests where you are eligible to make the current decision."
      />

      <Card>
        <CardContent className="p-0">
          {isPending ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Inbox className="size-8 text-muted-foreground" />
              <div>
                <div className="font-medium">Your approval inbox is empty</div>
                <div className="text-sm text-muted-foreground">
                  Requests that need your decision will appear here.
                </div>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead key={h.id}>
                        {h.isPlaceholder ? null : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/requests/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ArrowLeft />
          </Button>
          <span className="text-sm">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ArrowRight />
          </Button>
        </div>
      )}
    </div>
  )
}
