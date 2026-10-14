import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react"

/** Inline notice on a white canvas with a hairline and 18px radius; status is carried by the icon tone only. */
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "success" | "warning"
}

const icons = {
  default: <Info className="size-5 text-primary shrink-0" aria-hidden="true" />,
  destructive: <XCircle className="size-5 text-destructive shrink-0" aria-hidden="true" />,
  success: <CheckCircle2 className="size-5 text-success shrink-0" aria-hidden="true" />,
  warning: <AlertCircle className="size-5 text-warning shrink-0" aria-hidden="true" />,
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role={variant === "default" ? "status" : "alert"}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg bg-canvas border border-hairline px-4.25 py-3 text-caption text-ink",
          className
        )}
        {...props}
      >
        {icons[variant]}
        <div className="flex-1 min-w-0 [&_p]:leading-relaxed">{children}</div>
      </div>
    )
  }
)
Alert.displayName = "Alert"

export { Alert }
