import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight } from "lucide-react"
import {
  adminApi,
  REQUEST_STATUSES,
  requestsApi,
  type RequestListQuery,
  type RequestResponse,
} from "@/api/endpoints"
import { formatDate, formatRelative } from "@/lib/format"
import { PageHeader } from "@/components/page"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/auth/auth"

const PAGE_SIZE = 15

function Requester({ req, isAdmin }: { req: RequestResponse; isAdmin: boolean }) {
  if (!isAdmin) return <span className="text-muted-foreground">You</span>
  return (
    <span>
      {req.requester?.displayName ?? req.requester?.username ?? "—"}
    </span>
  )
}

export function RequestsListPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [query, setQuery] = useState<RequestListQuery>({
    status: undefined,
    typeCode: undefined,
    mine: false,
    page: 0,
    size: PAGE_SIZE,
  })

  const setFilter = (patch: Partial<RequestListQuery>) =>
    setQuery((q) => ({ ...q, ...patch, page: 0 }))

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["requests", query],
    queryFn: () => requestsApi.list(query),
    staleTime: 10_000,
  })

  const { data: typesData } = useQuery({
    queryKey: ["request-types"],
    queryFn: () => adminApi.requestTypes(),
    staleTime: 5 * 60_000,
  })
  const types = (typesData?.content ?? []).filter((t) => t.active !== false)

  const rows = data?.content ?? []
  const total = data?.totalElements ?? 0
  const page = data?.page ?? 0
  const pages = data?.totalPages ?? 0

  const columns: ColumnDef<RequestResponse>[] = [
    {
      id: "id",
      header: "ID",
      size: 80,
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">
          #{row.original.id}
        </span>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.typeName}</div>
          {row.original.departmentCode && (
            <div className="text-xs text-muted-foreground">
              {row.original.departmentCode}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "requester",
      header: "Requester",
      cell: ({ row }) => (
        <Requester req={row.original} isAdmin={isAdmin} />
      ),
    },
    {
      id: "updated",
      header: "Updated",
      cell: ({ row }) => (
        <div className="text-right">
          <div>{formatDate(row.original.updatedAt)}</div>
          <div className="text-xs text-muted-foreground">
            {formatRelative(row.original.updatedAt)}
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

  if (isError) {
    const e = error as { message?: string }
    return (
      <div>
        <PageHeader title="Requests" description="Your submitted requests" />
        <Card>
          <CardContent className="p-6 text-destructive">
            {e.message ?? "Failed to load requests."}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Requests"
        description="Browse, filter, and create requests."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={query.status ?? "all"}
          onValueChange={(v) => setFilter({ status: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {REQUEST_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={query.typeCode ?? "all"}
          onValueChange={(v) => setFilter({ typeCode: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t.code} value={t.code ?? ""}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={query.mine === true}
              onChange={(e) => setFilter({ mine: e.target.checked || undefined })}
            />
            Only mine
          </label>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isPending ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
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
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate(`/requests/${row.original.id}`)
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {total} total
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 0}
            onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 0) - 1 }))}
          >
            <ArrowLeft />
          </Button>
          <span className="text-sm">
            Page {page + 1} / {Math.max(pages, 1)}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= pages - 1}
            onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 0) + 1 }))}
          >
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
