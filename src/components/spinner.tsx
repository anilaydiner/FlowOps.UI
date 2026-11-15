import { Loader2 } from "lucide-react"

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}
