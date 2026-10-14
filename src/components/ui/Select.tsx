import * as React from "react"
import { cn } from "@/lib/utils"
import { fieldClasses } from "./Input"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/** Native select on the search-input pill; `select-chevron` replaces the OS arrow with a muted glyph. */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => {
    return (
      <select
        className={cn(fieldClasses, "select-chevron appearance-none pr-10 cursor-pointer", className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Select.displayName = "Select"

export { Select }
