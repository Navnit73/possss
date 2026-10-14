import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pass `label=""` when surrounding text already announces the loading state. */
export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <Loader2
      className={cn("w-8 h-8 animate-spin text-primary", className)}
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}
