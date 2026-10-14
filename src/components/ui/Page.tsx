import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Standard page chassis: Parchment canvas (from the layout), content locked at 1440px,
 * 16/24/32px gutters, 32→48px vertical air, 32px rhythm between sections.
 */
export function PageShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-8", className)}
      {...props}
    />
  )
}

/** Section heading inside a page: tagline (21px / 600), optional caption and trailing action. */
export function SectionTitle({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-tagline text-ink">{title}</h2>
        {description && <p className="text-caption text-ink-48 mt-1">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/**
 * KPI tile on the store-utility-card chassis: caption label, display-md figure,
 * optional caption footnote. `tone` colors only the figure (status text, never a fill).
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
  ...props
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ElementType
  tone?: "default" | "destructive" | "success" | "warning"
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  const tones = {
    default: "text-ink",
    destructive: "text-destructive",
    success: "text-success",
    warning: "text-warning",
  }
  return (
    <div className={cn("bg-canvas border border-hairline rounded-lg p-6", className)} {...props}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption text-ink-48">{label}</p>
        {Icon && <Icon className="size-4 text-ink-48 shrink-0" aria-hidden="true" />}
      </div>
      <p className={cn("text-display-md leading-tight tabular mt-2 truncate", tones[tone])}>{value}</p>
      {hint && <p className="text-caption text-ink-48 mt-1">{hint}</p>}
    </div>
  )
}

/** Empty / zero state: muted glyph, tagline title, caption copy, optional pill CTA. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ElementType
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center px-6 py-12", className)}>
      {Icon && <Icon className="size-8 text-ink-48 mb-4" aria-hidden="true" />}
      <p className="text-tagline text-ink">{title}</p>
      {description && <p className="text-caption text-ink-48 mt-2 max-w-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

/**
 * configurator-option-chip: canvas pill, caption type, hairline border.
 * Selected state upgrades to a 2px Focus Blue border. Use for filters and segmented choices.
 */
export const Chip = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }
>(({ className, selected = false, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-pressed={selected}
    className={cn(
      "press inline-flex items-center justify-center gap-1.5 rounded-full bg-canvas px-4 min-h-9 text-caption text-ink whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:pointer-events-none [&_svg]:size-3.5",
      selected ? "border-2 border-primary-focus px-[15px] font-semibold" : "border border-hairline",
      className
    )}
    {...props}
  />
))
Chip.displayName = "Chip"
