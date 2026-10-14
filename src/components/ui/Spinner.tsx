import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pass `label=""` when surrounding text already announces the loading state. */
export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <Loader2
      className={cn("size-6 animate-spin text-ink-48", className)}
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}
