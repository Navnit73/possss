import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * search-input grammar applied to every text field: white canvas, 1px hairline,
 * full pill, body 17px, 44px tall, 12×20 padding. Invalid state uses the destructive tone.
 */
export const fieldClasses =
  "flex min-h-11 w-full rounded-full border border-hairline bg-canvas px-5 py-2.5 text-body text-ink placeholder:text-ink-48 disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive file:border-0 file:bg-transparent file:text-caption file:font-semibold file:text-primary"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(fieldClasses, className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

/** Multi-line fields can't be pills; they take the utility-card radius (18px). */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(fieldClasses, "rounded-lg min-h-24 py-3", className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Input, Textarea }
