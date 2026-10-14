import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Buttons follow DESIGN.md › components:
 *  - default      → button-primary        (Action Blue pill, body 17px, 11×22)
 *  - outline      → button-secondary-pill (ghost pill, Action Blue text + 1px border)
 *  - secondary    → button-pearl-capsule  (Pearl fill, ink-80 caption, 3px soft ring, 11px radius)
 *  - utility      → button-dark-utility   (ink fill, 14px, 8px radius)
 *  - ghost / link → text-link             (Action Blue text, no chrome)
 *  - destructive  → primary pill shape in the destructive status tone (gap-fill)
 * Sizes are DESIGN.md's button specs scaled to 75% for this dense app UI:
 * default (33px pill), sm (24px), lg (36px, store-hero), icon (33px circle).
 * Press state is `scale(0.95)`; focus is the global 2px Focus Blue outline.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "utility" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  /** Shows a spinner, disables the button and sets aria-busy while an action is pending. */
  loading?: boolean
}

const variants = {
  default: "bg-primary text-primary-foreground rounded-full",
  destructive: "bg-destructive text-destructive-foreground rounded-full",
  outline: "bg-transparent text-primary border border-primary rounded-full",
  secondary: "bg-pearl text-ink-80 border-[3px] border-divider-soft rounded-md",
  utility: "bg-ink text-on-dark rounded-sm",
  ghost: "bg-transparent text-primary rounded-full",
  link: "bg-transparent text-primary hover:underline underline-offset-[3px] rounded-xs",
}

const sizes = {
  default: "min-h-8.25 px-4 py-2 text-caption",
  sm: "min-h-6 px-2.75 py-1 text-fine-print",
  lg: "min-h-9 px-5.25 py-2.5 text-caption",
  icon: "size-8.25 rounded-full",
}

// Pearl capsule and dark utility carry their own compact typography regardless of size
const variantSizeOverrides: Partial<Record<NonNullable<ButtonProps["variant"]>, string>> = {
  secondary: "text-fine-print px-2.5 py-1.5 min-h-7",
  utility: "text-fine-print px-2.75 py-1.5 min-h-7",
  link: "px-0 py-0 min-h-0",
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "press inline-flex items-center justify-center gap-2 whitespace-nowrap font-normal cursor-pointer select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0",
          variants[variant],
          sizes[size],
          size !== "icon" && variantSizeOverrides[variant],
          size === "icon" && variant === "ghost" && "text-ink",
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

/** Same class recipe for <Link>/<a> elements that must look like a button. */
function buttonClasses({
  variant = "default",
  size = "default",
  className,
}: { variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; className?: string } = {}) {
  return cn(
    "press inline-flex items-center justify-center gap-2 whitespace-nowrap font-normal cursor-pointer select-none aria-disabled:pointer-events-none aria-disabled:opacity-40 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    size !== "icon" && variantSizeOverrides[variant],
    className
  )
}

export { Button, buttonClasses }
