import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Compact configurator-chip: pill, fine-print 12px. Status is carried by text color only —
 * no tinted fills, so Action Blue stays the single accent.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "success" | "warning" | "outline" | "dark"
}

const variants = {
  default: "bg-parchment text-primary",
  secondary: "bg-parchment text-ink-80",
  destructive: "bg-parchment text-destructive",
  success: "bg-parchment text-success",
  warning: "bg-parchment text-warning",
  outline: "bg-canvas text-ink-80 border border-hairline",
  dark: "bg-ink text-on-dark",
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-fine-print font-semibold whitespace-nowrap [&_svg]:size-3",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
