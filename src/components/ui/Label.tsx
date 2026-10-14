import * as React from "react"
import { cn } from "@/lib/utils"

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

/** caption-strong: 14px / 600 */
const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-caption font-semibold text-ink peer-disabled:cursor-not-allowed peer-disabled:opacity-40",
          className
        )}
        {...props}
      />
    )
  }
)
Label.displayName = "Label"

export { Label }
