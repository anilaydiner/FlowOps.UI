import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Bell,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Shield,
  Sun,
  Users,
  Workflow as WorkflowIcon,
} from "lucide-react"
import { notificationsApi } from "@/api/endpoints"
import { useAuth } from "@/auth/auth"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const MAIN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/requests", label: "Requests", icon: FileText },
  { to: "/queue", label: "My Approvals", icon: Inbox },
  { to: "/notifications", label: "Notifications", icon: Bell },
]

const ADMIN_NAV: NavItem[] = [
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/roles", label: "Roles & Permissions", icon: Shield },
  { to: "/admin/types", label: "Request Types", icon: FileText },
  { to: "/admin/workflows", label: "Workflows", icon: WorkflowIcon },
]

function initials(name?: string): string {
  if (!name) return "?"
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function NavButton({
  item,
  badge,
}: {
  item: NavItem
  badge?: number
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        ].join(" ")
      }
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge
          variant="secondary"
          className="min-w-5 justify-center px-1 text-xs"
        >
          {badge > 99 ? "99+" : badge}
        </Badge>
      )}
    </NavLink>
  )
}

export function AppShell() {
  const { user, isAdmin, logout } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: unread } = useQuery({
    queryKey: ["unread-count"],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 30_000,
    staleTime: 5_000,
  })

  const handleLogout = () => {
    logout()
    queryClient.clear()
    navigate("/login")
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            F
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">FlowOps</div>
            <div className="text-[11px] text-muted-foreground">
              Request &amp; Approvals
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <NavButton item={MAIN_NAV[0]} />
          <NavButton item={MAIN_NAV[1]} />
          <NavButton item={MAIN_NAV[2]} />
          <NavButton item={MAIN_NAV[3]} badge={unread?.count ?? 0} />

          <div className="my-2 flex items-center gap-2 px-3">
            <Button
              asChild
              className="w-full justify-start gap-2 bg-primary"
            >
              <NavLink to="/requests/new">
                <Plus className="size-4" />
                New Request
              </NavLink>
            </Button>
          </div>

          {isAdmin && (
            <>
              <div className="mt-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Administration
              </div>
              {ADMIN_NAV.map((item) => (
                <NavButton key={item.to} item={item} />
              ))}
            </>
          )}
        </nav>

        <div className="border-t p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Appearance
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors hover:bg-accent">
              <Avatar className="size-8">
                <AvatarFallback>{initials(user?.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-medium">
                  {user?.displayName ?? user?.username}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {(user?.roles ?? []).join(", ") || "member"}
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-medium">{user?.username}</div>
                <div className="text-xs text-muted-foreground">
                  {user?.departmentName ?? "—"}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="ml-60 flex-1">
        <div className="mx-auto max-w-5xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
