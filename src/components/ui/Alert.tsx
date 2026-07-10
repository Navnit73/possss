import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "success" | "warning"
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    
    const variants = {
      default: "bg-surface text-foreground border-border",
      destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      success: "border-success/50 text-success dark:border-success [&>svg]:text-success",
      warning: "border-yellow-500/50 text-yellow-600 dark:text-yellow-500 [&>svg]:text-yellow-600",
    }
    
    const icons = {
      default: <Info className="h-4 w-4" />,
      destructive: <XCircle className="h-4 w-4" />,
      success: <CheckCircle2 className="h-4 w-4" />,
      warning: <AlertCircle className="h-4 w-4" />
    }

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative w-full rounded-md border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
          variants[variant],
          className
        )}
        {...props}
      >
        {icons[variant]}
        <div className="text-sm [&_p]:leading-relaxed">{children}</div>
      </div>
    )
  }
)
Alert.displayName = "Alert"

export { Alert }
