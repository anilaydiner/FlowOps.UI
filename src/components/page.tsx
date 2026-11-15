import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardShell({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      {(title || description || actions) && (
        <CardHeader className="flex-row items-center justify-between">
          <div>
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </div>
          {actions}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  )
}
