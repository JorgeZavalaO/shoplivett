import * as React from "react"
import { Inbox } from "lucide-react"

import { cn } from "@/lib/utils"

type EmptyStateProps = {
  title: string
  description?: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
  size?: "sm" | "md"
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/40 text-center",
        size === "sm" ? "px-4 py-6" : "px-6 py-10",
        className,
      )}
    >
      <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-4" />}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-md text-xs text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
